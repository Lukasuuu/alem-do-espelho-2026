-- 0014c_vaquinha_confianca.sql — modelo de CONFIANÇA (D8) e procura por referência
--
-- Decisão D8 do Lucas (14/10/2026). Substitui o modelo «só o confirmado conta»
-- da 0014 — que partia de uma premissa que se revelou errada para este evento:
-- o site NÃO sabe quem pagou. Só a conta da Vitória sabe, e não lhe vamos pedir
-- que confira tudo antes de o número mexer.
--
-- ── O MODELO NOVO ────────────────────────────────────────────────────────────
-- Quem carrega em «Já fiz a doação» está a dizer que pagou, e acreditamos.
--
--   iniciada   → escolheu valor e método, viu as instruções      (não conta)
--   declarada  → tocou em "Já fiz a doação"
--                · até ao limite de confiança → CONTA LOGO, sólido, sem confirmação
--                · acima do limite            → fica nas RISCA ("a confirmar")
--   confirmada → a Vitória confirmou o recebimento (D5)          (conta, sólido)
--   anulada    → não recebido, duplicado ou teste                (não conta)
--
-- ── A SALVAGUARDA ────────────────────────────────────────────────────────────
-- Uma declaração de 500 € sem confirmação seria uma afirmação grande de mais
-- para o site fazer por conta própria. Acima de limite_confianca_cents
-- (default 10000 = 100 €) a declarada fica nas riscas até a Vitória confirmar.
-- O limite é uma COLUNA, não uma constante no código: muda-se por SQL, sem
-- deploy, e o site acompanha (vai na resposta de vaquinha_totais()).
--
-- ── O TRAVÃO DE EMERGÊNCIA ───────────────────────────────────────────────────
-- contar_pendentes = false deixa de ser «esconde as pendentes» e passa a ser o
-- travão de emergência: nesse estado conta SÓ o confirmado e não há riscas
-- nenhumas. É a resposta a um ataque de declarações falsas (ou a um engano
-- grave): uma linha de SQL e o cartão volta ao modelo antigo, sem deploy.
--
-- ── QUEM CONFIRMA ────────────────────────────────────────────────────────────
-- D5 fechado: quem confirma é a Vitória, sozinha, pelo telemóvel, na página
-- /alem-do-espelho-2026/vaquinha/confirmar (V5). É por isso que a função de
-- procura por referência entra aqui: a Vitória encontra uma doação pela
-- referência que está no descritivo da transferência ou na mensagem do MB Way,
-- em QUALQUER estado e com QUALQUER idade — inclusive a 'iniciada' de quem
-- pagou e não carregou no botão.
--
-- ── O QUE NÃO MUDA ───────────────────────────────────────────────────────────
-- Posse por posse_token, idem_key anti duplo clique, o travão dos 10 s do
-- declarar_doacao, o sinal grosso de abuso por ip_hash (só sobre 'iniciada'),
-- as RPCs admin_listar_doacoes / admin_decidir_doacao, o RLS sem políticas e a
-- chave admin por sha256 do core. E NUNCA se devolve n_contribuicoes.
--
-- DOWN (rollback): repor em vaquinha_totais() o corpo da 0014b (está em
--   supabase/migrations/0014b_vaquinha_seed.sql) e apagar a função nova:
--   drop function if exists public.admin_procurar_doacao(text, text, integer);
--   alter table public.vaquinha_config
--     drop constraint if exists vaquinha_config_limite_confianca_check;
--   alter table public.vaquinha_config drop column if exists limite_confianca_cents;
--   delete from public.migrations_aplicadas where nome = '0014c_vaquinha_confianca';

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. O LIMITE DE CONFIANÇA (coluna, não constante)
-- ═══════════════════════════════════════════════════════════════════════════
-- `add column ... not null default 10000` é seguro na linha única que já existe
-- (o default preenche-a e o check passa). A 0014b NÃO é reescrita: o default
-- desta coluna é o seed da 0014b para ela.
alter table public.vaquinha_config
  add column if not exists limite_confianca_cents integer not null default 10000;

-- Constraint idempotente (o `add constraint` sem o drop falharia na 2.ª vez).
alter table public.vaquinha_config
  drop constraint if exists vaquinha_config_limite_confianca_check;
