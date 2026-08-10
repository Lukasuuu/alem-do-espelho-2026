-- ═════════════════════════════════════════════════════════════════════════════
-- 🔴 FIX-0 — ENTREGÁVEL PARA O SQL EDITOR DO SUPABASE (desbloqueia os 40€ JÁ)
--
-- Projeto: qtiyxibqeignvsnfhzpw (eu-west-3)
--
-- O QUE ISTO É: os dois CREATE OR REPLACE corrigidos para colar no SQL Editor
-- (Dashboard → SQL Editor). Não precisa de deploy — as funções vivem na DB.
-- Assim que colares e correres, /api/inscricao volta a funcionar (201).
--
-- PORQUÊ: `registar_inscricao` (e `join_waitlist`) faziam `p_email::citext`
-- sob `set search_path = ''`. Com search_path vazio o NOME do tipo `citext`
-- não resolve (vive no schema da extensão, fora do pg_catalog) → 502
-- `type "citext" does not exist`. A DB está sã: a extensão está instalada e
-- as colunas continuam citext — era só o cast explícito.
--
-- A CORREÇÃO: removem-se os casts. `where email = p_email` resolve pelo
-- operador `citext = text` (comparação case-insensitive PRESERVADA); o
-- `values (..., p_email, ...)` resolve pelo cast de atribuição text→citext
-- via OID da coluna. Nada de DDL, nada de tocar em assinaturas, grants, RLS
-- ou SECURITY DEFINER.
--
-- IDEMPOTENTE E REVERSÍVEL: CREATE OR REPLACE; voltar ao corpo antigo é só
-- re-criar. Podes colar as duas funções de uma vez.
--
-- VERIFICAR DEPOIS (regra de higiene):
--   1. 1 submissão descartável REAL no site → /api/inscricao deve devolver 201
--   2. confirmar a linha na tabela `inscricoes`
--   3. `delete from public.inscricoes where email = '<email de teste>';`
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1/2 — registar_inscricao (a função VIVA em produção; corpo da migration 0003)
--      Alteradas as 2 linhas de cast: p_email::citext → p_email
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.registar_inscricao(
  p_nome     text,
  p_email    text,
  p_telefone text,
  p_ip_hash  text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.inscricoes%rowtype;
  v_id       uuid;
  v_status   text;
  v_bonus    boolean := false;
  -- Janela da campanha — manter em sincronia com src/lib/campanha.ts
  v_inicio   timestamptz := '2026-08-05T22:00:00+01:00'::timestamptz;
  v_fim      timestamptz := '2026-08-10T10:00:00+01:00'::timestamptz;
  v_count    integer;
begin
  p_nome     := trim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'));
  p_email    := lower(trim(coalesce(p_email,'')));
  p_telefone := regexp_replace(coalesce(p_telefone,''), '[^0-9+]', '', 'g');

  if char_length(p_nome) < 3 then
    raise exception 'invalid_full_name' using errcode = '22023';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_telefone !~ '^\+[1-9][0-9]{6,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  select * into v_existing from public.inscricoes where email = p_email;

  if found then
    -- Quem voltou (ex. pagamento falhou e recomeçou) atualiza os dados.
    -- Se a inscrição tinha sido cancelada, volta a 'pendente' com método por escolher.
    update public.inscricoes
       set nome      = p_nome,
           telefone  = p_telefone,
           status    = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end
     where id = v_existing.id
     returning id into v_id;
    v_status := 'ja_inscrita';
    -- Re-submissão: já pode ter bónus, não alterar
    v_bonus := v_existing.is_bonus;
  else
    insert into public.inscricoes (nome, email, telefone, ip_hash)
    values (p_nome, p_email, p_telefone, p_ip_hash)
    returning id into v_id;
    v_status := 'criada';

    -- ── Atribuição de bónus (só para novas inscrições) ──
    -- Verifica janela de campanha (05/08 22:00 → 10/08 10:00 Lisboa)
    if now() between v_inicio and v_fim then
      -- Conta bónus existentes com FOR UPDATE para serializar
      select count(*)::int into v_count
        from public.inscricoes
       where is_bonus = true
         and status <> 'cancelado'
         for update;

      if v_count < 50 then
        update public.inscricoes
           set is_bonus = true
         where id = v_id;
        v_bonus := true;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'status',  v_status,
    'id',      v_id,
    'is_bonus', v_bonus
  );
end;
$$;

revoke all on function public.registar_inscricao(text, text, text, text) from public;
grant execute on function public.registar_inscricao(text, text, text, text)
  to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2/2 — join_waitlist (corpo da migration 0001)
--      MESMO bug de cast (p_email::citext); corrigido para quando a lista de
--      espera voltar a ser chamada. Não apaga nem toca em registos existentes.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.join_waitlist(
  p_full_name     text,
  p_email         text,
  p_phone         text,
  p_phone_country text default null,
  p_consent       boolean default true,
  p_locale        text default null,
  p_source        text default 'waitlist-lp',
  p_utm           jsonb default '{}'::jsonb,
  p_referrer      text default null,
  p_user_agent    text default null,
  p_ip_hash       text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.waitlist_subscribers%rowtype;
  v_id       uuid;
  v_position int;
  v_status   text;
begin
  p_full_name := trim(regexp_replace(coalesce(p_full_name,''), '\s+', ' ', 'g'));
  p_email     := lower(trim(coalesce(p_email,'')));
  p_phone     := regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g');

  if char_length(p_full_name) < 3 then
    raise exception 'invalid_full_name' using errcode = '22023';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_phone !~ '^\+[1-9][0-9]{6,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  select * into v_existing from public.waitlist_subscribers where email = p_email;

  if found then
    update public.waitlist_subscribers
       set full_name     = p_full_name,
           phone         = p_phone,
           phone_country = coalesce(p_phone_country, phone_country),
           status        = case when status = 'unsubscribed' then 'pending' else status end
     where id = v_existing.id
     returning id into v_id;
    v_status := 'already_registered';
  else
    insert into public.waitlist_subscribers (
      full_name, email, phone, phone_country, consent, locale, source,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referrer, user_agent, ip_hash
    ) values (
      p_full_name, p_email, p_phone, p_phone_country, coalesce(p_consent, true),
      p_locale, coalesce(p_source, 'waitlist-lp'),
      nullif(p_utm->>'utm_source',''), nullif(p_utm->>'utm_medium',''),
      nullif(p_utm->>'utm_campaign',''), nullif(p_utm->>'utm_term',''),
      nullif(p_utm->>'utm_content',''),
      left(nullif(p_referrer,''), 500), left(nullif(p_user_agent,''), 500), p_ip_hash
    ) returning id into v_id;
    v_status := 'created';
  end if;

  select count(*)::int into v_position
  from public.waitlist_subscribers
  where created_at <= (select created_at from public.waitlist_subscribers where id = v_id)
    and status <> 'unsubscribed';

  return jsonb_build_object('status', v_status, 'position', v_position);
end;
$$;

revoke all on function public.join_waitlist(
  text, text, text, text, boolean, text, text, jsonb, text, text, text) from public;
grant execute on function public.join_waitlist(
  text, text, text, text, boolean, text, text, jsonb, text, text, text)
  to anon, authenticated, service_role;
