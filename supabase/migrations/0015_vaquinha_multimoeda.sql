-- 0015_vaquinha_multimoeda.sql — canais de pagamento em GBP (Wise) e BRL (Pix)
-- Decisão do Lucas, 21/10/2026. Aplicar pelo SQL Editor.
--
-- ── A REGRA QUE DEFINE O DESENHO ─────────────────────────────────────────────
-- O EURO É A UNIDADE DE CONTA. As colunas novas guardam apenas o que foi
-- MOSTRADO a quem doou (o valor convertido e o câmbio usado), para a Vitória
-- reconciliar depois. O valor da doação continua a ser valor_cents, em euros:
-- por isso o CHECK (valor_cents >= 500), o teto de 1.000 €, a meta de 2.000 €
-- e o contador NÃO mudam — e uma flutuação do câmbio não mexe em nenhum deles.
--
-- ── PORQUE UMA SÓ ASSINATURA ─────────────────────────────────────────────────
-- A rota chama iniciar_doacao por nome. Acrescentar parâmetros com default com
-- CREATE OR REPLACE criaria uma SOBRECARGA (duas funções com o mesmo nome), e
-- as chamadas ficariam ambíguas. Por isso: cria-se a assinatura nova completa
-- e a seguir DROP da antiga de 4 argumentos. O resultado é UMA função.
--
-- ── ORDEM DE DEPLOY ──────────────────────────────────────────────────────────
-- Esta migração vai para a base ANTES do deploy do código. É retrocompatível
-- com o código que está em produção: essa versão só envia os 4 parâmetros
-- antigos, e os novos têm default — a única função que resta aceita-os.
--
-- ── O QUE NÃO MUDA ───────────────────────────────────────────────────────────
-- Gates de servidor (ativa / abriu / fechou), posse por posse_token, idem_key
-- anti duplo clique, travão dos 10 s, sinal grosso de abuso por ip_hash, RLS
-- sem políticas, chave admin por sha256 do core, vaquinha_totais() e o modelo
-- de confiança da 0014c.
-- As RPCs de admin mudam SÓ para acrescentar os campos de moeda à resposta
-- (secção 3): mesma assinatura, mesmos filtros, mesma chave, e continuam a
-- nunca devolver posse_token nem ip_hash.
--
-- DOWN (rollback): PRIMEIRO apaga a assinatura de 8 argumentos, DEPOIS repõe a
--   de 4 (pela 0014b) — pela ordem inversa ficariam duas funções:
--   drop function public.iniciar_doacao(integer, text, uuid, text, integer, numeric, date, text);
--   alter table public.doacoes
--     drop constraint if exists doacoes_metodo_check,
--     drop constraint if exists doacoes_moeda_check,
--     drop constraint if exists doacoes_valor_moeda_cents_check,
--     drop constraint if exists doacoes_cambio_usado_check;
--   alter table public.doacoes
--     add constraint doacoes_metodo_check check (metodo in ('mbway','transferencia'));
--   alter table public.doacoes
--     drop column if exists moeda,
--     drop column if exists valor_moeda_cents,
--     drop column if exists cambio_usado,
--     drop column if exists cambio_data;
--   delete from public.migrations_aplicadas where nome = '0015_vaquinha_multimoeda';
--   NOTA: o rollback SÓ é seguro se não existirem linhas com metodo wise_gbp/pix_brl.
--   As duas RPCs de admin também têm de voltar ao corpo da 0014 (lista) e da
--   0014c (procura) — sem isso continuariam a ler colunas que já não existem.

-- Uma transação só: entre o CREATE da assinatura nova e o DROP da antiga as duas funções coexistem, e a chamada antiga (4 argumentos nomeados) encaixa nas duas — o Postgres devolve «function iniciar_doacao is not unique».
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. MÉTODOS E COLUNAS NOVAS
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.doacoes drop constraint if exists doacoes_metodo_check;
alter table public.doacoes add constraint doacoes_metodo_check
  check (metodo in ('mbway', 'transferencia', 'wise_gbp', 'pix_brl'));

