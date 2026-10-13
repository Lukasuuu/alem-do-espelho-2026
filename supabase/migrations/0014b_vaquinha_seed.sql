-- 0014b_vaquinha_seed.sql — seed da configuração, métodos fechados e totais sem contagem
--
-- Bloco seguinte do DECISOES-VAQUINHA.md (fonte de verdade, 13/10/2026), secção 3.
-- Escrita para ser aplicada pelo conector Supabase (MCP). NÃO aplicar sem ordem do Lucas.
--
-- O que faz, e porquê:
--
--  1. SEED da linha única de vaquinha_config. Sem esta linha, iniciar_doacao
--     levantava 'vaquinha_nao_configurada' e vaquinha_totais() devolvia
--     ativa = false — era o estado combinado enquanto a meta não estava fechada.
--     Agora está: meta 5000 € (decisão do Lucas, 13/10).
--
--  2. Métodos passam a ser SÓ mbway e transferencia (revisão 2 de 13/10: não há
--     link de pagamento na vaquinha, o D3 desapareceu). A tabela está vazia,
--     mas o guard abaixo recusa-se a correr se não estiver — apertar a
--     constraint com dados dentro falharia a meio ou, pior, deixaria linhas
--     inválidas.
--
--  3. vaquinha_totais() deixa de devolver n_contribuicoes. A decisão é NUNCA
--     mostrar quantas contribuições houve — e tirá-lo só do ecrã não chegava:
--     a função é chamável por anon em /rest/v1/rpc. Isto resolve também a
--     inconsistência antiga (com contar_pendentes = false o número continuava a
--     contar as 'declarada', sem sentido nenhum se não é mostrado).
--
-- NÃO muda: posse por posse_token, idem_key, o travão de 10 s do
-- declarar_doacao, o sinal de abuso por ip_hash (só sobre 'iniciada'), a
-- aplicação de contar_pendentes NO SERVIDOR (a_confirmar_cents = 0 quando
-- false, e é isso que faz o segmento às riscas desaparecer), nem as RPCs admin.
--
-- CHAVE ADMIN: o admin_chave_hash abaixo é o sha256 em hex da chave guardada na
-- Vercel como VAQUINHA_ADMIN_CHAVE (server-only, Production + Preview do ramo
-- feat/vaquinha). A chave NÃO está no repositório nem em nenhuma mensagem — só
-- este hash, que sem a chave não serve de nada. A rota do V5 tem de fazer
-- `process.env.VAQUINHA_ADMIN_CHAVE.trim()` antes de enviar: o valor vem de uma
-- env var e um espaço acidental no fim mudaria o hash em silêncio.
--
-- DOWN (rollback): repor o corpo da 0014 em iniciar_doacao e vaquinha_totais()
--   (o original está em supabase/migrations/0014_vaquinha.sql), repor
--   `check (metodo in ('link','mbway','transferencia'))`, apagar a linha de
--   vaquinha_config e a linha do ledger '0014b_vaquinha_seed'.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Seed da configuração (linha única, idempotente)
-- ═══════════════════════════════════════════════════════════════════════════
-- inicio espelha VAQUINHA_INICIO_ISO / EVENTO_ISO — o mesmo instante que o
-- cronómetro do hero usa para a troca no zero (17/10/2026, 09h30 Lisboa).
-- fim = null: o D6 continua em aberto com a Vitória; muda-se depois por SQL,
-- sem deploy (o cartão lê `fim` de vaquinha_totais() e o servidor é a autoridade).
insert into public.vaquinha_config
  (id, inicio, fim, meta_cents, ativa, contar_pendentes, valor_max_cents, admin_chave_hash)
values
  (true, '2026-10-17T09:30:00+01:00'::timestamptz, null, 500000, true, true, 100000,
   '171af896c85184acb5264d839bc99eb044ae02dfdd58e2ae7c0daa09060de7c8')
on conflict (id) do update set
  inicio           = excluded.inicio,
  fim              = excluded.fim,
  meta_cents       = excluded.meta_cents,
  ativa            = excluded.ativa,
  contar_pendentes = excluded.contar_pendentes,
  valor_max_cents  = excluded.valor_max_cents,
  admin_chave_hash = excluded.admin_chave_hash;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Métodos: só MB Way e transferência
-- ═══════════════════════════════════════════════════════════════════════════
do $guard$
begin
  if exists (select 1 from public.doacoes) then
    raise exception 'doacoes nao esta vazia — fecha primeiro os metodos das linhas existentes';
  end if;
end;
$guard$;

