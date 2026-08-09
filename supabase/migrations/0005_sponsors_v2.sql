-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — sponsors v2 (CORREÇÕES ao fluxo de patrocínio)
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0004).
-- NÃO aplicar sem aprovação — ver GATE no relatório.
--
-- Mudanças:
--   1. nova coluna `empresa` (opcional, nome da empresa/marca — CORREÇÃO nº6)
--   2. nova coluna `consentimento` (obrigatório, como na inscrição)
--   3. `nivel` passa a NULLABLE — no POST do formulário o nível ainda não foi
--      escolhido; é marcado depois no passo B (definir_nivel_sponsor)
--   4. `registar_sponsor` reescrita (assinatura nova) + `definir_nivel_sponsor`
-- ═══════════════════════════════════════════════════════════════

-- ── 1/2 Colunas novas ──────────────────────────────────────────
alter table public.sponsors
  add column if not exists empresa text
    check (empresa is null or char_length(trim(empresa)) <= 120),
  add column if not exists consentimento boolean not null default false;

-- Nível passa a ser opcional até ao passo B (escolha depois do formulário).
alter table public.sponsors
  alter column nivel drop not null;

-- ── 2/2 Funções ────────────────────────────────────────────────

-- Remove a assinatura antiga (0004) para não deixar overload morto.
drop function if exists public.registar_sponsor(text, text, text, integer, text);

create or replace function public.registar_sponsor(
  p_nome          text,
  p_email         text,
  p_telefone      text,
  p_nivel         integer default null,
  p_empresa       text default null,
  p_consentimento boolean default false,
  p_ip_hash       text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.sponsors%rowtype;
  v_id       uuid;
  v_status   text;
begin
  p_nome          := trim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'));
  p_email         := lower(trim(coalesce(p_email,'')));
  p_telefone      := regexp_replace(coalesce(p_telefone,''), '[^0-9+]', '', 'g');
  p_empresa       := trim(regexp_replace(coalesce(p_empresa,''), '\s+', ' ', 'g'));
  if p_empresa = '' then p_empresa := null; end if;

  if char_length(p_nome) < 3 then
    raise exception 'invalid_full_name' using errcode = '22023';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_telefone !~ '^\+[1-9][0-9]{6,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  -- Nível só é validado quando já veio escolhido (passo B); null é válido aqui.
  if p_nivel is not null and p_nivel not in (75, 150, 200) then
    raise exception 'invalid_nivel' using errcode = '22023';
  end if;

  select * into v_existing from public.sponsors where email = p_email::citext;

  if found then
    -- Quem voltou (ex. mudou de nível e recomeçou) atualiza os dados.
    -- Se o registo tinha sido cancelado, volta a 'pendente' com método por escolher.
    update public.sponsors
       set nome          = p_nome,
           telefone      = p_telefone,
           nivel         = p_nivel,
           empresa       = p_empresa,
           consentimento = p_consentimento,
           status        = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end
     where id = v_existing.id
     returning id into v_id;
    v_status := 'ja_existente';
  else
    insert into public.sponsors (nome, email, telefone, nivel, empresa, consentimento, ip_hash)
    values (p_nome, p_email::citext, p_telefone, p_nivel, p_empresa, p_consentimento, p_ip_hash)
    returning id into v_id;
    v_status := 'criada';
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id, 'nivel', p_nivel);
end;
$$;

revoke all on function public.registar_sponsor(text, text, text, integer, text, boolean, text) from public;
grant execute on function public.registar_sponsor(text, text, text, integer, text, boolean, text)
  to anon, authenticated, service_role;

-- Marca o nível escolhido no passo B (depois do formulário), para a
-- reconciliação manual saber que valor cada patrocinadora vai pagar.
create or replace function public.definir_nivel_sponsor(
  p_sponsor_id uuid,
  p_nivel      integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_nivel not in (75, 150, 200) then
    raise exception 'invalid_nivel' using errcode = '22023';
  end if;

  update public.sponsors
     set nivel = p_nivel
   where id = p_sponsor_id;

  if not found then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;

  return jsonb_build_object('status', 'ok', 'id', p_sponsor_id, 'nivel', p_nivel);
end;
$$;

revoke all on function public.definir_nivel_sponsor(uuid, integer) from public;
grant execute on function public.definir_nivel_sponsor(uuid, integer)
  to anon, authenticated, service_role;
