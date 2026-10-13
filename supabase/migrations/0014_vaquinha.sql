-- 0014_vaquinha.sql — Vaquinha Online da ONG Atos (troca no hero a 17/10 09:30)
-- Bloco V1 do briefing de 13/10/2026. Aplicar pelo conector Supabase (MCP),
-- como as 0008–0012; juntamente com o registo retroativo da 0013.
--
-- ── A REGRA QUE DEFINE O DESENHO ──────────────────────────────────────────────
-- Os três métodos de pagamento (link SumUp, MB Way, transferência) acontecem
-- FORA da aplicação e NENHUM tem confirmação automática. Por isso a barra
-- pública nunca pode somar a escolha do doador: quem escreve "1.000 €" e fecha
-- a janela não pode fazer a página de uma causa solidária afirmar dinheiro que
-- nunca existiu. Três estados, e só um deles conta como sólido:
--
--   iniciada   → escolheu valor e método, viu as instruções      (não conta)
--   declarada  → tocou em "Já fiz a doação"                     (a confirmar)
--   confirmada → um voluntário confirmou o recebimento (V5)     (conta, sólido)
--   anulada    → não recebido, duplicado ou teste               (não conta)
--
-- O interruptor vaquinha_config.contar_pendentes (sem deploy) decide se as
-- 'declarada' entram no número. O SERVIDOR é que aplica o interruptor: quando
-- está em false, vaquinha_totais() devolve a_confirmar_cents = 0, para que
-- nenhum bug de cliente volte a mostrar pendentes. A flag vai também na
-- resposta para a UI poder esconder a linha "inclui X € a confirmar".
--
-- ── POSSE E ABUSO ─────────────────────────────────────────────────────────────
-- Posse por posse_token (padrão da 0009), NUNCA por ip_hash. A 17/10 as ~100
-- pessoas estão no Wi-Fi do hotel, todas atrás do MESMO IP público: um limite
-- por ip_hash é, na prática, um limite da sala inteira. Assim, o ip_hash fica
-- só como sinal grosso de abuso (≥200 pedidos/10 min) e as defesas reais são o
-- idem_key único (anti duplo clique), o estado 'declarada' e a anulação manual.
--
-- ── ADMIN ─────────────────────────────────────────────────────────────────────
-- O Next em produção NÃO tem service_role (só publishable/anon — ver
-- src/lib/supabase.ts e fila-emails.ts). A chave admin é por isso dedicada:
-- uma env server-only na Vercel, comparada aqui com o sha256() do CORE (sem
-- pgcrypto e sem depender de schema, lição do bug do citext). As RPCs admin são
-- por isso concedidas a anon — quem autoriza é a chave, não o role. A chave tem
-- ≥32 caracteres aleatórios (inviável de forçar por tentativa) e a rota do V5
-- soma-lhe uma palavra-passe humana própria, comparada no Next com
-- timingSafeEqual, com limite de tentativas.
--
-- NÃO HÁ SEED: a meta (D1) ainda não está fechada. Sem linha em
-- vaquinha_config, iniciar_doacao levanta 'vaquinha_nao_configurada' e
-- vaquinha_totais() devolve ativa=false com zeros. O seed (inicio, meta_cents,
-- admin_chave_hash) entra quando houver decisão do Lucas/Vitória.
--
-- DOWN (rollback): drop function public.admin_decidir_doacao(text, uuid, text, text);
--   drop function public.admin_listar_doacoes(text, integer);
--   drop function public.vaquinha_totais();
--   drop function public.declarar_doacao(uuid, text);
--   drop function public.iniciar_doacao(integer, text, uuid, text);
--   drop table public.doacoes; drop table public.vaquinha_config;
--   delete from public.migrations_aplicadas where nome in ('0013_cron_emails','0014_vaquinha');

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABELAS
-- ═══════════════════════════════════════════════════════════════════════════