alter table public.doacoes drop constraint if exists doacoes_metodo_check;
alter table public.doacoes
  add constraint doacoes_metodo_check check (metodo in ('mbway','transferencia'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. iniciar_doacao — validação do método com os mesmos dois valores
-- ═══════════════════════════════════════════════════════════════════════════
-- Corpo igual ao da 0014: o que muda é só a lista de métodos aceites. Substituir
-- a função (e não deixar a antiga) evita a sobrecarga — a assinatura é a mesma,
-- por isso os grants da 0014 mantêm-se, mas voltam a ser afirmados no fim.
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
  -- 1. Configuração (linha única). Agora com seed, mas o ramo fica: a linha
  --    pode ser apagada numa limpeza e nunca pode dar um 500.
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

  -- 3. Validação da fronteira — SÓ mbway e transferencia (13/10)
  if p_metodo is null or p_metodo not in ('mbway','transferencia') then
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

  -- 4. Sinal grosso de abuso: 200 em 10 min, contando SÓ as linhas que
  --    continuam em 'iniciada'. Quem está mesmo a doar sai desse estado em
  --    minutos; um flood de linhas que nunca declaram bate no limite. Contar
  --    tudo faria 100 pessoas × 2 tentativas = 200 e bloquearia a sala inteira
  --    no Wi-Fi do hotel (todas atrás do mesmo IP público).
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

  -- 6. Token de posse — padrão da 0009: dois uuid sem hífenes. gen_random_uuid()
  --    é do core e resolve com search_path = '' (nada de gen_random_bytes, que
  --    exigiria qualificar o schema da extensão).
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');

  -- 7. Referência única: floor() é OBRIGATÓRIO — o cast de double precision para
  --    integer em Postgres ARREDONDA, e sem ele a posição chegava a 32 e o
  --    substr devolvia vazio (~6% das referências com 3 caracteres).
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. vaquinha_totais — sem n_contribuicoes
-- ═══════════════════════════════════════════════════════════════════════════
-- O número de contribuições SAI da resposta (não basta esconder no ecrã: a
-- função é chamável por anon). Fica tudo o resto igual, incluindo a aplicação
-- de contar_pendentes no servidor — é isso que faz o segmento às riscas da
-- barra desaparecer quando o interruptor está em false.
create or replace function public.vaquinha_totais()
returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg  public.vaquinha_config%rowtype;
  v_conf bigint := 0;
  v_pend bigint := 0;
begin
  select * into v_cfg from public.vaquinha_config where id;
  if not found then
    return jsonb_build_object(
      'confirmado_cents',0,'a_confirmar_cents',0,
      'meta_cents',null,'ativa',false,'inicio',null,'fim',null,
      'contar_pendentes',true);
  end if;

  select coalesce(sum(valor_cents) filter (where estado = 'confirmada'), 0),
         coalesce(sum(valor_cents) filter (where estado = 'declarada'), 0)
    into v_conf, v_pend
    from public.doacoes;

  return jsonb_build_object(
    'confirmado_cents', v_conf,
    'a_confirmar_cents', case when v_cfg.contar_pendentes then v_pend else 0 end,
    'meta_cents', v_cfg.meta_cents,
    'ativa', v_cfg.ativa,
    'inicio', v_cfg.inicio,
    'fim', v_cfg.fim,
    'contar_pendentes', v_cfg.contar_pendentes);
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. GRANTS (reafirmados — a assinatura não mudou, isto é cinto e suspensórios)
-- ═══════════════════════════════════════════════════════════════════════════
revoke all on function public.iniciar_doacao(integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.vaquinha_totais() from public, anon, authenticated;

grant execute on function public.iniciar_doacao(integer, text, uuid, text)
  to anon, authenticated, service_role;
grant execute on function public.vaquinha_totais()
  to anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. LEDGER
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0014b_vaquinha_seed','mcp','Seed da vaquinha_config (meta 5000 EUR, início 17/10 09h30, admin_chave_hash), métodos só mbway/transferencia e vaquinha_totais() sem n_contribuicoes.')
on conflict (nome) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. VERIFICAÇÃO (correr depois de aplicar — nenhuma escreve nada)
-- ═══════════════════════════════════════════════════════════════════════════
-- 7.1 Seed correto, com o hash de 64 hex e sem fim definido:
--
-- select inicio, fim, meta_cents, ativa, contar_pendentes, valor_max_cents,
--        length(admin_chave_hash) as hash_len,
--        admin_chave_hash ~ '^[0-9a-f]{64}$' as hash_ok
--   from public.vaquinha_config;
--   Esperado: 1 linha · inicio 2026-10-17 09:30+01 · fim null · meta_cents 500000
--             ativa true · contar_pendentes true · valor_max_cents 100000
--             hash_len 64 · hash_ok true
--
-- 7.2 Totais já com a meta e SEM n_contribuicoes (zeros, tabela vazia):
--
-- select public.vaquinha_totais();
--   Esperado: {"ativa": true, "fim": null, "meta_cents": 500000,
--              "inicio": "2026-10-17T08:30:00+00:00", "confirmado_cents": 0,
--              "a_confirmar_cents": 0, "contar_pendentes": true}
--   NÃO pode aparecer a chave "n_contribuicoes".
--
-- 7.3 A constraint dos métodos aceita só dois valores:
--
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.doacoes'::regclass and conname = 'doacoes_metodo_check';
--   Esperado: CHECK ((metodo = ANY (ARRAY['mbway'::text, 'transferencia'::text])))
--
-- select public.iniciar_doacao(1000, 'link', gen_random_uuid(), null);
--   Esperado: ERROR 'invalid_metodo' (22023)
--
-- 7.4 Uma assinatura por RPC e todas SECURITY DEFINER:
--
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('iniciar_doacao','declarar_doacao','vaquinha_totais',
--                      'admin_listar_doacoes','admin_decidir_doacao')
--  order by p.proname;
--   Esperado: 5 linhas, prosecdef = true nas 5.
--
-- 7.5 A prova ponta a ponta (iniciar → declarar → confirmar → barra) faz-se no
--     V6 com o percurso real, e as linhas de teste são anuladas e apagadas a
--     seguir — nunca se escrevem doações à mão para "ver se aparece".
