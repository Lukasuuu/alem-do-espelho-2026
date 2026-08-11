-- ══════════════════════════════════════════════════════════════════
-- PASTE ÚNICO — patrocinadores (0004_sponsors.sql + 0005_sponsors_v2.sql)
-- Aplicar TUDO numa só colagem no SQL Editor (projeto qtiyxibqeignvsnfhzpw).
-- Sequência obrigatória: 0004 primeiro, 0005 depois (0005 constrói sobre 0004).
-- Idempotente: se a colagem falhar a meio, pode re-colar o que faltar.
-- ══════════════════════════════════════════════════════════════════

-- ------------- 0004: TABELA + MÉTODO --------------

-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — patrocinadores (pagamento do patrocínio)
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0003).
-- Fica aqui versionado para recriar o ambiente do zero se preciso.
-- ═══════════════════════════════════════════════════════════════

-- Citext já é criado pela 0002; garantimos idempotência caso 0004 seja
-- aplicado isoladamente.
create extension if not exists "citext";

-- Patrocinador registado no fluxo "Quero Patrocinar" (nível + método).
-- Valores por nível fechados: 75 / 150 / 200€. Pagamento SEMPRE sem cartão:
-- só MB Way ou transferência bancária (o SumUp é exclusivo da inscrição).
create table if not exists public.sponsors (
  id                uuid        primary key default gen_random_uuid(),
  nome              text        not null check (char_length(trim(nome)) between 3 and 120),
  email             citext      not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Telemóvel guardado em E.164 (+351...). Validado na fronteira (libphonenumber).
  telefone          text        not null check (telefone ~ '^\+[1-9][0-9]{6,15}$'),
  nivel             integer     not null check (nivel in (75, 150, 200)),
  metodo_pagamento  text        check (metodo_pagamento in ('mbway','transferencia')),
  status            text        not null default 'pendente'
                                check (status in ('pendente','confirmado','cancelado')),
  -- Hash do IP (rastreio anti-abuso), nunca PII em claro — mesmo padrão dos restantes.
  ip_hash           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Uma entidade = um registo de patrocínio. Re-submissão atualiza a linha existente.
create unique index if not exists sponsors_email_key
  on public.sponsors (email);
create index if not exists sponsors_created_at_idx
  on public.sponsors (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sponsors_set_updated_at on public.sponsors;
create trigger sponsors_set_updated_at
  before update on public.sponsors
  for each row execute function public.set_updated_at();

-- RLS ativo, sem policies públicas: a tabela é inacessível por qualquer chave de cliente.
alter table public.sponsors enable row level security;

-- Única superfície de escrita do patrocinador, validada e idempotente por email.
-- Sem service role: o padrão do projeto é SECURITY DEFINER via RPC + RLS.
create or replace function public.registar_sponsor(
  p_nome     text,
  p_email    text,
  p_telefone text,
  p_nivel    integer,
  p_ip_hash  text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.sponsors%rowtype;
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
  if p_nivel not in (75, 150, 200) then
    raise exception 'invalid_nivel' using errcode = '22023';
  end if;

  select * into v_existing from public.sponsors where email = p_email;

  if found then
    -- Quem voltou (ex. mudou de nível e recomeçou) atualiza os dados.
    -- Se o registo tinha sido cancelado, volta a 'pendente' com método por escolher.
    update public.sponsors
       set nome      = p_nome,
           telefone  = p_telefone,
           nivel     = p_nivel,
           status    = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end
     where id = v_existing.id
     returning id into v_id;
    v_status := 'ja_existente';
  else
    insert into public.sponsors (nome, email, telefone, nivel, ip_hash)
    values (p_nome, p_email, p_telefone, p_nivel, p_ip_hash)
    returning id into v_id;
    v_status := 'criada';
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id, 'nivel', p_nivel);
end;
$$;

revoke all on function public.registar_sponsor(text, text, text, integer, text) from public;
grant execute on function public.registar_sponsor(text, text, text, integer, text)
  to anon, authenticated, service_role;

-- Marca o método de pagamento do patrocínio na modal (antes de mostrar as
-- instruções de MB Way ou transferência). Só mbway/transferencia — sem cartão.
create or replace function public.definir_metodo_sponsor(
  p_sponsor_id uuid,
  p_metodo     text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_metodo not in ('mbway','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;

  update public.sponsors
     set metodo_pagamento = p_metodo
   where id = p_sponsor_id;

  if not found then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;

  return jsonb_build_object('status', 'ok', 'id', p_sponsor_id, 'metodo', p_metodo);
end;
$$;

revoke all on function public.definir_metodo_sponsor(uuid, text) from public;
grant execute on function public.definir_metodo_sponsor(uuid, text)
  to anon, authenticated, service_role;

-- ------------- 0005: v2 (COLUNAS + NÍVEL) --------------

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

  -- RGPD (Lucas, 11/08): o consentimento é obrigatório e tem de ser true.
  -- Recusar em vez de gravar false — nunca persistir um não-consentimento.
  -- É a defesa em profundidade: a rota já exige literal(true) no zod.
  if p_consentimento is distinct from true then
    raise exception 'consentimento_obrigatorio' using errcode = '22023';
  end if;

  select * into v_existing from public.sponsors where email = p_email;

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
    values (p_nome, p_email, p_telefone, p_nivel, p_empresa, p_consentimento, p_ip_hash)
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

-- ------------- VERIFICAÇÃO (correr depois) --------------
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       case when p.prosecdef then 'DEFINER' else 'INVOKER' end as seg,
       array_to_string(p.proconfig, ',') as cfg
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like '%sponsor%'
 order by 1;

select relrowsecurity from pg_class where relname = 'sponsors';
