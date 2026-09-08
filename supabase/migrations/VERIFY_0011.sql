-- ═══════════════════════════════════════════════════════════════
-- VERIFY_0011.sql — prova da 0011 SEM deixar escritas na base.
-- Correr TUDO (BEGIN ... ROLLBACK) no SQL Editor do projeto
-- qtiyxibqeignvsnfhzpw, DEPOIS de aplicar 0011_sponsor_pagamentos.sql.
--
-- O que prova:
--   1. As 9 funções existem com as assinaturas esperadas.
--   2. As tabelas + índices + policies de storage existem.
--   3. registar_sponsor devolve posse_token (hex 64) e a reentrada
--      devolve um token NOVO (padrão B1).
--   4. Os guards de posse bloqueiam com acesso_negado (42501).
--   5. O ciclo nível → método → pagamento → comprovativo funciona
--      com o token certo, incluindo idempotência e validação de path.
--   Tudo dentro de uma transação revertida: zero linhas ficam na base.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── 1. Assinaturas das funções ─────────────────────────────────
with esperadas(oid_teste) as (values
  ('registar_sponsor(text,text,text,integer,text,boolean,text)'),
  ('criar_pagamento_sponsor(uuid,text,text)'),
  ('definir_nivel_sponsor(uuid,integer,text)'),
  ('definir_metodo_sponsor(uuid,text,text)'),
  ('validar_comprovativo_upload_sponsor(uuid,uuid,text)'),
  ('registar_comprovativo_sponsor(uuid,text,text,text,integer,text)'),
  ('estado_sponsor(uuid,text)'),
  ('confirmar_pagamento_sponsor(uuid)'),
  ('rejeitar_pagamento_sponsor(uuid,text)')
)
select 'funcao ' || oid_teste as verificacao,
       case when to_regprocedure('public.' || oid_teste) is not null
            then 'OK' else 'FALTA — aplicar a 0011' end as resultado
from esperadas
union all
select 'funcao antiga definir_nivel_sponsor(uuid,integer) removida',
       case when to_regprocedure('public.definir_nivel_sponsor(uuid,integer)') is null
            then 'OK' else 'OVERLOAD MORTO — drop da assinatura 2-arg falhou' end
union all
select 'funcao antiga definir_metodo_sponsor(uuid,text) removida',
       case when to_regprocedure('public.definir_metodo_sponsor(uuid,text)') is null
            then 'OK' else 'OVERLOAD MORTO — drop da assinatura 2-arg falhou' end;

-- ── 2. Tabelas, coluna, índices e policies ─────────────────────
select 'tabela pagamentos_sponsor' as verificacao,
       case when to_regclass('public.pagamentos_sponsor') is not null then 'OK' else 'FALTA' end as resultado
union all
select 'tabela comprovativos_sponsor',
       case when to_regclass('public.comprovativos_sponsor') is not null then 'OK' else 'FALTA' end
union all
select 'coluna sponsors.posse_token',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='sponsors'
                            and column_name='posse_token') then 'OK' else 'FALTA' end
union all
select 'indice parcial 1 pagamento ativo por sponsor',
       case when exists (select 1 from pg_indexes
                          where schemaname='public' and tablename='pagamentos_sponsor'
                            and indexdef like '%WHERE estado not in%' ) then 'OK' else 'FALTA' end
union all
select 'policy storage payment_proofs_sponsor_insert',
       case when exists (select 1 from pg_policies
                          where schemaname='storage' and tablename='objects'
                            and policyname='payment_proofs_sponsor_insert') then 'OK' else 'FALTA' end
union all
select 'policy storage payment_proofs_sponsor_select',
       case when exists (select 1 from pg_policies
                          where schemaname='storage' and tablename='objects'
                            and policyname='payment_proofs_sponsor_select') then 'OK' else 'FALTA' end
union all
select 'policies de INSCRICAO intactas (payment_proofs_insert/select)',
       case when (select count(*) from pg_policies
                   where schemaname='storage' and tablename='objects'
                     and policyname in ('payment_proofs_insert','payment_proofs_select')) = 2
            then 'OK' else 'REGRESSAO — policies de inscrição alteradas' end;

-- ── 3. Ciclo completo numa transação revertida ─────────────────
do $$
declare
  v_res jsonb;
  v_id uuid;
  v_token text;
  v_token2 text;
  v_pagamento jsonb;
  v_validacao jsonb;
  v_comprovativo jsonb;
  v_estado jsonb;
  v_proof_token text;
  v_valor text;
