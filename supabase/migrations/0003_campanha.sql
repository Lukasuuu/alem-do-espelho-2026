-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — Campanha Ecobag Bónus
-- Aplicar DEPOIS de 0002_inscricoes.sql.
-- Adiciona: atribuição automática de bónus (is_bonus) e counter
-- da campanha para o card público.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Counter da campanha (público, sem expor dados) ──────
-- Conta quantas ecobags bónus foram reservadas.
-- FLUXO APROVADO = lista de espera (sem pagamento): as inscrições entram em
-- waitlist_subscribers, por isso o counter conta as ativas aí (cap de 50).
-- Usado pelo endpoint GET /api/campanha/inscritos.
create or replace function public.inscricoes_campanha_count()
returns integer language sql security definer set search_path = '' stable as $$
  select count(*)::int
    from public.waitlist_subscribers
   where status <> 'unsubscribed';
$$;

revoke all on function public.inscricoes_campanha_count() from public;
grant execute on function public.inscricoes_campanha_count()
  to anon, authenticated, service_role;

-- ── 2. Atribuição server-side do bónus ─────────────────────
-- Atualiza registar_inscricao() para marcar is_bonus = true nas
-- primeiras 50 inscritas durante a janela da campanha.  Proteção
-- contra race: SELECT ... FOR UPDATE + verificação atómica dentro
-- de uma única transação PL/pgSQL.
--
-- INICIO_CAMPANHA deve bater com INICIO_CAMPANHA_ISO em
-- src/lib/campanha.ts.  Se mudares o deploy time, atualiza aqui.
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

  select * into v_existing from public.inscricoes where email = p_email::citext;

  if found then
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
    values (p_nome, p_email::citext, p_telefone, p_ip_hash)
    returning id into v_id;
    v_status := 'criada';

    -- ── Atribuição de bónus (só para novas inscrições) ──
    -- Verifica janela de campanha
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

-- Mantemos os mesmos grants da versão anterior (idempotente)
revoke all on function public.registar_inscricao(text, text, text, text) from public;
grant execute on function public.registar_inscricao(text, text, text, text)
  to anon, authenticated, service_role;
