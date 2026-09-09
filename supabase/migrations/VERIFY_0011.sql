-- ═══════════════════════════════════════════════════════════════
-- VERIFY_0011.sql — prova da 0011 (r2 ADITIVA) SEM deixar escritas.
-- Correr TUDO (BEGIN ... ROLLBACK) no SQL Editor do projeto
-- qtiyxibqeignvsnfhzpw, DEPOIS de aplicar 0011_sponsor_pagamentos.sql.
--
-- O que prova:
--   1. As 11 funções novas/alteradas existem com as assinaturas esperadas.
--   2. Os OVERLOADS ANTIGOS de 2-arg (0004/0005) CONTINUAM VIVOS — a 0011
--      é aditiva; o drop deles é a 0012, aplicada só depois.
--   3. Tabelas + índice parcial + bucket PRIVADO sponsor-payment-proofs +
--      policies SÓ nesse bucket (payment-proofs das inscrições intacto).
--   4. ANTI-TAKEOVER: re-submissão do email com pagamento ativo devolve
--      'ja_existente' SEM posse_token e não altera o nível.
--   5. iniciar_pagamento_sponsor: valor derivado do nível, idempotência
--      (existente/mesmo pagamento), troca de método antes do comprovativo
--      (metodo_atualizado), bloqueio depois (pagamento_em_analise).
--   6. definir_nivel_sponsor 3-arg bloqueia com pagamento ativo
--      (nivel_bloqueado) e os guards de posse devolvem 42501.
--   7. Ciclo completo: validar → registar comprovativo (path com bucket
--      NOVO + heif aceit) → handoff WhatsApp → admin confirmar/rejeitar.
--   8. RLS como anon: 0 linhas visíveis; admin RPC negada a anon.
--   O que NÃO prova (regra, não esquecer): upload REAL no storage
--   (signed URL + PUT), concorrência de verdade (a race é coberta pelo
--   handler de unique_violation + índice parcial, não por este script).
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── 1. Assinaturas novas ───────────────────────────────────────
with esperadas(oid_teste) as (values
  ('registar_sponsor(text,text,text,integer,text,boolean,text)'),
  ('iniciar_pagamento_sponsor(uuid,text,text)'),
  ('definir_nivel_sponsor(uuid,integer,text)'),
  ('definir_metodo_sponsor(uuid,text,text)'),
  ('validar_comprovativo_upload_sponsor(uuid,uuid,text)'),
  ('registar_comprovativo_sponsor(uuid,text,text,text,integer,text)'),
  ('marcar_comprovativo_whatsapp_sponsor(uuid,uuid,text)'),
  ('estado_sponsor(uuid,text)'),
  ('confirmar_pagamento_sponsor(uuid)'),
  ('rejeitar_pagamento_sponsor(uuid,text)'),
  ('comprovativo_sponsor_pode_upload(text)'),
  ('comprovativo_sponsor_pode_ler(text)')
)
select 'funcao ' || oid_teste as verificacao,
       case when to_regprocedure('public.' || oid_teste) is not null
            then 'OK' else 'FALTA — aplicar a 0011' end as resultado
from esperadas
union all
-- ADITIVA: os overloads antigos de 2-arg (0004/0005) têm de CONTINUAR vivos
select 'overload antigo definir_nivel_sponsor(uuid,integer) PRESERVADO',
       case when to_regprocedure('public.definir_nivel_sponsor(uuid,integer)') is not null
            then 'OK' else 'REGRESSAO — 2-arg sumiu (a 0012 correu aqui por engano)' end
union all
select 'overload antigo definir_metodo_sponsor(uuid,text) PRESERVADO',
       case when to_regprocedure('public.definir_metodo_sponsor(uuid,text)') is not null
            then 'OK' else 'REGRESSAO — 2-arg sumiu (a 0012 correu aqui por engano)' end;