begin
  -- 3a. registar_sponsor → posse_token hex 64
  v_res := public.registar_sponsor(
    'QA Verify Bloco J', 'qa-blocoj-verify@example.com', '+351910000000',
    null, null, true, null);
  v_id    := (v_res->>'id')::uuid;
  v_token := v_res->>'posse_token';
  if v_res->>'status' is distinct from 'criada' then
    raise exception 'VERIFY FALHOU: status %', v_res->>'status';
  end if;
  if v_token is null or char_length(v_token) <> 64 or v_token !~ '^[0-9a-f]{64}$' then
    raise exception 'VERIFY FALHOU: posse_token invalido';
  end if;

  -- 3b. Guard: token errado → acesso_negado (42501)
  begin
    perform public.estado_sponsor(v_id, repeat('f', 64));
    raise exception 'VERIFY FALHOU: guard de posse nao bloqueou estado_sponsor';
  exception when insufficient_privilege then
    null; -- esperado
  end;

  begin
    perform public.criar_pagamento_sponsor(v_id, 'mbway', repeat('a', 64));
    raise exception 'VERIFY FALHOU: guard de posse nao bloqueou criar_pagamento_sponsor';
  exception when insufficient_privilege then
    null; -- esperado
  end;

  -- 3c. Reentrada (mesmo email) → status ja_existente + token NOVO
  v_res := public.registar_sponsor(
    'QA Verify Bloco J', 'qa-blocoj-verify@example.com', '+351910000000',
    75, 'QA Lda', true, null);
  if v_res->>'status' is distinct from 'ja_existente' then
    raise exception 'VERIFY FALHOU: reentrada status %', v_res->>'status';
  end if;
  v_token2 := v_res->>'posse_token';
  if v_token2 is null or v_token2 = v_token or v_token2 !~ '^[0-9a-f]{64}$' then
    raise exception 'VERIFY FALHOU: reentrada nao emitiu token novo';
  end if;
  v_token := v_token2;

  -- 3d. definir_nivel_sponsor (3-arg) → ok
  v_res := public.definir_nivel_sponsor(v_id, 150, v_token);
  if v_res->>'status' is distinct from 'ok' or (v_res->>'nivel')::int <> 150 then
    raise exception 'VERIFY FALHOU: definir_nivel_sponsor %', v_res::text;
  end if;

  -- 3e. criar_pagamento_sponsor → criado, valor derivado do nivel (150)
  v_pagamento := public.criar_pagamento_sponsor(v_id, 'transferencia', v_token);
  if v_pagamento->>'status' is distinct from 'criado'
     or v_pagamento->>'estado' is distinct from 'payment_started' then
    raise exception 'VERIFY FALHOU: criar_pagamento_sponsor %', v_pagamento::text;
  end if;
  select valor into v_valor from public.pagamentos_sponsor where id = (v_pagamento->>'pagamento_id')::uuid;
  if v_valor is distinct from '150.00' then
    raise exception 'VERIFY FALHOU: valor % (esperado 150.00, derivado do nivel)', v_valor;
  end if;

  -- 3f. Idempotência: segunda chamada → existente (mesmo pagamento)
  v_res := public.criar_pagamento_sponsor(v_id, 'mbway', v_token);
  if v_res->>'status' is distinct from 'existente'
     or (v_res->>'pagamento_id') is distinct from v_pagamento->>'pagamento_id' then
    raise exception 'VERIFY FALHOU: idempotencia %', v_res::text;
  end if;

  -- 3g. validar_comprovativo_upload_sponsor → awaiting_proof + proof_token
  v_validacao := public.validar_comprovativo_upload_sponsor(
    (v_pagamento->>'pagamento_id')::uuid, v_id, v_token);
  v_proof_token := v_validacao->>'proof_token';
  if v_validacao->>'estado' is distinct from 'awaiting_proof' or v_proof_token is null then
    raise exception 'VERIFY FALHOU: validar_comprovativo_upload_sponsor %', v_validacao::text;
  end if;

  -- 3h. Path com token errado → storage_path_invalido
  begin
    perform public.registar_comprovativo_sponsor(
      (v_pagamento->>'pagamento_id')::uuid,
      'payment-proofs/' || v_id::text || '/' || repeat('0', 8) || '-0000-0000-0000-000000000000/x.png',
      'x.png', 'image/png', 1024, v_token);
    raise exception 'VERIFY FALHOU: path invalido foi aceite';
  exception when others then
    if sqlerrm is distinct from 'storage_path_invalido' then
      raise exception 'VERIFY FALHOU: erro inesperado no path %', sqlerrm;
    end if;
  end;

  -- 3i. registar_comprovativo_sponsor (path correto, heif aceit) → recebido
  v_comprovativo := public.registar_comprovativo_sponsor(
    (v_pagamento->>'pagamento_id')::uuid,
    'payment-proofs/' || v_id::text || '/' || v_proof_token || '/' || gen_random_uuid()::text || '.heif',
    'comprovativo.heif', 'image/heif', 2048, v_token);
  if v_comprovativo->>'status' is distinct from 'recebido'
     or v_comprovativo->>'pagamento_estado' is distinct from 'proof_uploaded' then
    raise exception 'VERIFY FALHOU: registar_comprovativo_sponsor %', v_comprovativo::text;
  end if;

  -- 3j. estado_sponsor → proof_uploaded + motivo null
  v_estado := public.estado_sponsor(v_id, v_token);
  if v_estado->>'pagamento_estado' is distinct from 'proof_uploaded'
     or v_estado->>'nivel' is distinct from '150' then
    raise exception 'VERIFY FALHOU: estado_sponsor %', v_estado::text;
  end if;

  -- 3k. confirmar_pagamento_sponsor (corre como o role atual — em produção
  --     só service_role a executa; aqui prova apenas a lógica)
  v_res := public.confirmar_pagamento_sponsor((v_pagamento->>'pagamento_id')::uuid);
  if v_res->>'status' is distinct from 'confirmado' then
    raise exception 'VERIFY FALHOU: confirmar_pagamento_sponsor %', v_res::text;
  end if;
  if (select status from public.sponsors where id = v_id) is distinct from 'confirmado' then
    raise exception 'VERIFY FALHOU: sponsors.status deveria ser confirmado';
  end if;

  raise notice 'VERIFY 0011: TODAS AS PROVAS PASSARAM (transacao sera revertida)';
end;
$$;

-- ── 4. Grants de ADMIN invertidos (só service_role) ────────────
select 'confirmar/rejeitar sem grant a anon' as verificacao,
       case when not exists (
              select 1 from information_schema.role_function_grants
               where routine_schema='public'
                 and routine_name in ('confirmar_pagamento_sponsor','rejeitar_pagamento_sponsor')
                 and grantee in ('anon','authenticated','public'))
            then 'OK' else 'PERIGO — anon/authenticated tem execute' end as resultado;

rollback;