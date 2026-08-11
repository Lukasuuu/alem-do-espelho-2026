-- =============================================================================
-- Além do Espelho 2026 — tabela `sponsors` (consolidado 0004 + 0005) — CORRIGIDO
-- Projeto Supabase: qtiyxibqeignvsnfhzpw (eu-west-3)
--
-- Porquê consolidado: a 0004 NUNCA foi aplicada a produção (verificado —
-- não existe tabela `sponsors` nem `registar_sponsor`). Não há v1 para migrar,
-- logo cria-se o estado final de uma só vez. Mais simples e sem estado
-- intermédio.
--
-- ⚠️ CORREÇÃO (10/08): este ficheiro foi alinhado com o CONTRATO REAL das
--    rotas em src/app/api/sponsor/*. Antes rebentava à nascença:
--    · `registar_sponsor` tinha 6 args (sem p_nivel) e devolvia uuid; as
--      rotas chamam 7 args e lêem jsonb {status, id, nivel}.
--    · sem upsert por email (índice não único) → duplicados permitidos.
--    · literais ('consentimento obrigatorio', 'nivel invalido'...) que as rotas
--      nunca procuram — esperam invalid_full_name / invalid_email /
--      invalid_phone / invalid_nivel / invalid_metodo / sponsor_nao_encontrada
--      → qualquer erro real caía em 502 genérico.
--    · `::public.citext` sob search_path = '' — o MESMO bug que queimou as
--      inscrições (type "citext" does not exist). Casts removidos: `email =
--      p_email` resolve pelo operador citext=text (case-insensitive) e a
--      atribuição text→citext resolve pelo OID da coluna. NADA de DDL nas
--      colunas, extensão intacta.
--
-- Convenções copiadas do que JÁ existe em produção (registar_inscricao):
--   · citext no email, com o mesmo regex
--   · telefone em E.164
--   · RLS ATIVO, sem policies para anon — o acesso é só via SECURITY DEFINER
--   · SECURITY DEFINER + search_path = '' (obrigatório: evita search_path
--     hijacking em funções privilegiadas)
--   · trigger set_updated_at() — já existe no schema, reutilizado
-- =============================================================================

create extension if not exists citext;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA (estado final 0004 + 0005: nivel nullable, empresa opcional,
-- consentimento obrigatório)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sponsors (
  id                uuid primary key default gen_random_uuid(),

  nome              text not null
                    check (char_length(trim(nome)) between 3 and 120),

  email             citext not null
                    check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  telefone          text not null
                    check (telefone ~ '^\+[1-9][0-9]{6,15}$'),

  -- Opcional: patrocinador pode ser pessoa singular.
  empresa           text
                    check (empresa is null or char_length(trim(empresa)) between 2 and 160),

  -- NULL até a pessoa escolher o nível no passo seguinte (modal B).
  nivel             integer
                    check (nivel is null or nivel in (75, 150, 200)),

  metodo_pagamento  text
                    check (metodo_pagamento is null
                           or metodo_pagamento in ('mbway', 'transferencia')),

  -- RGPD: consentimento explícito, obrigatório (a rota envia sempre true).
  consentimento     boolean not null default false,

  status            text not null default 'pendente'
                    check (status in ('pendente', 'confirmado', 'cancelado')),

  ip_hash           text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.sponsors is
  'Patrocinadores do Além do Espelho 2026. Escrita apenas via RPC SECURITY DEFINER.';

-- Uma entidade = um registo de patrocínio. ÍNDICE ÚNICO em email: é a base do
-- upsert da registar_sponsor (re-submissão atualiza, nunca duplica).
drop index if exists public.sponsors_email_idx;
create unique index if not exists sponsors_email_key on public.sponsors (email);
create index if not exists sponsors_created_at_idx on public.sponsors (created_at desc);

drop trigger if exists sponsors_set_updated_at on public.sponsors;
create trigger sponsors_set_updated_at
  before update on public.sponsors
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — ativo e SEM policies para anon.
-- O cliente nunca toca na tabela: escreve só através das funções abaixo.
-- Sem service role no browser.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sponsors enable row level security;

revoke all on public.sponsors from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 1 — registar patrocinador (passo A: dados; nível ainda null)
-- Assinatura EXATA do que a rota chama (src/app/api/sponsor/route.ts:103-112):
--   p_nome, p_email, p_telefone, p_nivel, p_empresa, p_consentimento, p_ip_hash
-- → jsonb {status: 'criada'|'ja_existente', id, nivel}.
-- Upsert por email, SEM casts ::citext.
-- ─────────────────────────────────────────────────────────────────────────────
-- Remove a assinatura antiga (0004, 5 args) para não deixar overload morto.
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.sponsors%rowtype;
  v_id       uuid;
  v_status   text;
begin
  p_nome          := trim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  p_email         := lower(trim(coalesce(p_email, '')));
  p_telefone      := regexp_replace(coalesce(p_telefone, ''), '[^0-9+]', '', 'g');
  p_empresa       := trim(regexp_replace(coalesce(p_empresa, ''), '\s+', ' ', 'g'));
  if p_empresa = '' then
    p_empresa := null;
  end if;

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
       set nome            = p_nome,
           telefone        = p_telefone,
           nivel           = p_nivel,
           empresa         = p_empresa,
           consentimento   = p_consentimento,
           status          = case when status = 'cancelado' then 'pendente' else status end,
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

grant execute on function public.registar_sponsor(text, text, text, integer, text, boolean, text)
  to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 2 — definir nível (passo B: escolha de 75/150/200)
-- A rota (src/app/api/sponsor/nivel/route.ts) procura 'invalid_nivel' (422) e
-- 'sponsor_nao_encontrada' (404); lê jsonb {status: 'ok', id, nivel}.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.definir_nivel_sponsor(
  p_sponsor_id uuid,
  p_nivel      integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

grant execute on function public.definir_nivel_sponsor(uuid, integer)
  to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 3 — definir método de pagamento (passo C: mbway | transferencia)
-- A rota (src/app/api/sponsor/metodo/route.ts) procura 'invalid_metodo' (422)
-- e 'sponsor_nao_encontrada' (404); lê jsonb {status: 'ok', id, metodo}.
-- Só mbway/transferencia — o SumUp é exclusivo da inscrição.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.definir_metodo_sponsor(
  p_sponsor_id uuid,
  p_metodo     text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_metodo not in ('mbway', 'transferencia') then
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

grant execute on function public.definir_metodo_sponsor(uuid, text)
  to anon, authenticated, service_role;

-- =============================================================================
-- VERIFICAÇÃO — correr depois de aplicar
-- =============================================================================
-- select p.proname,
--        pg_get_function_identity_arguments(p.oid) as args,
--        case when p.prosecdef then 'DEFINER' else 'INVOKER' end as seg,
--        array_to_string(p.proconfig, ',') as cfg
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname like '%sponsor%';
--
-- select relrowsecurity from pg_class where relname = 'sponsors';
--
-- select indexdef from pg_indexes where tablename = 'sponsors';
--
-- Teste ponta a ponta pelo FORMULÁRIO REAL (não por SQL), depois:
--   delete from public.sponsors where email = '<email de teste>';
-- =============================================================================
