-- ═════════════════════════════════════════════════════════════════════════════
-- RGPD — CONSENTIMENTO NA INSCRIÇÃO  (versão CORRIGIDA)
-- Projeto Supabase: qtiyxibqeignvsnfhzpw
--
-- PORQUE ESTA VERSÃO EXISTE
-- A versão anterior terminava com um `select` que chamava a função com
-- consentimento=false para provar que era recusada. A função recusou — o teste
-- passou — mas a EXCEÇÃO ABORTOU A TRANSAÇÃO e o SQL Editor reverteu tudo o
-- que vinha antes. Resultado: nada ficou aplicado.
--
-- Aqui os testes correm dentro de blocos com tratamento de exceção: reportam
-- OK/FALHOU por mensagem, sem rebentar a transação.
--
-- ESTADO VERIFICADO ANTES DE COLAR (11/08):
--   ✓ tabela sponsors existe, RLS ativo
--   ✓ registar_sponsor (7 args), definir_nivel_sponsor, definir_metodo_sponsor
--   ✗ inscricoes SEM colunas de consentimento
--   ✗ registar_inscricao só com a versão de 4 args
-- Ou seja: falta exactamente o que está neste ficheiro.
--
-- COMO CORRER: colar tudo de uma vez → Run. É idempotente; se falhar a meio,
-- colar outra vez sem risco.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COLUNAS DE CONSENTIMENTO
--    Os registos existentes ficam a false. Sem consentimento retroativo.
--    consentimento_em guarda o QUANDO — sem isso não há prova defensável.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.inscricoes
  add column if not exists consentimento    boolean not null default false,
  add column if not exists consentimento_em timestamptz;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. registar_inscricao — SOBRECARGA DE 5 ARGUMENTOS
--    A de 4 args CONTINUA A EXISTIR de propósito: enquanto o código em
--    produção não estiver a chamar a nova, apagar a antiga parte as inscrições.
--    O drop faz-se num passo separado, depois do deploy (ver fim do ficheiro).
--
--    Todas as referências qualificadas com public. — a função corre com
--    search_path = '' e foi exactamente uma referência não qualificada
--    (p_email::citext) que a partiu em produção a 10/08.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.registar_inscricao(
  p_nome          text,
  p_email         text,
  p_telefone      text,
  p_ip_hash       text default null,
  p_consentimento boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.inscricoes%rowtype;
  v_id       uuid;
  v_status   text;
  v_bonus    boolean := false;
  -- Janela da campanha — manter em sincronia com src/lib/campanha.ts
  v_inicio   timestamptz := '2026-08-05T22:00:00+01:00'::timestamptz;
  v_fim      timestamptz := '2026-08-10T10:00:00+01:00'::timestamptz;
  v_count    integer;
begin
  -- RGPD: recusa se não vier true (cobre false E null).
  -- Recusar, nunca gravar um não-consentimento.
  if p_consentimento is distinct from true then
    raise exception 'consentimento_obrigatorio' using errcode = '22023';
  end if;

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

  select * into v_existing from public.inscricoes where email = p_email;

  if found then
    update public.inscricoes
       set nome             = p_nome,
           telefone         = p_telefone,
           status           = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end,
           consentimento    = true,
           consentimento_em = now()
     where id = v_existing.id
     returning id into v_id;
    v_status := 'ja_inscrita';
    v_bonus  := v_existing.is_bonus;
  else
    insert into public.inscricoes (nome, email, telefone, ip_hash, consentimento, consentimento_em)
    values (p_nome, p_email, p_telefone, p_ip_hash, true, now())
    returning id into v_id;
    v_status := 'criada';

    -- Bónus dos 50 kits: a janela fechou a 10/08 10:00, devolve sempre false.
    -- Mantido intacto para não alterar o comportamento histórico.
    if now() between v_inicio and v_fim then
      select count(*)::int into v_count
        from public.inscricoes
       where is_bonus = true
         and status <> 'cancelado'
         for update;

      if v_count < 50 then
        update public.inscricoes set is_bonus = true where id = v_id;
        v_bonus := true;
      end if;
    end if;
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id, 'is_bonus', v_bonus);
end;
$$;

revoke all on function public.registar_inscricao(text, text, text, text, boolean) from public;
grant execute on function public.registar_inscricao(text, text, text, text, boolean)
  to anon, authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. registar_sponsor — GARANTIR A REJEIÇÃO DE CONSENTIMENTO