-- ── 2. Tabelas, colunas, índices, bucket e policies ────────────
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
select 'coluna pagamentos_sponsor.canal_comprovativo',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='pagamentos_sponsor'
                            and column_name='canal_comprovativo') then 'OK' else 'FALTA' end
union all
select 'coluna pagamentos_sponsor.whatsapp_handoff_at',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='pagamentos_sponsor'
                            and column_name='whatsapp_handoff_at') then 'OK' else 'FALTA' end
union all
select 'pagamentos_sponsor.valor numeric(8,2)',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='pagamentos_sponsor'
                            and column_name='valor'
                            and data_type='numeric'
                            and numeric_precision=8 and numeric_scale=2) then 'OK' else 'FALTA' end
union all
select 'RLS ativo em pagamentos_sponsor (sem policies diretas)',
       case when (select relrowsecurity from pg_class
                   where oid = 'public.pagamentos_sponsor'::regclass)
              and not exists (select 1 from pg_policies
                               where schemaname='public' and tablename='pagamentos_sponsor')
            then 'OK' else 'FALTA — RLS/policies erradas' end
union all
select 'RLS ativo em comprovativos_sponsor (sem policies diretas)',
       case when (select relrowsecurity from pg_class
                   where oid = 'public.comprovativos_sponsor'::regclass)
              and not exists (select 1 from pg_policies
                               where schemaname='public' and tablename='comprovativos_sponsor')
            then 'OK' else 'FALTA — RLS/policies erradas' end
union all
select 'indice parcial 1 pagamento ativo por sponsor',
       case when exists (select 1 from pg_indexes
                          where schemaname='public' and tablename='pagamentos_sponsor'
                            and indexdef like '%WHERE estado not in%') then 'OK' else 'FALTA' end
union all
select 'bucket PRIVADO sponsor-payment-proofs (8MB, mimes com heic/heif)',
       case when exists (select 1 from storage.buckets
                          where id = 'sponsor-payment-proofs'
                            and public = false
                            and file_size_limit = 8388608
                            and 'image/heic' = any(allowed_mime_types)
                            and 'image/heif' = any(allowed_mime_types)) then 'OK' else 'FALTA' end
union all
select 'bucket de INSCRICAO payment-proofs intacto',
       case when exists (select 1 from storage.buckets where id = 'payment-proofs')
            then 'OK' else 'REGRESSAO — bucket de inscrição alterado/apagado' end
union all
select 'policy sponsor_proofs_insert (só no bucket dedicado)',
       case when exists (select 1 from pg_policies
                          where schemaname='storage' and tablename='objects'
                            and policyname='sponsor_proofs_insert'
                            and policydefinition::text like '%sponsor-payment-proofs%') then 'OK' else 'FALTA' end
union all
select 'policy sponsor_proofs_select (só no bucket dedicado)',
       case when exists (select 1 from pg_policies
                          where schemaname='storage' and tablename='objects'
                            and policyname='sponsor_proofs_select'
                            and qual::text like '%sponsor-payment-proofs%') then 'OK' else 'FALTA' end
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
  v_pagamento jsonb;
  v_validacao jsonb;
  v_comprovativo jsonb;
  v_estado jsonb;
  v_canal text;
  v_proof_token text;
  v_valor text;
  v_nivel_db integer;