-- Linha única (id boolean primary key default true check (id)).
-- admin_chave_hash é a ÚNICA coluna que acrescentei ao DDL do briefing: sem ela
-- não há como verificar a chave admin sem service_role. Guarda o sha256 em hex
-- de uma chave ≥32 caracteres; é preenchida no seed, nunca antes.
create table if not exists public.vaquinha_config (
  id               boolean primary key default true check (id),  -- linha única
  inicio           timestamptz not null,   -- início do evento (VAQUINHA_INICIO_ISO)
  fim              timestamptz,            -- D6; nulo = sem fecho
  meta_cents       integer not null check (meta_cents > 0),
  ativa            boolean not null default true,   -- kill switch sem deploy
  contar_pendentes boolean not null default true,
  valor_max_cents  integer not null default 100000, -- 1.000 €
  admin_chave_hash text                    -- sha256(hex) da chave admin; seed
);

create table if not exists public.doacoes (
  id            uuid primary key default gen_random_uuid(),
  referencia    text not null unique,      -- ex. ATOS-7K3F, mostrada ao doador
  valor_cents   integer not null check (valor_cents >= 500),
  metodo        text not null check (metodo in ('link','mbway','transferencia')),
  estado        text not null default 'iniciada'
                check (estado in ('iniciada','declarada','confirmada','anulada')),
  posse_token   text not null,
  idem_key      uuid not null unique,      -- anti duplo clique
  ip_hash       text,                      -- só sinal de abuso, nunca posse
  criada_em     timestamptz not null default now(),
  declarada_em  timestamptz,
  decidida_em   timestamptz,
  nota          text
);

-- Índices das colunas que entram em WHERE (regra do projeto: toda a coluna em
-- WHERE/JOIN tem índice). referencia e idem_key já têm índice pela constraint.
create index if not exists doacoes_estado_declarada_em_idx
  on public.doacoes (estado, declarada_em desc);
create index if not exists doacoes_ip_hash_criada_em_idx
  on public.doacoes (ip_hash, criada_em desc);