-- As linhas que já existem ficam com moeda = 'EUR' por omissão, que é o que
-- são. valor_moeda_cents, cambio_usado e cambio_data ficam NULL nelas — não
-- houve conversão nenhuma a mostrar.
alter table public.doacoes
  add column if not exists moeda             text not null default 'EUR',
  add column if not exists valor_moeda_cents integer,
  add column if not exists cambio_usado      numeric(12,6),
  add column if not exists cambio_data       date;

alter table public.doacoes drop constraint if exists doacoes_moeda_check;
alter table public.doacoes add constraint doacoes_moeda_check
  check (moeda in ('EUR', 'GBP', 'BRL'));

alter table public.doacoes drop constraint if exists doacoes_valor_moeda_cents_check;
alter table public.doacoes add constraint doacoes_valor_moeda_cents_check
  check (valor_moeda_cents is null or valor_moeda_cents > 0);

alter table public.doacoes drop constraint if exists doacoes_cambio_usado_check;
alter table public.doacoes add constraint doacoes_cambio_usado_check
  check (cambio_usado is null or cambio_usado > 0);

comment on column public.doacoes.valor_moeda_cents is
  'Valor indicativo mostrado na moeda escolhida. NAO e o valor da doacao — esse e valor_cents, em euros.';
comment on column public.doacoes.cambio_usado is
  'Taxa EUR->moeda usada no ecra (BCE ou taxa de recurso). Informacao de reconciliacao, nunca fonte de verdade.';
comment on column public.doacoes.cambio_data is
  'Data de referencia do BCE. NULL quando foi usada a taxa de recurso.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. iniciar_doacao — quatro canais, uma só assinatura
-- ═══════════════════════════════════════════════════════════════════════════
-- A moeda NÃO é escolhida pelo cliente: é derivada do canal. Nos canais em
-- euros os campos estrangeiros são forçados a NULL; nos canais estrangeiros o
-- valor mostrado e o câmbio são obrigatórios. A RPC valida isso mesmo — a rota
-- preenche os campos, mas a autoridade é aqui.
create or replace function public.iniciar_doacao(
  p_valor_cents      integer,
  p_metodo           text,
  p_idem_key         uuid,
  p_moeda            text    default 'EUR'::text,
  p_valor_moeda_cents integer default null::integer,
  p_cambio           numeric default null::numeric,
  p_cambio_data      date    default null::date,
  p_ip_hash          text    default null::text
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
  v_moeda     text;
  v_valor_moeda integer;
  v_cambio    numeric;
  v_cambio_data date;
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
  if p_metodo is null
     or p_metodo not in ('mbway', 'transferencia', 'wise_gbp', 'pix_brl') then
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

  -- 3.1 A moeda é do canal, não da pessoa que doa.
  if (p_metodo in ('mbway', 'transferencia') and coalesce(p_moeda, 'EUR') <> 'EUR')
     or (p_metodo = 'wise_gbp' and p_moeda is distinct from 'GBP')
     or (p_metodo = 'pix_brl'  and p_moeda is distinct from 'BRL') then
    raise exception 'moeda_invalida' using errcode = '22023';
  end if;

  if p_metodo in ('mbway', 'transferencia') then
    -- Canais em euros: os campos de conversão não se aceitam do cliente,
    -- mesmo que venham preenchidos. Ficam NULL.
    v_moeda       := 'EUR';
    v_valor_moeda := null;
    v_cambio      := null;
    v_cambio_data := null;
  else
    if p_valor_moeda_cents is null or p_valor_moeda_cents <= 0
       or p_cambio is null or p_cambio <= 0 then
      raise exception 'moeda_invalida' using errcode = '22023';
    end if;
    v_moeda       := p_moeda;
    v_valor_moeda := p_valor_moeda_cents;
    v_cambio      := p_cambio;
    v_cambio_data := p_cambio_data;
  end if;

  -- 4. Sinal grosso de abuso por ip_hash: 200 em 10 min. Deliberadamente LARGO —
  --    a sala inteira partilha o mesmo IP público no evento, e a defesa real é o
  --    idem_key + a anulação manual no V5. Conta SÓ as linhas que continuam em
  --    'iniciada': quem está mesmo a doar sai desse estado em minutos.
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
      'metodo',v_existente.metodo,'estado',v_existente.estado,
      'moeda',v_existente.moeda,'valor_moeda_cents',v_existente.valor_moeda_cents,
      'cambio_usado',v_existente.cambio_usado,'cambio_data',v_existente.cambio_data);
  end if;

  -- 6. Token de posse — mesmo padrão da 0009: dois uuid sem hífenes.
  --    gen_random_uuid() é CORE (pg_catalog) e por isso resolve com
  --    search_path = ''; gen_random_bytes() seria de extensão e exigiria
  --    qualificar o schema — de propósito não se usa.
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');

  -- 7. Inserir com referência única. 31^4 ≈ 923 mil combinações; a colisão é
  --    improvável mas tratada (retry) e, em corrida, o idem_key ganha.
  --    floor() é OBRIGATÓRIO: o cast de double precision para integer em
  --    Postgres ARREDONDA (não trunca); sem ele ~6% das referências sairiam
  --    com 3 caracteres. Ver 6.8.
  for v_tentativa in 1..12 loop
    v_ref := 'ATOS-';
    for v_k in 1..4 loop
      v_ref := v_ref || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::integer, 1);
    end loop;

    begin
      insert into public.doacoes
        (referencia, valor_cents, metodo, posse_token, idem_key, ip_hash,
         moeda, valor_moeda_cents, cambio_usado, cambio_data)
      values
        (v_ref, p_valor_cents, p_metodo, v_token, p_idem_key, p_ip_hash,
         v_moeda, v_valor_moeda, v_cambio, v_cambio_data)
      returning id into v_id;

      return jsonb_build_object(
        'status','criada','id',v_id,'referencia',v_ref,'posse_token',v_token,
        'valor_cents',p_valor_cents,'metodo',p_metodo,'estado','iniciada',
        'moeda',v_moeda,'valor_moeda_cents',v_valor_moeda,
        'cambio_usado',v_cambio,'cambio_data',v_cambio_data);
    exception when unique_violation then
      -- Corrida no idem_key (dois cliques simultâneos): devolve quem ganhou.
      select * into v_existente from public.doacoes where idem_key = p_idem_key;
      if found then
        return jsonb_build_object(
          'status','existente','id',v_existente.id,'referencia',v_existente.referencia,
          'posse_token',v_existente.posse_token,'valor_cents',v_existente.valor_cents,
          'metodo',v_existente.metodo,'estado',v_existente.estado,
          'moeda',v_existente.moeda,'valor_moeda_cents',v_existente.valor_moeda_cents,
          'cambio_usado',v_existente.cambio_usado,'cambio_data',v_existente.cambio_data);
      end if;
      -- Senão foi colisão de referência: volta a tentar com outra.
    end;
  end loop;

  raise exception 'referencia_indisponivel' using errcode = '22023';
