-- ═══════════════════════════════════════════════════════════════
-- 0012_emails_fila.sql — R15: fila de emails server-side
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0010).
-- Fica aqui versionado para recriar o ambiente do zero se preciso.
--
-- Arquitectura (R15 + adenda):
--   • O browser NUNCA envia emails e NUNCA decide destinatários.
--     A app (rotas /api/ do Next) passa id + posse_token; o endereço
--     de email do inscrito vive só em inscricoes.email e é lido AQUI.
--   • emails_fila é a fonte de verdade de "a Maria recebeu o email?".
--   • Quatro tipos (check da coluna tipo):
--       instrucoes            — como pagar (MB Way/IBAN/SumUp), no clique do método
--       org_nova_inscricao    — notificação mínima à organização (sem dados pessoais, RGPD 06/09)
--       comprovativo_recebido — "recebemos o teu comprovativo, vamos validar" (substitui
--                               o email prematuro de "confirmação" do fluxo antigo)
--       confirmacao           — pagamento CONFIRMADO (a base fala, adenda §1)
--   • ADENDA §1: o 'confirmacao' é enfileirado por TRIGGER na transição
--     pagamentos.estado → 'confirmed' (única transição que marca paid_at/
--     confirmed_at/inscricoes.status='confirmado', 0006:528-537). Qualquer
--     caminho que confirme — RPC da Vitória, painel futuro, reconciliação
--     dos 13 — gera o email sozinho. O frontend não o pode falhar.
--   • ADENDA §2: a reconciliação dos 13 usa confirmar_pagamento (não UPDATE
--     cru) — o trigger enfileira os 13 emails automaticamente.
--
-- Segurança (mesmos guardrails da 0006/0009):
--   • RLS ativo, ZERO policies na tabela — só RPCs SECURITY DEFINER.
--   • set search_path = '' em tudo; nomes sempre qualificados.
--   • posse verificada pelo posse_token da 0009 (comparação directa),
--     mesmo mecanismo das restantes RPCs.
--   • reclamar_lote_emails / concluir_email: grant SÓ a service_role
--     (a Edge Function usa service_role; anon nunca drena nem conclui).
--   • ultimo_erro truncado a 500 chars; nunca guarda a API key.
--
-- Idempotência: índice único (inscricao_id, tipo). Chamada duplicada ao
-- enfileirar_email devolve 'existente' e NÃO cria segunda linha.
-- Prova obrigatória em runtime (R15 FASE 2) antes de seguir para a FASE 3.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Tabela emails_fila
-- ───────────────────────────────────────────────────────────────
create table if not exists public.emails_fila (
  id               uuid        primary key default gen_random_uuid(),
  inscricao_id     uuid        not null references public.inscricoes(id) on delete cascade,
  tipo             text        not null check (tipo in (
                     'instrucoes','org_nova_inscricao','comprovativo_recebido','confirmacao'
                   )),
  destinatario     text        not null,
  dados            jsonb       not null default '{}'::jsonb,
  estado           text        not null default 'pendente'
                                 check (estado in ('pendente','a_enviar','enviado','falhado')),
  tentativas       integer     not null default 0,
  proximo_envio_em timestamptz not null default now(),
  enviado_em       timestamptz,
  resend_id        text,
  ultimo_erro      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.emails_fila is
  'Fila de emails server-side (R15). O browser nunca envia emails nem decide destinatários: a app passa id+posse_token e o destinatário do inscrito é lido de inscricoes.email. Drenagem por Edge Function (for update skip locked) + cron minuto a minuto.';

alter table public.emails_fila enable row level security;

-- Anti-duplicado: UM email por (inscrição, tipo). O insert duplicado cai no
-- do nothing — é a idempotência da fila (substitui email_*_ok da 0010).
create unique index if not exists emails_fila_inscricao_tipo_idx
  on public.emails_fila (inscricao_id, tipo);

-- Drenagem: o worker pergunta sempre por linhas vencidas, ordenadas pela
-- mais antiga. Parcial: só estados activos interessam.
create index if not exists emails_fila_drenagem_idx
  on public.emails_fila (proximo_envio_em)
  where estado in ('pendente','a_enviar');

drop trigger if exists emails_fila_set_updated_at on public.emails_fila;
create trigger emails_fila_set_updated_at
  before update on public.emails_fila
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 2. RPC: enfileirar_email (posse_token da 0009)
-- ───────────────────────────────────────────────────────────────
-- Chamada pelas rotas /api/ do Next (anon key + rate limit próprio).
-- O campo p_dados traz SÓ o que a base não pode saber (dados financeiros de
-- src/lib/pagamento.ts — IBAN, beneficiário, MB Way, link SumUp — e links do
-- site): NÃO duplicamos esses valores na base. Os campos que a base conhece
-- (nome, referencia, valor, metodo, data_hora) são calculados AQUI e
-- sobrescrevem o que vier em p_dados — o email diz sempre o que a pessoa
-- paga de facto (adenda: valor da linha de pagamentos, não a constante).
--
-- Para 'org_nova_inscricao' o p_dados é IGNORADO deliberadamente (RGPD 06/09):
-- só data_hora + referencia (8 chars), sem nome, email, método ou comprovativo.
create or replace function public.enfileirar_email(
  p_inscricao_id uuid,
  p_posse_token  text,
  p_tipo         text,
  p_dados        jsonb default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_posse      text;
  v_email      text;
  v_nome       text;
  v_destino    text;
  v_dados      jsonb;
  v_valor      text;
  v_metodo     text;
  v_data_hora  text;
  v_fila_id    uuid;
  v_inseriu    boolean;
  -- ADENDA §1: destinatário do email à organização — constante do servidor
  -- (fonte da app: src/lib/site.ts ORG_EMAIL). Duplicado aqui DE LIBERDADE:
  -- a base não deve depender do bundle para decidir destinatários.
  c_org_email  constant text := 'essenceofbeauty.pt@gmail.com';
begin
  if p_tipo not in ('instrucoes','org_nova_inscricao','comprovativo_recebido','confirmacao') then
    raise exception 'invalid_tipo' using errcode = '22023';
  end if;

  select i.posse_token, i.email, i.nome
    into v_posse, v_email, v_nome
    from public.inscricoes i
   where i.id = p_inscricao_id;

  if v_email is null then
    raise exception 'inscricao_nao_encontrada' using errcode = '22023';
  end if;
  if v_posse is null or p_posse_token is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  -- Valor/método da linha REAL de pagamentos (mais recente da inscrição) —
  -- nunca a constante de preço de tabela (adenda: nota sobre o valor).
  select to_char(p.valor, 'FM999990D00'), p.metodo
    into v_valor, v_metodo
    from public.pagamentos p
   where p.inscricao_id = p_inscricao_id
   order by p.created_at desc, p.id desc
   limit 1;

  if v_tipo = 'org_nova_inscricao' then
    -- Sem dados pessoais (decisão RGPD do Lucas, 06/09): data/hora + ref.
    -- Relógio do SERVIDOR (Europe/Lisbon — Braga), nunca o do browser.
    v_destino := c_org_email;
    v_dados := jsonb_build_object(
      'data_hora',  to_char(now() at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI'),
      'referencia', left(p_inscricao_id::text, 8)
    );
  else
    v_destino := v_email;  -- o email do INSCRITO, lido da base — sempre.
    v_dados := coalesce(p_dados, '{}'::jsonb) || jsonb_build_object(
      'nome',       v_nome,
      'referencia', left(p_inscricao_id::text, 8),
      'valor',      coalesce(translate(v_valor, '.', ','), '40,00') || ' €',
      'metodo',     v_metodo
    );
  end if;

  insert into public.emails_fila (inscricao_id, tipo, destinatario, dados)
  values (p_inscricao_id, p_tipo, v_destino, v_dados)
  on conflict (inscricao_id, tipo) do nothing
  returning id into v_fila_id;

  v_inseriu := v_fila_id is not null;

  return jsonb_build_object(
    'status', case when v_inseriu then 'enfileirado' else 'existente' end,
    'email_fila_id', v_fila_id,
    'tipo', p_tipo
  );
end;
$$;

revoke all on function public.enfileirar_email(uuid, text, text, jsonb) from public;
grant execute on function public.enfileirar_email(uuid, text, text, jsonb)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 3. RPC: reclamar_lote_emails — drenagem com for update skip locked
-- ───────────────────────────────────────────────────────────────
-- R15 FASE 3: "for update skip locked — não o omitas". Vários workers
-- (ou crons sobrepostos) drenam sem se disputarem nem processarem a mesma
-- linha duas vezes. Reclama também linhas 'a_enviar' velhas (>10 min):
-- worker crashou a meio e a linha não pode ficar presa para sempre.
create or replace function public.reclamar_lote_emails(
  p_limite integer default 10
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lote jsonb;
begin
  if p_limite is null or p_limite < 1 then
    p_limite := 10;
  end if;
  if p_limite > 50 then
    p_limite := 50;  -- tecto: o cron corre a cada minuto, lote pequeno chega
  end if;

  with reclamaveis as (
    select id
      from public.emails_fila
     where (estado = 'pendente'  and proximo_envio_em <= now())
        or (estado = 'a_enviar'  and updated_at <= now() - interval '10 minutes')
     order by proximo_envio_em
     limit p_limite
     for update skip locked
  )
  update public.emails_fila f
     set estado = 'a_enviar', updated_at = now()
    from reclamaveis r
   where f.id = r.id
   returning to_jsonb(f.*) into v_lote;

  return coalesce(v_lote, '[]'::jsonb);
end;
$$;

revoke all on function public.reclamar_lote_emails(integer) from public, anon, authenticated;
grant execute on function public.reclamar_lote_emails(integer) to service_role;

-- ───────────────────────────────────────────────────────────────
-- 4. RPC: concluir_email — resultado do envio, com regras da R15 FASE 3
-- ───────────────────────────────────────────────────────────────
-- A Edge Function mapeia o código HTTP do Resend:
--   2xx          → p_ok=true
--   422/400      → p_definitivo=true   (payload inválido NÃO melhora com retry)
--   429          → p_contar_tentativa=false, p_adiar_segundos=21600 (6h)
--   5xx/timeout  → default (retry com backoff, conta a tentativa)
-- Backoff por tentativa (1→6): 1min, 5min, 15min, 1h, 6h, 24h. Esgotadas as
-- seis → 'falhado'. ultimo_erro fica truncado a 500 chars e NUNCA contém a
-- API key (a Edge Function só manda a mensagem de erro, sem headers).
create or replace function public.concluir_email(
  p_email_fila_id    uuid,
  p_ok               boolean,
  p_erro             text default null,
  p_resend_id        text default null,
  p_adiar_segundos   integer default null,
  p_definitivo       boolean default false,
  p_contar_tentativa boolean default true
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tentativas integer;
  v_backoff    constant integer[] := array[60, 300, 900, 3600, 21600, 86400];
  v_estado     text;
  v_em_segundos integer;
begin
  select tentativas into v_tentativas
    from public.emails_fila
   where id = p_email_fila_id
   for update;

  if not found then
    raise exception 'email_fila_nao_encontrado' using errcode = '22023';
  end if;

  if p_ok then
    update public.emails_fila
       set estado = 'enviado', enviado_em = now(),
           resend_id = coalesce(p_resend_id, resend_id), ultimo_erro = null
     where id = p_email_fila_id;
    return jsonb_build_object('status', 'enviado');
  end if;

  if p_definitivo then
    update public.emails_fila
       set estado = 'falhado', ultimo_erro = left(coalesce(p_erro, 'erro definitivo'), 500)
     where id = p_email_fila_id;
    return jsonb_build_object('status', 'falhado');
  end if;

  if p_contar_tentativa then
    v_tentativas := v_tentativas + 1;
  end if;

  if v_tentativas > array_length(v_backoff, 1) then
    update public.emails_fila
       set estado = 'falhado', tentativas = v_tentativas,
           ultimo_erro = left(coalesce(p_erro, 'esgotou retries'), 500)
     where id = p_email_fila_id;
    return jsonb_build_object('status', 'falhado', 'tentativas', v_tentativas);
  end if;

  v_em_segundos := coalesce(
    p_adiar_segundos,
    v_backoff[v_tentativas]
  );
  v_estado := 'pendente';

  update public.emails_fila
     set estado = v_estado, tentativas = v_tentativas,
         proximo_envio_em = now() + make_interval(secs => v_em_segundos),
         ultimo_erro = left(coalesce(p_erro, 'erro desconhecido'), 500)
   where id = p_email_fila_id;

  return jsonb_build_object('status', 'reagendado', 'tentativas', v_tentativas, 'em_segundos', v_em_segundos);
end;
$$;

revoke all on function public.concluir_email(uuid, boolean, text, text, integer, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.concluir_email(uuid, boolean, text, text, integer, boolean, boolean)
  to service_role;

-- ───────────────────────────────────────────────────────────────
-- 5. ADENDA §1 — trigger: transição para 'confirmed' enfileira o email
-- ───────────────────────────────────────────────────────────────
-- Corre em QUALQUER update que leve o pagamento a 'confirmed' (só a
-- confirmar_pagamento chega lá — 0006:524-533, grant só service_role):
-- a RPC da Vitória, um painel futuro, a reconciliação dos 13.
-- on conflict (inscricao_id, tipo): re-confirmar algo já confirmado
-- (old.estado já era 'confirmed') nem sequer entra; e um idempotente
-- duplo nunca cria segunda linha.
create or replace function public.tg_enfileirar_confirmacao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'confirmed' and old.estado is distinct from 'confirmed' then
    insert into public.emails_fila (inscricao_id, tipo, destinatario, dados)
    select new.inscricao_id,
           'confirmacao',
           i.email,
           jsonb_build_object(
             'nome',       i.nome,
             'referencia', left(new.inscricao_id::text, 8),
             'valor',      translate(to_char(new.valor, 'FM999990D00'), '.', ',') || ' €',
             'metodo',     new.metodo
           )
    from public.inscricoes i
    where i.id = new.inscricao_id
    on conflict (inscricao_id, tipo) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists pagamentos_confirmado_enfileira_email on public.pagamentos;
create trigger pagamentos_confirmado_enfileira_email
  after update on public.pagamentos
  for each row execute function public.tg_enfileirar_confirmacao();

-- ───────────────────────────────────────────────────────────────
-- 6. Registo de migração
-- ───────────────────────────────────────────────────────────────
insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0012_emails_fila', 'r15',
   'Fila server-side: emails_fila + enfileirar_email (posse_token) + reclamar_lote_emails (skip locked) + concluir_email (backoff 1m/5m/15m/1h/6h/24h; 422/400 falhado; 429 adia 6h sem contar) + trigger confirmado→confirmacao (adenda §1). 4 tipos: instrucoes, org_nova_inscricao, comprovativo_recebido, confirmacao')
on conflict (nome) do nothing;

-- ───────────────────────────────────────────────────────────────
-- DOWN (reversível):
--   drop trigger if exists pagamentos_confirmado_enfileira_email on public.pagamentos;
--   drop function if exists public.tg_enfileirar_confirmacao();
--   drop function if exists public.concluir_email(uuid, boolean, text, text, integer, boolean, boolean);
--   drop function if exists public.reclamar_lote_emails(integer);
--   drop function if exists public.enfileirar_email(uuid, text, text, jsonb);
--   drop table if exists public.emails_fila;
-- (inscricoes e pagamentos ficam intactas; emails em voo pendentes perdem-se —
--  aceitável: a fila é recriável e os envios são idempotentes por (id, tipo).)
-- ═══════════════════════════════════════════════════════════════