begin
  -- 3a. registar_sponsor → 'criada' + posse_token hex 64
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

  -- 3b. Guard de posse: token errado → acesso_negado (42501)
  begin
    perform public.estado_sponsor(v_id, repeat('f', 64));
    raise exception 'VERIFY FALHOU: guard de posse nao bloqueou estado_sponsor';
  exception when insufficient_privilege then
    null; -- esperado
  end;

  begin
    perform public.iniciar_pagamento_sponsor(v_id, 'mbway', repeat('a', 64));
    raise exception 'VERIFY FALHOU: guard de posse nao bloqueou iniciar_pagamento_sponsor';
  exception when insufficient_privilege then
    null; -- esperado
  end;

  begin
    perform public.validar_comprovativo_upload_sponsor(
      gen_random_uuid(), v_id, v_token);
    raise exception 'VERIFY FALHOU: validar aceitou pagamento inexistente';
  exception when others then
    if sqlerrm is distinct from 'pagamento_nao_encontrado' then
      raise exception 'VERIFY FALHOU: erro inesperado %', sqlerrm;
    end if;
  end;

  -- 3c. iniciar sem nível → nivel_nao_definido
  begin
    perform public.iniciar_pagamento_sponsor(v_id, 'mbway', v_token);
    raise exception 'VERIFY FALHOU: iniciou pagamento sem nivel definido';
  exception when others then
    if sqlerrm is distinct from 'nivel_nao_definido' then
      raise exception 'VERIFY FALHOU: erro inesperado %', sqlerrm;
    end if;
  end;

  -- 3d. definir_nivel_sponsor 3-arg → ok
  v_res := public.definir_nivel_sponsor(v_id, 150, v_token);
  if v_res->>'status' is distinct from 'ok' or (v_res->>'nivel')::int <> 150 then
    raise exception 'VERIFY FALHOU: definir_nivel_sponsor %', v_res::text;
  end if;

  -- 3e. iniciar_pagamento_sponsor → criado, valor derivado do nível (150)
  v_pagamento := public.iniciar_pagamento_sponsor(v_id, 'transferencia', v_token);
  if v_pagamento->>'status' is distinct from 'criado'
     or v_pagamento->>'estado' is distinct from 'payment_started' then
    raise exception 'VERIFY FALHOU: iniciar_pagamento_sponsor %', v_pagamento::text;
  end if;
  select valor, nivel into v_valor, v_nivel_db
    from public.pagamentos_sponsor where id = (v_pagamento->>'pagamento_id')::uuid;
  if v_valor is distinct from '150.00' or v_nivel_db is distinct from 150 then
    raise exception 'VERIFY FALHOU: valor % (esperado 150.00 derivado do nivel)', v_valor;
  end if;
  -- sponsors.metodo_pagamento acompanhado NA MESMA transação
  if (select metodo_pagamento from public.sponsors where id = v_id)
     is distinct from 'transferencia' then
    raise exception 'VERIFY FALHOU: sponsors.metodo_pagamento nao acompanhou';
  end if;

  -- 3f. Idempotência: mesma chamada → 'existente', MESMO pagamento
  v_res := public.iniciar_pagamento_sponsor(v_id, 'transferencia', v_token);
  if v_res->>'status' is distinct from 'existente'
     or (v_res->>'pagamento_id') is distinct from v_pagamento->>'pagamento_id' then
    raise exception 'VERIFY FALHOU: idempotencia %', v_res::text;
  end if;

  -- 3g. Troca de método ANTES do comprovativo → 'metodo_atualizado'? Não:
  --     payment_started + método diferente → atualiza o MESMO pagamento
  --     e devolve status 'existente' com o método novo (o campo metodo do
  --     pagamento passa a mbway).
  v_res := public.iniciar_pagamento_sponsor(v_id, 'mbway', v_token);
  if v_res->>'metodo' is distinct from 'mbway'
     or (v_res->>'pagamento_id') is distinct from v_pagamento->>'pagamento_id' then
    raise exception 'VERIFY FALHOU: troca de metodo pre-upload %', v_res::text;
  end if;
  if (select metodo from public.pagamentos_sponsor
       where id = (v_pagamento->>'pagamento_id')::uuid) is distinct from 'mbway' then
    raise exception 'VERIFY FALHOU: metodo do pagamento nao trocou para mbway';
  end if;

  -- 3h. definir_nivel_sponsor COM pagamento ativo → nivel_bloqueado
  begin
    perform public.definir_nivel_sponsor(v_id, 200, v_token);
    raise exception 'VERIFY FALHOU: nivel alterado com pagamento ativo';
  exception when others then
    if sqlerrm is distinct from 'nivel_bloqueado' then
      raise exception 'VERIFY FALHOU: erro inesperado %', sqlerrm;
    end if;
  end;
  -- e o nível ficou 150 (não foi zerado nem mudado):
  if (select nivel from public.sponsors where id = v_id) is distinct from 150 then
    raise exception 'VERIFY FALHOU: nivel mudou com pagamento ativo';
  end if;

  -- 3i. ANTI-TAKEOVER: re-submeter o MESMO email com pagamento ativo
  --     → 'ja_existente' SEM posse_token, SEM alterar nada.
  v_res := public.registar_sponsor(
    'QA Verify Bloco J', 'qa-blocoj-verify@example.com', '+351911111111',
    200, 'Outra Empresa Lda', true, null);
  if v_res->>'status' is distinct from 'ja_existente' then
    raise exception 'VERIFY FALHOU: anti-takeover status %', v_res->>'status';
  end if;
  if v_res ? 'posse_token' and v_res->>'posse_token' is not null then
    raise exception 'VERIFY FALHOU: anti-takeover devolveu posse_token (takeover!)';
  end if;
  if v_res->>'id' is distinct from v_id::text then
    raise exception 'VERIFY FALHOU: anti-takeover devolveu outro id';
  end if;
  -- dados INTACTOS: nome/empresa/nível não mudaram
  select nivel into v_nivel_db from public.sponsors where id = v_id;
  if v_nivel_db is distinct from 150 then
    raise exception 'VERIFY FALHOU: anti-takeover alterou nivel para %', v_nivel_db;
  end if;

  -- 3j. validar_comprovativo_upload_sponsor → awaiting_proof + proof_token
  v_validacao := public.validar_comprovativo_upload_sponsor(
    (v_pagamento->>'pagamento_id')::uuid, v_id, v_token);
  v_proof_token := v_validacao->>'proof_token';
  if v_validacao->>'estado' is distinct from 'awaiting_proof' or v_proof_token is null then
    raise exception 'VERIFY FALHOU: validar_comprovativo_upload_sponsor %', v_validacao::text;
  end if;

  -- 3k. Path com token errado / bucket errado → storage_path_invalido
  begin
    perform public.registar_comprovativo_sponsor(
      (v_pagamento->>'pagamento_id')::uuid,
      'sponsor-payment-proofs/' || v_id::text || '/' || '00000000-0000-0000-0000-000000000000/x.png',
      'x.png', 'image/png', 1024, v_token);
    raise exception 'VERIFY FALHOU: path invalido foi aceite';
  exception when others then
    if sqlerrm is distinct from 'storage_path_invalido' then
      raise exception 'VERIFY FALHOU: erro inesperado no path %', sqlerrm;
    end if;
  end;

  begin
    perform public.registar_comprovativo_sponsor(
      (v_pagamento->>'pagamento_id')::uuid,
      'payment-proofs/' || v_id::text || '/' || v_proof_token || '/' || gen_random_uuid()::text || '.png',
      'x.png', 'image/png', 1024, v_token);
    raise exception 'VERIFY FALHOU: path no bucket de INSCRICAO foi aceite';
  exception when others then
    if sqlerrm is distinct from 'storage_path_invalido' then
      raise exception 'VERIFY FALHOU: erro inesperado no bucket %', sqlerrm;
    end if;
  end;

  -- 3l. registar_comprovativo_sponsor (path correto no bucket NOVO, heif
  --     aceit, canal upload) → recebido + proof_uploaded
  v_comprovativo := public.registar_comprovativo_sponsor(
    (v_pagamento->>'pagamento_id')::uuid,
    'sponsor-payment-proofs/' || v_id::text || '/' || v_proof_token || '/' || gen_random_uuid()::text || '.heif',
    'comprovativo.heif', 'image/heif', 2048, v_token);
  if v_comprovativo->>'status' is distinct from 'recebido'
     or v_comprovativo->>'pagamento_estado' is distinct from 'proof_uploaded' then
    raise exception 'VERIFY FALHOU: registar_comprovativo_sponsor %', v_comprovativo::text;
  end if;
  if (select canal_comprovativo from public.pagamentos_sponsor
       where id = (v_pagamento->>'pagamento_id')::uuid) is distinct from 'upload' then
    raise exception 'VERIFY FALHOU: canal_comprovativo deveria ser upload';
  end if;

  -- 3m. Troca de método APÓS comprovativo → pagamento_em_analise
  begin
    perform public.iniciar_pagamento_sponsor(v_id, 'transferencia', v_token);
    raise exception 'VERIFY FALHOU: metodo trocado apos comprovativo';
  exception when others then
    if sqlerrm is distinct from 'pagamento_em_analise' then
      raise exception 'VERIFY FALHOU: erro inesperado %', sqlerrm;
    end if;
  end;

  -- 3n. estado_sponsor → proof_uploaded, comprovativo aguardando, canal upload
  v_estado := public.estado_sponsor(v_id, v_token);
  if v_estado->>'pagamento_estado' is distinct from 'proof_uploaded'
     or v_estado->>'nivel' is distinct from '150'
     or v_estado->>'comprovativo_status' is distinct from 'aguardando_confirmacao'
     or v_estado->>'canal_comprovativo' is distinct from 'upload' then
    raise exception 'VERIFY FALHOU: estado_sponsor %', v_estado::text;
  end if;

  -- 3o. Handoff WhatsApp sobre o MESMO pagamento (após upload): estado
  --     mantém proof_uploaded, canal passa a whatsapp + handoff_at
  v_res := public.marcar_comprovativo_whatsapp_sponsor(
    v_id, (v_pagamento->>'pagamento_id')::uuid, v_token);
  if v_res->>'status' is distinct from 'handoff_registado'
     or v_res->>'pagamento_estado' is distinct from 'proof_uploaded' then
    raise exception 'VERIFY FALHOU: handoff whatsapp %', v_res::text;
  end if;
  select canal_comprovativo into v_canal from public.pagamentos_sponsor
    where id = (v_pagamento->>'pagamento_id')::uuid;
  if v_canal is distinct from 'whatsapp' then
    raise exception 'VERIFY FALHOU: canal deveria ser whatsapp';
  end if;

  -- 3p. admin confirmar → confirmed + sponsors.confirmado + comprovativo aprovado
  v_res := public.confirmar_pagamento_sponsor((v_pagamento->>'pagamento_id')::uuid);
  if v_res->>'status' is distinct from 'confirmado' then
    raise exception 'VERIFY FALHOU: confirmar_pagamento_sponsor %', v_res::text;
  end if;
  if (select status from public.sponsors where id = v_id) is distinct from 'confirmado' then
    raise exception 'VERIFY FALHOU: sponsors.status deveria ser confirmado';
  end if;
  if (select estado from public.pagamentos_sponsor
       where id = (v_pagamento->>'pagamento_id')::uuid) is distinct from 'confirmed' then
    raise exception 'VERIFY FALHOU: estado deveria ser confirmed';
  end if;

  -- 3q. Reconfirmar → estado_invalido
  begin
    perform public.confirmar_pagamento_sponsor((v_pagamento->>'pagamento_id')::uuid);
    raise exception 'VERIFY FALHOU: re-confirmou pagamento';
  exception when others then
    if sqlerrm is distinct from 'estado_invalido' then
      raise exception 'VERIFY FALHOU: erro inesperado %', sqlerrm;
    end if;
  end;

  -- 3r. Rama da REJEIÇÃO: patrocínio separado, validar → registar → rejeitar
  --     → reenvio permitido (validar aceita 'rejected')
  v_res := public.registar_sponsor(
    'QA Verify Rejeicao', 'qa-blocoj-rejeicao@example.com', '+351910000001',
    75, null, true, null);
  declare
    v_id2 uuid := (v_res->>'id')::uuid;
    v_token2 text := v_res->>'posse_token';
    v_pag2 jsonb;
    v_val2 jsonb;
  begin
    perform public.definir_nivel_sponsor(v_id2, 75, v_token2);
    v_pag2 := public.iniciar_pagamento_sponsor(v_id2, 'mbway', v_token2);
    v_val2 := public.validar_comprovativo_upload_sponsor(
      (v_pag2->>'pagamento_id')::uuid, v_id2, v_token2);
    perform public.registar_comprovativo_sponsor(
      (v_pag2->>'pagamento_id')::uuid,
      'sponsor-payment-proofs/' || v_id2::text || '/' || (v_val2->>'proof_token') || '/' || gen_random_uuid()::text || '.png',
      'c.png', 'image/png', 1024, v_token2);
    v_res := public.rejeitar_pagamento_sponsor((v_pag2->>'pagamento_id')::uuid, 'ilegivel');
    if v_res->>'status' is distinct from 'rejeitado' then
      raise exception 'VERIFY FALHOU: rejeitar %', v_res::text;
    end if;
    -- reenvio: validar aceita 'rejected'
    v_val2 := public.validar_comprovativo_upload_sponsor(
      (v_pag2->>'pagamento_id')::uuid, v_id2, v_token2);
    if v_val2->>'estado' is distinct from 'awaiting_proof' then
      raise exception 'VERIFY FALHOU: reenvio apos rejeicao %', v_val2::text;
    end if;
    -- sponsor continua pendente
    if (select status from public.sponsors where id = v_id2) is distinct from 'pendente' then
      raise exception 'VERIFY FALHOU: sponsor deveria continuar pendente';
    end if;
  end;

  raise notice 'VERIFY 0011 r2: TODAS AS PROVAS DO CICLO PASSARAM';