end;
$function$;

-- A antiga assinatura de 4 argumentos desaparece: sem isto ficariam DUAS
-- funções com o mesmo nome (sobrecarga) e as chamadas ambíguas.

-- NOTA DE PRODUÇÃO (21/10/2026): nesta base de dados este DROP NÃO foi executado.
-- O event trigger `pgrst_drop_watch` do Supabase faz com que qualquer DROP FUNCTION
-- não devolva resposta pelo transporte MCP (o servidor executa, a resposta não volta).
-- Em produção a assinatura antiga foi RENOMEADA na mesma transação:
--     alter function public.iniciar_doacao(integer, text, uuid, text)
--       rename to iniciar_doacao_v4_obsoleta;
--     revoke all on function public.iniciar_doacao_v4_obsoleta(integer, text, uuid, text)
--       from public, anon, authenticated;
-- Estado final equivalente: uma só função chamável `public.iniciar_doacao`, a de 8 argumentos.
-- Limpeza pendente, a correr pelo SQL editor do Supabase quando for conveniente:
--     drop function if exists public.iniciar_doacao_v4_obsoleta(integer, text, uuid, text);
--     drop function if exists public.zz_apagar_probe_doacao(integer, text, uuid, text, integer, numeric, date, text);
--     drop function if exists public.zz_apagar_probe_trivial(integer);
-- Numa base de dados nova este DROP funciona normalmente e deve ficar aqui.
drop function if exists public.iniciar_doacao(integer, text, uuid, text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RPCs DE ADMIN — o painel da Vitória passa a ver a moeda
-- ═══════════════════════════════════════════════════════════════════════════
-- Sem isto, uma doação por Pix aparecia à Vitória como «10 €» quando a pessoa
-- enviou R$62,41, e ela não tinha como reconciliar o extrato. As três colunas
-- novas vão na MESMA forma de linha das duas RPCs de admin (o painel reutiliza
-- o cartão), e são só de leitura: continuam a nunca devolver posse_token nem
-- ip_hash.
--
-- Mesma assinatura das 0014/0014c, por isso CREATE OR REPLACE conserva os
-- grants existentes; mesmo assim eles voltam a ser afirmados na secção 4.
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
  -- recentes das últimas 24 h para ele poder corrigir uma decisão.
  select coalesce(jsonb_agg(linha order by ordem, quando desc nulls last), '[]'::jsonb)
    into v_lista
    from (
      select jsonb_build_object(
               'id', d.id, 'referencia', d.referencia, 'valor_cents', d.valor_cents,
               'metodo', d.metodo, 'estado', d.estado,
               'moeda', d.moeda, 'valor_moeda_cents', d.valor_moeda_cents,
               'cambio_usado', d.cambio_usado, 'cambio_data', d.cambio_data,
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

-- Procura por referência (0014c): a MESMA forma de linha, com os campos de
-- moeda, para o cartão do resultado mostrar o valor enviado.
create or replace function public.admin_procurar_doacao(
  p_chave      text,
  p_referencia text,
  p_limite     integer default 20
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg    public.vaquinha_config%rowtype;
  v_termo  text;
  v_lista  jsonb;
  v_limite integer;
begin
  select * into v_cfg from public.vaquinha_config where id;
  if not found or v_cfg.admin_chave_hash is null then
    raise exception 'admin_nao_configurado' using errcode = '22023';
  end if;
  if p_chave is null
     or encode(sha256(convert_to(p_chave, 'utf8')), 'hex') <> v_cfg.admin_chave_hash then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  -- Normalização: `ATOS-83P2` / `atos 83p2` / `83P2` → `ATOS83P2` / `83P2`.
  v_termo := regexp_replace(upper(coalesce(p_referencia, '')), '[^A-Z0-9]', '', 'g');
  if v_termo = '' then
    raise exception 'referencia_obrigatoria' using errcode = '22023';
  end if;

  v_limite := least(greatest(coalesce(p_limite, 20), 1), 100);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'referencia', d.referencia, 'valor_cents', d.valor_cents,
           'metodo', d.metodo, 'estado', d.estado,
           'moeda', d.moeda, 'valor_moeda_cents', d.valor_moeda_cents,
           'cambio_usado', d.cambio_usado, 'cambio_data', d.cambio_data,
           'criada_em', d.criada_em, 'declarada_em', d.declarada_em,
           'decidida_em', d.decidida_em, 'nota', d.nota)
         order by d.criada_em desc), '[]'::jsonb)
    into v_lista
    from public.doacoes d
   where replace(d.referencia, '-', '') like '%' || v_termo || '%'
   limit v_limite;

  return jsonb_build_object(
    'ok', true, 'termo', v_termo, 'doacoes', v_lista,
    'totais', public.vaquinha_totais());
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. GRANTS (nada por omissão: revoke all + grant explícito)
-- ═══════════════════════════════════════════════════════════════════════════
revoke all on function
  public.iniciar_doacao(integer, text, uuid, text, integer, numeric, date, text)
  from public, anon, authenticated;

grant execute on function
  public.iniciar_doacao(integer, text, uuid, text, integer, numeric, date, text)
  to anon, authenticated, service_role;

-- As duas de admin mantêm a assinatura e por isso conservam os grants; são
-- reafirmados para o ficheiro continuar a ser a lista completa do que fica.
revoke all on function public.admin_listar_doacoes(text, integer)
  from public, anon, authenticated;
revoke all on function public.admin_procurar_doacao(text, text, integer)
  from public, anon, authenticated;

grant execute on function public.admin_listar_doacoes(text, integer)
  to anon, authenticated, service_role;
grant execute on function public.admin_procurar_doacao(text, text, integer)
  to anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. LEDGER
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0015_vaquinha_multimoeda','sql_editor','Canais wise_gbp e pix_brl. Euro continua a unidade de conta (valor_cents); colunas moeda/valor_moeda_cents/cambio_usado/cambio_data guardam o que foi mostrado. iniciar_doacao substituida na assinatura de 8 argumentos; a de 4 foi apagada (sem sobrecarga). admin_listar_doacoes e admin_procurar_doacao devolvem os campos de moeda para o painel reconciliar.')
on conflict (nome) do nothing;

-- O PostgREST guarda em cache as assinaturas: sem este aviso, a rota podia
-- continuar a ver a função antiga até ao próximo reload.
-- O NOTIFY é transacional: só chega ao PostgREST neste COMMIT, já com a
-- assinatura antiga apagada — nunca a meio do bloco.
notify pgrst, 'reload schema';

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. VERIFICAÇÃO (correr depois de aplicar — nenhuma escreve nada)
-- ═══════════════════════════════════════════════════════════════════════════
-- 6.1 UMA só assinatura de iniciar_doacao, SECURITY DEFINER:
--
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname = 'iniciar_doacao';
--   Esperado: 1 linha, args = "integer, text, uuid, text, integer, numeric,
--             date, text", prosecdef = true.
--
-- 6.2 O CHECK novo e as colunas:
--
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.doacoes'::regclass and conname = 'doacoes_metodo_check';
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'doacoes'
--    and column_name in ('moeda','valor_moeda_cents','cambio_usado','cambio_data');
--   Esperado: CHECK (metodo = ANY (ARRAY['mbway','transferencia','wise_gbp','pix_brl']))
--             e moeda not null default 'EUR'.
--
-- 6.3 As linhas que já existem são euros e não têm conversão (no momento da
--     migração não pode haver outra coisa: o CHECK antigo só aceitava os dois
--     canais em euros):
--
-- select count(*) filter (where moeda <> 'EUR') as estrangeiras,
--        count(*) filter (where valor_moeda_cents is not null) as com_valor_moeda
--   from public.doacoes;
--   Esperado: 0 e 0.
--
-- 6.4 Uma doação em euros ainda entra — com a chamada ANTIGA, só com 3
--     argumentos, que é como o código em produção a faz (os restantes ficam no
--     default). É o teste que prova a retrocompatibilidade da migração:
--
-- begin;
--   select public.iniciar_doacao(1000, 'mbway', gen_random_uuid());
--   -- Esperado: status 'criada', moeda 'EUR', valor_moeda_cents null.
-- rollback;
--
-- 6.5 Um Pix grava euros + o valor mostrado:
--
-- begin;
--   select public.iniciar_doacao(1000, 'pix_brl', gen_random_uuid(), 'BRL', 6200, 6.2, date '2026-10-21');
--   -- Esperado: valor_cents 1000, moeda 'BRL', valor_moeda_cents 6200.
-- rollback;
--
-- 6.6 Recusas: moeda trocada, valor mostrado ausente e método antigo ('link'):
--
-- begin;
--   select public.iniciar_doacao(1000, 'pix_brl', gen_random_uuid(), 'EUR', 6200, 6.2, date '2026-10-21');
--   -- Esperado: ERROR 'moeda_invalida'.
--   select public.iniciar_doacao(1000, 'wise_gbp', gen_random_uuid(), 'GBP', null, 0.87, date '2026-10-21');
--   -- Esperado: ERROR 'moeda_invalida'.
--   select public.iniciar_doacao(1000, 'link', gen_random_uuid(), 'EUR');
--   -- Esperado: ERROR 'invalid_metodo'.
-- rollback;
--
-- 6.7 O contador e a meta não se mexeram (só se os seus valores não mudarem
--     durante a janela; comparar com o valor lido antes de aplicar):
--
-- select public.vaquinha_totais();
--
-- 6.8 As duas RPCs de admin devolvem os campos de moeda (verificação estática,
--     sem precisar da chave admin):
--
-- select pg_get_functiondef('public.admin_listar_doacoes(text,integer)'::regprocedure)
--          like '%valor_moeda_cents%' as lista_ok,
--        pg_get_functiondef('public.admin_procurar_doacao(text,text,integer)'::regprocedure)
--          like '%valor_moeda_cents%' as procura_ok;
--   Esperado: true e true.