alter table public.vaquinha_config
  add constraint vaquinha_config_limite_confianca_check
  check (limite_confianca_cents > 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. vaquinha_totais — arrecadado (sólido) vs a confirmar (riscas)
-- ═══════════════════════════════════════════════════════════════════════════
-- Três somas, e a linha entre elas é o limite:
--
--   confirmado_cents   = confirmadas                      (fica na resposta: o
--                                                          painel mostra-o)
--   arrecadado_cents   = confirmadas + declaradas ≤ limite (o NÚMERO GRANDE e
--                                                          a parte sólida da barra)
--   a_confirmar_cents  = declaradas > limite              (as riscas)
--
-- Com contar_pendentes = false (travão de emergência) o arrecadado é SÓ o
-- confirmado e as riscas desaparecem — aplicado AQUI, no servidor, para nenhum
-- cliente poder mostrar pendentes.
--
-- `limite_confianca_cents` vai na resposta porque é o site que escreve a frase
-- do agradecimento («já conta na barra» vs «entra na barra assim que a Vitória
-- confirmar»): ler o limite daqui é o que faz a frase acompanhar uma mudança
-- por SQL, sem deploy. Não é segredo nenhum — é a regra que o próprio site
-- explica ao doador.
--
-- NUNCA devolve n_contribuicoes (decisão de 13/10, e a função é chamável por
-- anon em /rest/v1/rpc).
create or replace function public.vaquinha_totais()
returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg      public.vaquinha_config%rowtype;
  v_conf     bigint := 0;  -- confirmadas (sólido, sem dúvida)
  v_decl_ok  bigint := 0;  -- declaradas até ao limite (contam logo, sólido)
  v_decl_alto bigint := 0; -- declaradas acima do limite (riscas, à espera)
begin
  select * into v_cfg from public.vaquinha_config where id;
  if not found then
    -- Sem config: zeros com ativa = false. O limite vai a 10000 porque é o
    -- default da coluna (o cliente usa-o como valor de recurso para a frase).
    return jsonb_build_object(
      'confirmado_cents',0,'arrecadado_cents',0,'a_confirmar_cents',0,
      'limite_confianca_cents',10000,
      'meta_cents',null,'ativa',false,'inicio',null,'fim',null,
      'contar_pendentes',true);
  end if;

  select
    coalesce(sum(valor_cents) filter (where estado = 'confirmada'), 0),
    coalesce(sum(valor_cents) filter (
      where estado = 'declarada' and valor_cents <= v_cfg.limite_confianca_cents), 0),
    coalesce(sum(valor_cents) filter (
      where estado = 'declarada' and valor_cents >  v_cfg.limite_confianca_cents), 0)
    into v_conf, v_decl_ok, v_decl_alto
    from public.doacoes;

  return jsonb_build_object(
    'confirmado_cents', v_conf,
    'arrecadado_cents',
      case when v_cfg.contar_pendentes then v_conf + v_decl_ok else v_conf end,
    'a_confirmar_cents',
      case when v_cfg.contar_pendentes then v_decl_alto else 0 end,
    'limite_confianca_cents', v_cfg.limite_confianca_cents,
    'meta_cents', v_cfg.meta_cents,
    'ativa', v_cfg.ativa,
    'inicio', v_cfg.inicio,
    'fim', v_cfg.fim,
    'contar_pendentes', v_cfg.contar_pendentes);
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. admin_procurar_doacao — a Vitória procura pela referência (V5)
-- ═══════════════════════════════════════════════════════════════════════════
-- Serve para os dois casos que a fila não apanha bem:
--   · quem PAGOU e não carregou no botão — a linha ficou 'iniciada' e não está
--     há 24 h na lista de recentes quando a Vitória lá chega;
--   · uma referência lida em voz alta / escrita à mão no descritivo.
-- Por isso: QUALQUER estado, QUALQUER idade, sem filtro de tempo nenhum.
--
-- A referência é escrita à mão, portanto a comparação é feita sobre a forma
-- normalizada dos dois lados: maiúsculas, sem espaços, hífenes nem acentos.
-- `ATOS-83P2`, `atos 83p2` e `83P2` encontram a mesma linha.
--
-- Devolve a MESMA forma de linha de admin_listar_doacoes (o painel reutiliza o
-- cartão) e os totais, para a barra em cima acompanhar a decisão. Nunca devolve
-- posse_token nem ip_hash.
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
  -- Mesmo portão das outras RPCs de admin: sha256 do core, em hex.
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

  -- `replace(referencia,'-','')` é o lado da base da mesma normalização, e o
  -- LIKE é "contém": tanto apanha a referência inteira como as últimas quatro
  -- letras que a Vitória conseguiu ler.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'referencia', d.referencia, 'valor_cents', d.valor_cents,
           'metodo', d.metodo, 'estado', d.estado,
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
-- A procura também vai a anon — como as outras de admin: o Next em produção não
-- tem service_role e quem autoriza é a chave (≥32 caracteres aleatórios), não o
-- role. A chave nunca chega ao browser: as rotas de servidor é que a usam.
revoke all on function public.vaquinha_totais() from public, anon, authenticated;
revoke all on function public.admin_procurar_doacao(text, text, integer)
  from public, anon, authenticated;

grant execute on function public.vaquinha_totais()
  to anon, authenticated, service_role;
grant execute on function public.admin_procurar_doacao(text, text, integer)
  to anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. LEDGER
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0014c_vaquinha_confianca','mcp','D8 (14/10): declarada ate ao limite de confianca conta logo no arrecadado; acima dele fica nas riscas. Coluna vaquinha_config.limite_confianca_cents (default 10000), vaquinha_totais() com arrecadado_cents/a_confirmar_cents e admin_procurar_doacao (qualquer estado, qualquer idade).')
on conflict (nome) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════
-- 6.1 A coluna, com o default e o check:
--
-- select limite_confianca_cents,
--        pg_get_constraintdef(oid) as check_def
--   from public.vaquinha_config c
--   left join pg_constraint k
--     on k.conrelid = 'public.vaquinha_config'::regclass
--    and k.conname  = 'vaquinha_config_limite_confianca_check'
--  where c.id;
--   Esperado: 1 linha · limite_confianca_cents 10000 · check_def
--             CHECK ((limite_confianca_cents > 0))
--
-- 6.2 Uma assinatura por RPC e todas SECURITY DEFINER:
--
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('iniciar_doacao','declarar_doacao','vaquinha_totais',
--                      'admin_listar_doacoes','admin_decidir_doacao',
--                      'admin_procurar_doacao')
--  order by p.proname;
--   Esperado: 6 linhas, prosecdef = true nas 6.
--
-- 6.3 Grants efetivos (EXECUTE só para anon/authenticated/service_role; sem PUBLIC):
--
-- select p.proname, coalesce(r.rolname,'PUBLIC') as role, a.privilege_type
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
--   left join pg_roles r on r.oid = a.grantee
--  where n.nspname = 'public'
--    and p.proname in ('vaquinha_totais','admin_procurar_doacao')
--  order by p.proname, role;
--   Esperado: 3 linhas EXECUTE por função = 6 linhas.
--
-- 6.4 A resposta tem as chaves novas e NÃO tem n_contribuicoes:
--
-- select public.vaquinha_totais();
--   Esperado: {"ativa": true, "meta_cents": 500000, "confirmado_cents": …,
--              "arrecadado_cents": …, "a_confirmar_cents": …,
--              "limite_confianca_cents": 10000, "contar_pendentes": true, …}
--   NÃO pode aparecer a chave "n_contribuicoes".
--
-- 6.5 As regras do D8, caso a caso — e a chave errada recusada.
--     Corre TUDO dentro de uma transação que volta atrás: nada fica escrito na
--     base. As asserções são DIFERENÇAS contra o ponto de partida, porque a base
--     de produção pode já ter doações reais (a partir de 17/10, tem de certeza).
--     O `update` direto em doacoes é de propósito: o admin_decidir_doacao exige
--     a chave admin, que não existe em script nenhum — o efeito escrito é o
--     mesmo (estado + decidida_em).
--
-- begin;
-- do $verif$
-- declare
--   v0        jsonb;
--   v1        jsonb;
--   v_conf0   bigint;
--   v_id20    uuid;
--   v_id200   uuid;
--   v_msg     text;
--   v_recusou boolean := false;
--   v_barrou  boolean := false;
-- begin
--   delete from public.doacoes where referencia like 'D8TESTE%';
--   v0      := public.vaquinha_totais();
--   v_conf0 := (v0->>'confirmado_cents')::bigint;
--
--   -- (1) declarada de 20 € (≤ limite): conta LOGO, sem riscas.
--   insert into public.doacoes
--     (referencia, valor_cents, metodo, estado, posse_token, idem_key, declarada_em)
--   values ('D8TESTE20', 2000, 'mbway', 'declarada', 'teste-d8', gen_random_uuid(), now())
--   returning id into v_id20;
--
--   v1 := public.vaquinha_totais();
--   if (v1->>'arrecadado_cents')::bigint - (v0->>'arrecadado_cents')::bigint <> 2000 then
--     raise exception 'D8-1 arrecadado: esperado +2000, veio %', v1; end if;
--   if (v1->>'a_confirmar_cents')::bigint - (v0->>'a_confirmar_cents')::bigint <> 0 then
--     raise exception 'D8-1 a_confirmar: esperado +0, veio %', v1; end if;
--   if (v1->>'confirmado_cents')::bigint <> v_conf0 then
--     raise exception 'D8-1 confirmado_cents mudou sem confirmação: %', v1; end if;
--
--   -- (2) declarada de 200 € (> limite): só nas riscas.
--   insert into public.doacoes
--     (referencia, valor_cents, metodo, estado, posse_token, idem_key, declarada_em)
--   values ('D8TESTE200', 20000, 'transferencia', 'declarada', 'teste-d8', gen_random_uuid(), now())
--   returning id into v_id200;
--
--   v1 := public.vaquinha_totais();
--   if (v1->>'arrecadado_cents')::bigint - (v0->>'arrecadado_cents')::bigint <> 2000 then
--     raise exception 'D8-2 arrecadado: esperado +2000 (só a de 20), veio %', v1; end if;
--   if (v1->>'a_confirmar_cents')::bigint - (v0->>'a_confirmar_cents')::bigint <> 20000 then
--     raise exception 'D8-2 a_confirmar: esperado +20000, veio %', v1; end if;
--
--   -- (3) confirmar a de 200 € passa-a para o sólido.
--   update public.doacoes set estado = 'confirmada', decidida_em = now() where id = v_id200;
--
--   v1 := public.vaquinha_totais();
--   if (v1->>'arrecadado_cents')::bigint - (v0->>'arrecadado_cents')::bigint <> 22000 then
--     raise exception 'D8-3 arrecadado: esperado +22000, veio %', v1; end if;
--   if (v1->>'a_confirmar_cents')::bigint - (v0->>'a_confirmar_cents')::bigint <> 0 then
--     raise exception 'D8-3 a_confirmar: esperado +0, veio %', v1; end if;
--
--   -- (4) anular tira-a (as duas voltam ao ponto de partida).
--   update public.doacoes set estado = 'anulada', decidida_em = now() where id = v_id200;
--   update public.doacoes set estado = 'anulada', decidida_em = now() where id = v_id20;
--
--   v1 := public.vaquinha_totais();
--   if (v1->>'arrecadado_cents')::bigint  <> (v0->>'arrecadado_cents')::bigint
--      or (v1->>'a_confirmar_cents')::bigint <> (v0->>'a_confirmar_cents')::bigint then
--     raise exception 'D8-4 anular devia voltar ao ponto de partida, veio %', v1; end if;
--
--   -- (5) travão de emergência: contar_pendentes = false deixa SÓ as confirmadas.
--   insert into public.doacoes
--     (referencia, valor_cents, metodo, estado, posse_token, idem_key, declarada_em)
--   values ('D8TESTE20B', 2000, 'mbway', 'declarada', 'teste-d8', gen_random_uuid(), now()),
--          ('D8TESTE200B', 20000, 'transferencia', 'declarada', 'teste-d8', gen_random_uuid(), now());
--
--   update public.vaquinha_config set contar_pendentes = false;
--   v1 := public.vaquinha_totais();
--   if (v1->>'arrecadado_cents')::bigint <> v_conf0 then
--     raise exception 'D8-5 com o travão o arrecadado devia ser SÓ o confirmado (%), veio %', v_conf0, v1; end if;
--   if (v1->>'a_confirmar_cents')::bigint <> 0 then
--     raise exception 'D8-5 com o travão a_confirmar devia ser 0, veio %', v1; end if;
--   update public.vaquinha_config set contar_pendentes = true;
--
--   -- (6) a normalização da procura casa as três formas em que a referência é escrita.
--   if replace('D8TESTE200B','-','')
--      not like '%' || regexp_replace(upper('d8 teste 200b'), '[^A-Z0-9]', '', 'g') || '%' then
--     raise exception 'D8-6 a normalização da referência não casa'; end if;
--
--   -- (7) chave errada é recusada.
--   begin
--     perform public.admin_procurar_doacao('chave-errada-de-verificacao', 'D8TESTE');
--   exception when others then
--     v_msg     := sqlerrm;
--     v_recusou := v_msg like '%acesso_negado%';
--   end;
--   if v_recusou is not true then
--     raise exception 'D8-7 admin_procurar_doacao não recusou a chave errada (mensagem: %)', v_msg; end if;
--
--   -- (8) o check da coluna barra um limite ≤ 0.
--   begin
--     update public.vaquinha_config set limite_confianca_cents = 0;
--   exception when check_violation then
--     v_barrou := true;
--   end;
--   if v_barrou is not true then
--     raise exception 'D8-8 o check do limite não barrou um 0'; end if;
--
--   raise notice 'D8: 8 verificações passaram (e nada foi escrito — a transação volta atrás)';
-- end;
-- $verif$;
-- rollback;
--
-- 6.6 A procura contra a chave A SÉRIO faz-se na janela, pela página (V5), com a
--     Vitória a procurar uma referência real — nunca por script, porque isso
--     exigia a chave admin em claro em algum sítio.
