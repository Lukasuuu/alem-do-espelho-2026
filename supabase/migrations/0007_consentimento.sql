-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — RGPD: consentimento explícito na inscrição
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0006).
--
-- PORQUÊ (Lucas, 11/08): o formulário de inscrição passa a exigir uma
-- checkbox de consentimento separada. O valor tem de ser GRAVADO na base
-- e a função tem de RECUSAR quando não vier true — nunca persistir um
-- não-consentimento.
--
-- O QUE ESTA MIGRATION FAZ:
--   1. colunas novas em public.inscricoes: `consentimento` (boolean NOT
--      NULL default false) e `consentimento_em` (timestamptz, o WHEN do
--      consentimento — não só o IF). Os 4 registos existentes ficam com
--      false. SEM consentimento retroativo inventado.
--   2. SOBRECARGA nova de registar_inscricao com 5 args
--      (p_consentimento boolean). A de 4 args NÃO é alterada nem removida
--      aqui: enquanto as duas coexistem o Postgres resolve por aridade e
--      o código que ainda chame a de 4 args não quebra.
--
-- 🔴 PASSO 4 (SEPARADO, DEPOIS DE VERIFICADO): quando o grep confirmar que
--    não resta NENHUMA chamada com 4 argumentos, correr
--    `drop function public.registar_inscricao(text, text, text, text);`
--    Enquanto as duas coexistirem, se algo continuar a chamar a de 4 args,
--    o consentimento NUNCA é gravado e ninguém dá por isso.
--    (⚠️ NÃO incluir o drop nesta migration.)
--
-- ⚠️ NUNCA alterar a assinatura em uso (foi o bug de 10/08 de manhã que
--    partiu as inscrições em produção): a 4-arg continua a existir até ao
--    drop verificável. O CREATE OR REPLACE abaixo é idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ── 1/3 Colunas novas ──────────────────────────────────────────
alter table public.inscricoes
  add column if not exists consentimento boolean not null default false,
  add column if not exists consentimento_em timestamptz;

-- ── 2/3 Overload 5-arg de registar_inscricao ──────────────────
-- Corpo IDÊNTICO ao da 4-arg (o FIX-0 corrigido em produção) MAIS:
--   · primeiro statement: recusa se p_consentimento não for true
--   · grava consentimento = true e consentimento_em = now() (update e insert)
-- TODAS as referências qualificadas (public.inscricoes) — é o defeito que
-- partiu a função em 10/08 e o CREATE passa na mesma.
create or replace function public.registar_inscricao(
  p_nome          text,
  p_email         text,
  p_telefone      text,
  p_ip_hash       text default null,
  p_consentimento boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  -- RGPD (Lucas, 11/08): o consentimento é obrigatório e tem de ser true.
  -- `is distinct from true` cobre null E false. Defesa em profundidade:
  -- a rota já exige literal(true) no zod — mas se algo chamar a função
  -- sem consentimento, RECUSA em vez de gravar false silenciosamente.
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
    -- Quem voltou (ex. pagamento falhou e recomeçou) atualiza os dados.
    -- Se a inscrição tinha sido cancelada, volta a 'pendente' com método por escolher.
    -- O consentimento é re-confirmado a cada submissão: grava true + o WHEN.
    update public.inscricoes
       set nome      = p_nome,
           telefone  = p_telefone,
           status    = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end,
           consentimento     = true,
           consentimento_em  = now()
     where id = v_existing.id
     returning id into v_id;
    v_status := 'ja_inscrita';
    -- Re-submissão: já pode ter bónus, não alterar
    v_bonus := v_existing.is_bonus;
  else
    insert into public.inscricoes (nome, email, telefone, ip_hash, consentimento, consentimento_em)
    values (p_nome, p_email, p_telefone, p_ip_hash, true, now())
    returning id into v_id;
    v_status := 'criada';

    -- ── Atribuição de bónus (só para novas inscrições) ──
    -- Verifica janela de campanha (05/08 22:00 → 10/08 10:00 Lisboa)
    if now() between v_inicio and v_fim then
      -- Conta bónus existentes com FOR UPDATE para serializar
      select count(*)::int into v_count
        from public.inscricoes
       where is_bonus = true
         and status <> 'cancelado'
         for update;

      if v_count < 50 then
        update public.inscricoes
           set is_bonus = true
         where id = v_id;
        v_bonus := true;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'status',  v_status,
    'id',      v_id,
    'is_bonus', v_bonus
  );
end;
$$;

revoke all on function public.registar_inscricao(text, text, text, text, boolean) from public;
grant execute on function public.registar_inscricao(text, text, text, text, boolean)
  to anon, authenticated, service_role;

-- ── 3/3 Verificação (correr depois) ────────────────────────────
-- Colunas novas presentes e com o default correto:
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'inscricoes'
   and column_name in ('consentimento', 'consentimento_em')
 order by ordinal_position;

-- Duas assinaturas a coexistir (4-arg e 5-arg) — a 5-arg com SECURITY
-- DEFINER, search_path vazio e grant para anon:
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       case when p.prosecdef then 'DEFINER' else 'INVOKER' end as seg,
       array_to_string(p.proconfig, ',') as cfg
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'registar_inscricao'
 order by 2;