end;
$$;

-- ── 4. RLS como anon + grants ──────────────────────────────────
-- anon não lê linhas (RLS sem policies) e não executa admin RPC.
do $$
declare v_n int;
begin
  set local role anon;
  select count(*) into v_n from public.pagamentos_sponsor;
  if v_n <> 0 then
    raise exception 'VERIFY FALHOU: anon leu % linhas de pagamentos_sponsor', v_n;
  end if;
  begin
    perform public.confirmar_pagamento_sponsor(gen_random_uuid());
    raise exception 'VERIFY FALHOU: anon executou confirmar_pagamento_sponsor';
  exception when insufficient_privilege then
    null; -- esperado
  end;
  reset role;
  raise notice 'VERIFY 0011 r2: RLS anon + grants admin OK';
end;
$$;

-- Client RPCs têm de estar granted a anon (o frontend chama como anon).
select 'RPCs client granted a anon' as verificacao,
       case when not exists (
              select 1 from information_schema.role_function_grants
               where routine_schema='public'
                 and routine_name in ('registar_sponsor','iniciar_pagamento_sponsor',
                                      'estado_sponsor','validar_comprovativo_upload_sponsor',
                                      'registar_comprovativo_sponsor',
                                      'marcar_comprovativo_whatsapp_sponsor')
                 and grantee='anon'
              having count(distinct routine_name) < 6)
            then 'OK' else 'FALTA grant a anon' end as resultado
union all
select 'confirmar/rejeitar SEM grant a anon/authenticated',
       case when not exists (
              select 1 from information_schema.role_function_grants
               where routine_schema='public'
                 and routine_name in ('confirmar_pagamento_sponsor','rejeitar_pagamento_sponsor')
                 and grantee in ('anon','authenticated','public'))
            then 'OK' else 'PERIGO — anon/authenticated tem execute' end as resultado;

rollback;

-- ═══════════════════════════════════════════════════════════════
-- Como correr: colar TUDO no SQL Editor e executar. O rollback garante
-- zero escritas. Provas que ficam para o Preview/QA real (FASE D):
-- upload signed REAL no storage, corrida de concorrência de verdade,
-- e o fluxo completo no browser com mocks/produção.
-- ═══════════════════════════════════════════════════════════════