-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — inscrições pagas (modal de pagamento)
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0001).
-- Fica aqui versionado para recriar o ambiente do zero se preciso.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists public.inscricoes (
  id                uuid        primary key default gen_random_uuid(),
  nome              text        not null check (char_length(trim(nome)) between 3 and 120),
  email             citext      not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Telemóvel guardado em E.164 (+351...). Validado na fronteira (libphonenumber).
  telefone          text        not null check (telefone ~ '^\+[1-9][0-9]{6,15}$'),
  metodo_pagamento  text        check (metodo_pagamento in ('sumup','mbway','transferencia')),
  status            text        not null default 'pendente'
                                check (status in ('pendente','confirmado','cancelado')),
  -- P3: bónus de sinalização e ecobag. Fica já na base, sem UI ainda.
  is_bonus          boolean     not null default false,
  kit_recolhido     boolean     not null default false,
  -- Hash do IP (rastreio anti-abuso), nunca PII em claro — mesmo padrão do waitlist.
  ip_hash           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Uma pessoa = uma inscrição. Re-submissão atualiza a linha existente.
create unique index if not exists inscricoes_email_key
  on public.inscricoes (email);
-- O spec pede índice por created_at (contagens e ordenações do painel).
create index if not exists inscricoes_created_at_idx
  on public.inscricoes (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inscricoes_set_updated_at on public.inscricoes;
create trigger inscricoes_set_updated_at
  before update on public.inscricoes
  for each row execute function public.set_updated_at();

-- RLS ativo, sem policies públicas: a tabela é inacessível por qualquer chave de cliente.
alter table public.inscricoes enable row level security;

-- Única superfície de escrita da inscrição, validada e idempotente por email.
-- Sem service role: o padrão do projeto é SECURITY DEFINER via RPC + RLS.
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
  else
    insert into public.inscricoes (nome, email, telefone, ip_hash)
    values (p_nome, p_email::citext, p_telefone, p_ip_hash)
    returning id into v_id;
    v_status := 'criada';
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id);
end;
$$;

revoke all on function public.registar_inscricao(text, text, text, text) from public;
grant execute on function public.registar_inscricao(text, text, text, text)
  to anon, authenticated, service_role;

-- Marca o método de pagamento escolhido na modal (antes de redirecionar para
-- o SumUp, ou quando a pessoa escolhe MB Way / Transferência).
create or replace function public.definir_metodo_inscricao(
  p_inscricao_id uuid,
  p_metodo       text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_metodo not in ('sumup','mbway','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;

  update public.inscricoes
     set metodo_pagamento = p_metodo
   where id = p_inscricao_id;

  if not found then
    raise exception 'inscricao_nao_encontrada' using errcode = '22023';
  end if;

  return jsonb_build_object('status', 'ok', 'id', p_inscricao_id, 'metodo', p_metodo);
end;
$$;

revoke all on function public.definir_metodo_inscricao(uuid, text) from public;
grant execute on function public.definir_metodo_inscricao(uuid, text)
  to anon, authenticated, service_role;

-- Contagem pública sem expor dados pessoais (P3: dos50/ecobag, só o número).
create or replace function public.inscricoes_count()
returns integer language sql security definer set search_path = '' stable as $$
  select count(*)::int from public.inscricoes where status <> 'cancelado';
$$;

revoke all on function public.inscricoes_count() from public;
grant execute on function public.inscricoes_count() to anon, authenticated, service_role;