--    A tabela sponsors já existe (verificado). Este bloco só recria a função
--    com a rejeição; é idempotente e seguro repetir.
-- ─────────────────────────────────────────────────────────────────────────────
do $do$
begin
  if to_regclass('public.sponsors') is null then
    raise notice 'AVISO: tabela sponsors nao existe — seccao 3 ignorada.';
    return;
  end if;

  execute $func$
    create or replace function public.registar_sponsor(
      p_nome          text,
      p_email         text,
      p_telefone      text,
      p_nivel         integer default null,
      p_empresa       text    default null,
      p_consentimento boolean default false,
      p_ip_hash       text    default null
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = ''
    as $body$
    declare
      v_existing public.sponsors%rowtype;
      v_id       uuid;
      v_status   text;
    begin
      p_nome     := trim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'));
      p_email    := lower(trim(coalesce(p_email,'')));
      p_telefone := regexp_replace(coalesce(p_telefone,''), '[^0-9+]', '', 'g');
      p_empresa  := trim(regexp_replace(coalesce(p_empresa,''), '\s+', ' ', 'g'));
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
      if p_nivel is not null and p_nivel not in (75, 150, 200) then
        raise exception 'invalid_nivel' using errcode = '22023';
      end if;

      -- RGPD: recusa se não vier true (cobre false E null).
      if p_consentimento is distinct from true then
        raise exception 'consentimento_obrigatorio' using errcode = '22023';
      end if;

      select * into v_existing from public.sponsors where email = p_email;

      if found then
        update public.sponsors
           set nome             = p_nome,
               telefone         = p_telefone,
               nivel            = p_nivel,
               empresa          = p_empresa,
               consentimento    = true,
               status           = case when status = 'cancelado' then 'pendente' else status end,
               metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end
         where id = v_existing.id
         returning id into v_id;
        v_status := 'ja_existente';
      else
        insert into public.sponsors (nome, email, telefone, nivel, empresa, consentimento, ip_hash)
        values (p_nome, p_email, p_telefone, p_nivel, p_empresa, true, p_ip_hash)
        returning id into v_id;
        v_status := 'criada';
      end if;

      return jsonb_build_object('status', v_status, 'id', v_id, 'nivel', p_nivel);
    end;
    $body$;
  $func$;

  revoke all on function public.registar_sponsor(text, text, text, integer, text, boolean, text) from public;
  grant execute on function public.registar_sponsor(text, text, text, integer, text, boolean, text)
    to anon, authenticated, service_role;
end;
$do$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. TESTES — dentro de blocos com tratamento de exceção.
--    NÃO abortam a transação. Vê as mensagens no separador "Messages"/"Notices".
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_res jsonb;
begin
  -- 4a. Consentimento FALSE tem de ser RECUSADO
  begin
    v_res := public.registar_inscricao(
      'Teste Rejeicao', 'teste-rejeicao@exemplo.invalid', '+351912345678', null, false
    );
    raise warning 'FALHOU 4a — a funcao ACEITOU consentimento=false. Investigar.';
    delete from public.inscricoes where email = 'teste-rejeicao@exemplo.invalid';
  exception when others then
    if sqlerrm = 'consentimento_obrigatorio' then
      raise notice 'OK 4a — consentimento=false recusado, como esperado.';
    else
      raise warning 'FALHOU 4a — erro inesperado: %', sqlerrm;
    end if;
  end;

  -- 4b. Consentimento TRUE tem de ser ACEITE e gravar o WHEN
  begin
    v_res := public.registar_inscricao(
      'Teste Aceite', 'teste-aceite@exemplo.invalid', '+351912345679', null, true
    );
    if exists (
      select 1 from public.inscricoes
       where email = 'teste-aceite@exemplo.invalid'
         and consentimento = true
         and consentimento_em is not null
    ) then
      raise notice 'OK 4b — consentimento=true aceite, consentimento_em gravado.';
    else
      raise warning 'FALHOU 4b — linha criada sem consentimento_em.';
    end if;
    delete from public.inscricoes where email = 'teste-aceite@exemplo.invalid';
    raise notice 'Registo de teste 4b removido.';
  exception when others then
    raise warning 'FALHOU 4b — erro inesperado: %', sqlerrm;
    delete from public.inscricoes where email = 'teste-aceite@exemplo.invalid';
  end;

  -- 4c. PATROCÍNIO: consentimento FALSE tem de ser RECUSADO.
  --     Só corre bem depois de 1a do passo 1 (tabela public.sponsors).
  begin
    v_res := public.registar_sponsor(
      'Teste Rejeicao Sponsor', 'teste-rejeicao-sponsor@exemplo.invalid',
      '+351912345678', 75, null, false
    );
    raise warning 'FALHOU 4c — a funcao ACEITOU consentimento=false. Investigar.';
    delete from public.sponsors where email = 'teste-rejeicao-sponsor@exemplo.invalid';
  exception when others then
    if sqlerrm = 'consentimento_obrigatorio' then
      raise notice 'OK 4c — patrocinio consentimento=false recusado, como esperado.';
    else
      raise warning 'FALHOU 4c — erro inesperado: %', sqlerrm;
    end if;
  end;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. VERIFICAÇÃO FINAL (só leitura — nunca aborta)
-- ═════════════════════════════════════════════════════════════════════════════
select 'coluna' as tipo, column_name as nome, data_type as detalhe
  from information_schema.columns
 where table_schema = 'public' and table_name = 'inscricoes'
   and column_name in ('consentimento', 'consentimento_em')
union all
select 'funcao', p.proname,
       pg_get_function_identity_arguments(p.oid) || '  ['
       || case when p.prosecdef then 'DEFINER' else 'INVOKER' end || ', '
       || coalesce(array_to_string(p.proconfig, ','), 'SEM search_path') || ']'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('registar_inscricao', 'registar_sponsor',
                     'definir_nivel_sponsor', 'definir_metodo_sponsor')
 order by 1, 2, 3;

-- ESPERADO:
--   coluna  consentimento        boolean
--   coluna  consentimento_em     timestamp with time zone
--   funcao  registar_inscricao   4 args   [DEFINER, search_path=]
--   funcao  registar_inscricao   5 args   [DEFINER, search_path=]   ← a nova
--   funcao  registar_sponsor     7 args   [DEFINER, search_path=]
--   funcao  definir_nivel_sponsor / definir_metodo_sponsor


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. PASSO SEPARADO — NÃO CORRER AGORA
--    Só depois de a produção estar a gravar consentimento=true de verdade:
--
--      drop function public.registar_inscricao(text, text, text, text);
--
--    Enquanto as duas coexistirem, o Postgres resolve por número de argumentos.
--    Se algo continuar a chamar a de 4, o consentimento nunca é gravado e
--    ninguém dá por isso.
-- ═════════════════════════════════════════════════════════════════════════════