-- RLS ativa nas duas, SEM políticas: nenhum acesso direto por anon. Só as
-- funções SECURITY DEFINER (dono postgres, que ignora RLS) tocam nas tabelas.
alter table public.vaquinha_config enable row level security;
alter table public.doacoes        enable row level security;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RPCs PÚBLICAS (anon)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── iniciar_doacao: cria a doação e devolve a referência + o token de posse ──
-- Idempotente por idem_key (duplo clique devolve a MESMA linha, nunca duplica).
-- O gate vive aqui, no servidor: é a autoridade, mesmo que o render do cliente
-- esteja forçado por override de teste.
create or replace function public.iniciar_doacao(
  p_valor_cents integer,
  p_metodo      text,
  p_idem_key    uuid,
  p_ip_hash     text default null::text
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg       public.vaquinha_config%rowtype;
  v_existente public.doacoes%rowtype;
  v_id        uuid;
  v_ref       text;
  v_token     text;
  v_tentativa integer;   -- ciclo exterior: retry da referência
  v_k         integer;   -- ciclo interior: os 4 caracteres
  v_abusos    integer;
  -- Alfabeto sem ambíguos: nada de 0/O/1/I/L (a referência é lida em voz alta
  -- e escrita à mão no descritivo da transferência e na mensagem do MB Way).
  v_alfabeto  text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
begin
  -- 1. Configuração (linha única). Sem seed → não configurada, nunca um 500.
  select * into v_cfg from public.vaquinha_config where id;
  if not found then
    raise exception 'vaquinha_nao_configurada' using errcode = '22023';
  end if;

  -- 2. Gates de servidor (ativa, já abriu, ainda não fechou)
  if v_cfg.ativa is not true then
    raise exception 'vaquinha_inativa' using errcode = '22023';
  end if;
  if now() < v_cfg.inicio then
    raise exception 'vaquinha_nao_abriu' using errcode = '22023';
  end if;
  if v_cfg.fim is not null and now() >= v_cfg.fim then
    raise exception 'vaquinha_encerrada' using errcode = '22023';
  end if;

  -- 3. Validação da fronteira (nunca confiar no cliente)
  if p_metodo is null or p_metodo not in ('link','mbway','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;
  if p_idem_key is null then
    raise exception 'idem_key_obrigatoria' using errcode = '22023';
  end if;
  if p_valor_cents is null or p_valor_cents < 500 then
    raise exception 'valor_minimo' using errcode = '22023';
  end if;
  if p_valor_cents > v_cfg.valor_max_cents then
    raise exception 'valor_maximo' using errcode = '22023';
  end if;

  -- 4. Sinal grosso de abuso por ip_hash: 200 em 10 min. Deliberadamente LARGO —
  --    a sala inteira partilha o mesmo IP público no evento, e a defesa real é o
  --    idem_key + a anulação manual no V5.
  --    Conta SÓ as linhas que continuam em 'iniciada': quem está mesmo a doar
  --    sai desse estado em minutos (declara, ou é confirmada), por isso uma sala
  --    a doar a sério nunca chega ao limite, enquanto um flood de linhas que
  --    nunca declaram bate nele. Contar tudo faria 100 pessoas × 2 tentativas =
  --    200 e bloquearia a sala inteira no pior momento possível.
  if p_ip_hash is not null then
    select count(*) into v_abusos from public.doacoes
     where ip_hash = p_ip_hash and estado = 'iniciada'
       and criada_em > now() - interval '10 minutes';
    if v_abusos >= 200 then
      raise exception 'demasiados_pedidos' using errcode = '22023';
    end if;
  end if;

  -- 5. Idempotência: a mesma idem_key devolve a mesma linha (mesmo token).
  select * into v_existente from public.doacoes where idem_key = p_idem_key;
  if found then
    return jsonb_build_object(
      'status','existente','id',v_existente.id,'referencia',v_existente.referencia,
      'posse_token',v_existente.posse_token,'valor_cents',v_existente.valor_cents,
      'metodo',v_existente.metodo,'estado',v_existente.estado);
  end if;

  -- 6. Token de posse — mesmo padrão da 0009: dois uuid sem hífenes.
  --    gen_random_uuid() é CORE (pg_catalog) e por isso resolve com
  --    search_path = ''; gen_random_bytes() seria de extensão e exigiria
  --    qualificar o schema — de propósito não se usa.
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');

  -- 7. Inserir com referência única. 31^4 ≈ 923 mil combinações; a colisão é
  --    improvável mas tratada (retry) e, em corrida, o idem_key ganha.
  --
  --    floor() é OBRIGATÓRIO: o cast de double precision para integer em
  --    Postgres ARREDONDA (não trunca como em C). Sem o floor, random()*31
  --    chegaria a 31 → posição 32 de um alfabeto de 31 → substr devolve vazio,
  --    e ~6% das referências sairiam com 3 caracteres (além de o 1.º símbolo
  --    ficar com metade da probabilidade). A verificação 6.8 gera 10 000
  --    referências e confirma length = 9 em todas.
  for v_tentativa in 1..12 loop
    v_ref := 'ATOS-';
    for v_k in 1..4 loop
      v_ref := v_ref || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::integer, 1);
    end loop;

    begin
      insert into public.doacoes (referencia, valor_cents, metodo, posse_token, idem_key, ip_hash)
      values (v_ref, p_valor_cents, p_metodo, v_token, p_idem_key, p_ip_hash)
      returning id into v_id;

      return jsonb_build_object(
        'status','criada','id',v_id,'referencia',v_ref,'posse_token',v_token,
        'valor_cents',p_valor_cents,'metodo',p_metodo,'estado','iniciada');
    exception when unique_violation then
      -- Corrida no idem_key (dois cliques simultâneos): devolve quem ganhou.
      select * into v_existente from public.doacoes where idem_key = p_idem_key;
      if found then
        return jsonb_build_object(
          'status','existente','id',v_existente.id,'referencia',v_existente.referencia,
          'posse_token',v_existente.posse_token,'valor_cents',v_existente.valor_cents,
          'metodo',v_existente.metodo,'estado',v_existente.estado);
      end if;
      -- Senão foi colisão de referência: volta a tentar com outra.
    end;
  end loop;

  raise exception 'referencia_indisponivel' using errcode = '22023';
end;
$function$;

-- ── declarar_doacao: 'iniciada' → 'declarada' (o momento em que passa a contar)
-- Idempotente: declarar duas vezes não muda nada nem duplica. Devolve os totais
-- já atualizados para a barra subir sem um segundo pedido.
create or replace function public.declarar_doacao(
  p_id          uuid,
  p_posse_token text
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_doacao public.doacoes%rowtype;
begin
  select * into v_doacao from public.doacoes where id = p_id for update;
  if v_doacao.id is null then
    raise exception 'doacao_nao_encontrada' using errcode = '22023';
  end if;
  if p_posse_token is null or v_doacao.posse_token <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  if v_doacao.estado = 'anulada' then
    raise exception 'doacao_anulada' using errcode = '22023';
  end if;

  -- Anti-bot: ninguém paga por MB Way, link ou transferência em menos de 10 s.
  -- Um script que faz iniciar → declarar seguido bate aqui. O travão vive dentro
  -- do ramo que ESCREVE ('iniciada'): uma segunda declaração legítima (o toque
  -- repetido em "Já fiz a doação") continua a responder 'ja_declarada' sem erro
  -- confuso, e quem foi travado agora passa daqui a 10 s.
  -- Texto para a pessoa (V2, no mapa de mensagens da rota):
  --   "Conclui primeiro o pagamento e depois carrega em «Já fiz a doação»."
  if v_doacao.estado = 'iniciada' then
    if now() - v_doacao.criada_em < interval '10 seconds' then
      raise exception 'declaracao_demasiado_rapida' using errcode = '22023';
    end if;

    update public.doacoes
       set estado = 'declarada', declarada_em = now()
     where id = p_id;
  end if;

  return jsonb_build_object(
    'status', case when v_doacao.estado = 'iniciada' then 'declarada' else 'ja_declarada' end,
    'id', p_id,
    'referencia', v_doacao.referencia,
    'valor_cents', v_doacao.valor_cents,
    'totais', public.vaquinha_totais());
end;
$function$;

-- ── vaquinha_totais: o número público. NUNCA devolve linhas individuais. ──
-- Sem config → ativa=false e zeros (o cartão mostra a linha simples, não um
-- bloco vazio). Com contar_pendentes = false, a_confirmar_cents sai a 0: o
-- interruptor é aplicado AQUI, para nenhum cliente poder mostrar pendentes.
create or replace function public.vaquinha_totais()
returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg   public.vaquinha_config%rowtype;
  v_conf  bigint := 0;
  v_pend  bigint := 0;
  v_n     integer := 0;
begin
  select * into v_cfg from public.vaquinha_config where id;
  if not found then
    return jsonb_build_object(
      'confirmado_cents',0,'a_confirmar_cents',0,'n_contribuicoes',0,
      'meta_cents',null,'ativa',false,'inicio',null,'fim',null,
      'contar_pendentes',true);
  end if;

  select coalesce(sum(valor_cents) filter (where estado = 'confirmada'), 0),
         coalesce(sum(valor_cents) filter (where estado = 'declarada'), 0),
         count(*) filter (where estado in ('confirmada','declarada'))::integer
    into v_conf, v_pend, v_n
    from public.doacoes;

  return jsonb_build_object(
    'confirmado_cents', v_conf,
    'a_confirmar_cents', case when v_cfg.contar_pendentes then v_pend else 0 end,
    'n_contribuicoes', v_n,
    'meta_cents', v_cfg.meta_cents,
    'ativa', v_cfg.ativa,
    'inicio', v_cfg.inicio,
    'fim', v_cfg.fim,
    'contar_pendentes', v_cfg.contar_pendentes);
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RPCs DE ADMIN (V5 — voluntário no telemóvel durante o evento)
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificação da chave: sha256() do core sobre convert_to(...,'utf8'), em hex.
-- Sem pgcrypto, sem crypt()/gen_salt() e sem depender do schema `extensions`.
-- admin_chave_hash nulo (sem seed) → 'admin_nao_configurado', nunca um bypass.
create or replace function public.admin_listar_doacoes(
  p_chave  text,
  p_limite integer default 50
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg      public.vaquinha_config%rowtype;
  v_lista    jsonb;
  v_limite   integer;
begin
  select * into v_cfg from public.vaquinha_config where id;
  if not found or v_cfg.admin_chave_hash is null then
    raise exception 'admin_nao_configurado' using errcode = '22023';
  end if;
  if p_chave is null
     or encode(sha256(convert_to(p_chave, 'utf8')), 'hex') <> v_cfg.admin_chave_hash then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  v_limite := least(greatest(coalesce(p_limite, 50), 1), 200);

  -- As 'declarada' primeiro (é a fila de trabalho do voluntário), depois as
  -- recentes das últimas 24 h para ele poder corrigir uma decisão. Nunca
  -- devolve posse_token nem ip_hash: não são precisos para decidir.
  select coalesce(jsonb_agg(linha order by ordem, quando desc nulls last), '[]'::jsonb)
    into v_lista
    from (
      select jsonb_build_object(
               'id', d.id, 'referencia', d.referencia, 'valor_cents', d.valor_cents,
               'metodo', d.metodo, 'estado', d.estado,
               'criada_em', d.criada_em, 'declarada_em', d.declarada_em,
               'decidida_em', d.decidida_em, 'nota', d.nota) as linha,
             case when d.estado = 'declarada' then 0 else 1 end as ordem,
             coalesce(d.declarada_em, d.criada_em) as quando
        from public.doacoes d
       where d.estado = 'declarada'
          or d.criada_em > now() - interval '24 hours'
       order by ordem, quando desc nulls last
       limit v_limite
    ) t;

  return jsonb_build_object('ok',true,'doacoes',v_lista,'totais',public.vaquinha_totais());
end;
$function$;

-- Decide: 'confirmada' (dinheiro recebido) ou 'anulada' (não recebido,
-- duplicado, teste). Aceita partir de 'iniciada' ou 'declarada' — um voluntário
-- pode confirmar um pagamento que a pessoa fez sem tocar em "Já fiz a doação".
-- Permite também corrigir uma decisão anterior (é um evento ao vivo, com fila):
-- por isso confirmada ↔ anulada é reversível, sempre com decidida_em novo.
create or replace function public.admin_decidir_doacao(
  p_chave  text,
  p_id     uuid,
  p_estado text,
  p_nota   text default null::text
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg    public.vaquinha_config%rowtype;
  v_doacao public.doacoes%rowtype;
begin
  select * into v_cfg from public.vaquinha_config where id;
  if not found or v_cfg.admin_chave_hash is null then
    raise exception 'admin_nao_configurado' using errcode = '22023';
  end if;
  if p_chave is null
     or encode(sha256(convert_to(p_chave, 'utf8')), 'hex') <> v_cfg.admin_chave_hash then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  if p_estado is null or p_estado not in ('confirmada','anulada') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;

  select * into v_doacao from public.doacoes where id = p_id for update;
  if v_doacao.id is null then
    raise exception 'doacao_nao_encontrada' using errcode = '22023';
  end if;

  update public.doacoes
     set estado = p_estado, decidida_em = now(), nota = p_nota
   where id = p_id;

  return jsonb_build_object(
    'ok',true,'id',p_id,'referencia',v_doacao.referencia,'estado',p_estado,
    'valor_cents',v_doacao.valor_cents,'nota',p_nota,
    'totais',public.vaquinha_totais());
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. GRANTS (nada por omissão: revoke all + grant explícito)
-- ═══════════════════════════════════════════════════════════════════════════
-- As admin também vão a anon — de propósito: o Next não tem service_role em
-- produção e é a chave (≥32 chars aleatórios) que autoriza, não o role. A
-- palavra-passe humana do V5 é uma env separada, comparada no Next.

revoke all on function public.iniciar_doacao(integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.declarar_doacao(uuid, text)               from public, anon, authenticated;
revoke all on function public.vaquinha_totais()                         from public, anon, authenticated;
revoke all on function public.admin_listar_doacoes(text, integer)       from public, anon, authenticated;
revoke all on function public.admin_decidir_doacao(text, uuid, text, text) from public, anon, authenticated;

grant execute on function public.iniciar_doacao(integer, text, uuid, text)
  to anon, authenticated, service_role;
grant execute on function public.declarar_doacao(uuid, text)
  to anon, authenticated, service_role;
grant execute on function public.vaquinha_totais()
  to anon, authenticated, service_role;
grant execute on function public.admin_listar_doacoes(text, integer)
  to anon, authenticated, service_role;
grant execute on function public.admin_decidir_doacao(text, uuid, text, text)
  to anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. LEDGER
-- ═══════════════════════════════════════════════════════════════════════════
-- A 0013 (cron) nunca foi registada em ledger nenhum, embora o job
-- 'drenar-emails' exista: fica registada aqui, retroativamente, para o ledger
-- voltar a ser a lista do que está aplicado.
insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0013_cron_emails','mcp','Registo retroativo (13/10/2026): o job pg_cron drenar-emails já existia sem linha no ledger.'),
  ('0014_vaquinha','mcp','Vaquinha ONG Atos: vaquinha_config + doacoes (RLS sem políticas), 5 RPCs SECURITY DEFINER, posse por token, idem_key anti duplo clique, chave admin por sha256 do core. SEM SEED (D1 em aberto).')
on conflict (nome) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. VERIFICAÇÃO (correr depois de aplicar — nenhuma escreve nada)
-- ═══════════════════════════════════════════════════════════════════════════
-- 6.1 Uma única assinatura por RPC e todas SECURITY DEFINER (prosecdef = true):
--
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('iniciar_doacao','declarar_doacao','vaquinha_totais',
--                      'admin_listar_doacoes','admin_decidir_doacao')
--  order by p.proname;
--   Esperado: 5 linhas, args exatamente como acima, prosecdef = true nas 5.
--
-- 6.2 Grants efetivos (só anon/authenticated/service_role com EXECUTE; PUBLIC não):
--
-- select p.proname, coalesce(r.rolname, 'PUBLIC') as role, a.privilege_type
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
--   left join pg_roles r on r.oid = a.grantee
--  where n.nspname = 'public'
--    and p.proname in ('iniciar_doacao','declarar_doacao','vaquinha_totais',
--                      'admin_listar_doacoes','admin_decidir_doacao')
--  order by p.proname, role;
--   Esperado: 3 linhas EXECUTE por RPC (anon, authenticated, service_role).
--
-- 6.3 RLS ativa nas duas tabelas e ZERO políticas:
--
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity
--   from pg_class c where c.relnamespace = 'public'::regnamespace
--    and c.relname in ('vaquinha_config','doacoes');
-- select count(*) as politicas from pg_policies
--  where schemaname = 'public' and tablename in ('vaquinha_config','doacoes');
--   Esperado: relrowsecurity = true nas duas, politicas = 0.
--
-- 6.4 Sem seed, os totais devolvem zeros com ativa = false (nunca um erro):
--
-- select public.vaquinha_totais();
--   Esperado: {"ativa": false, "meta_cents": null, "a_confirmar_cents": 0,
--              "confirmado_cents": 0, "n_contribuicoes": 0, ...}
--
-- 6.5 E iniciar_doacao recusa com 'vaquinha_nao_configurada' (22023):
--
-- select public.iniciar_doacao(1000, 'mbway', gen_random_uuid(), null);
--
-- 6.6 Depois do seed (quando houver meta), a prova de ponta a ponta faz-se com
--     o percurso real do V6 — nunca escrevendo doações direto na base.
--
-- 6.7 O travão anti-bot do declarar_doacao (só depois do seed, com uma doação
--     descartável, dentro de uma transação que volta atrás):
--
-- begin;
--   select public.iniciar_doacao(1000, 'mbway', gen_random_uuid(), null);  -- guarda o id
--   select public.declarar_doacao('<id>', '<posse_token>');
--   -- Esperado: ERROR 'declaracao_demasiado_rapida' (22023), nada escrito.
-- rollback;
--
-- 6.8 Geração das referências — 10 000 sorteios, todas com length = 9.
--     Reproduz a mesma expressão do iniciar_doacao (o bloco não escreve nada e
--     por isso pode correr sem seed, ao contrário do 6.7).
--
-- do $$
-- declare
--   v_alfabeto text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
--   v_ref      text;
--   v_curtas   integer := 0;
--   v_n        integer := 10000;
--   v_i        integer;
--   v_k        integer;
-- begin
--   if length(v_alfabeto) <> 31 then
--     raise exception 'alfabeto com % simbolos (esperado 31)', length(v_alfabeto);
--   end if;
--   for v_i in 1..v_n loop
--     v_ref := 'ATOS-';
--     for v_k in 1..4 loop
--       v_ref := v_ref || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::integer, 1);
--     end loop;
--     if length(v_ref) <> 9 then
--       v_curtas := v_curtas + 1;
--       if v_curtas <= 3 then raise notice 'referencia curta: %', v_ref; end if;
--     end if;
--   end loop;
--   raise notice 'referencias com length <> 9 em %: %', v_n, v_curtas;
-- end $$;
--   Esperado: NOTICE "referencias com length <> 9 em 10000: 0".
--   (Com o cast sem floor este número ficava ~630 — era o bug de arredondamento.)
