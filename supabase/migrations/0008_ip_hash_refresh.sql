-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — 0008: B0 (desbloqueio + fecho de buraco RGPD)
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0007).
--
-- FUSÃO DE DUAS CORREÇÕES (Lucas, 05/09):
--
-- A. CLEANUP DE ip_hash APÓS ROTAÇÃO DO IP_HASH_SALT (script do Lucas):
--    o hash é calculado na app (Next.js) com IP_HASH_SALT e chega já
--    pronto às RPC (p_ip_hash); a BD apenas o ARMAZENA e o COMPARA
--    (if ip_hash is not null and ip_hash <> p_ip_hash → acesso_negado).
--    Com o salt regenerado, TODOS os hashes guardados ficaram obsoletos
--    e nunca mais coincidem → visitante legítimo apanha acesso_negado.
--    A BD não pode re-hashear (por design nunca vê o IP em claro).
--    Correção: anular os hashes obsoletos. ip_hash NULL = sem restrição
--    por IP (gate ignorado quando é null) + minimização de dados.
--    NB (Claude): as inscrições pagas ESTÃO ativas (o corte de 10/08 foi
--    da lista gratuita) — o gate ainda funciona no fluxo atual; por isso
--    o refresh do hash no UPDATE (C.b) mantém-se até o B1 (0009) o
--    substituir pelo token de posse.
--
-- B. DROP da sobrecarga 4-arg (oid 25384) — RGPD. A 4-arg tem execute
--    concedido a anon E não verifica consentimento; a anon key é pública
--    (bundle) → qualquer pessoa pode criar/alterar inscrições sem
--    consentimento, assim desde a 0007, e seria a via para contornar o
--    guard. Grep no src: único chamador usa a 5-arg (route.ts:100).
--
-- C. CREATE OR REPLACE da 5-arg com:
--    b) refrescar ip_hash no ramo UPDATE (re-submissão do formulário com
--       consentimento re-prova posse, igual à criação) — desbloqueia o
--       acesso_negado do criar_pagamento para quem volta por IP diferente;
--    a) guard inscricao_confirmada (22023): inscrição paga não volta ao
--       formulário — fecha o takeover por email conhecido.
--    REVERSÍVEL (down): voltar a correr a 0007 + recriar a 4-arg (corpo
--    da 0006/0007, com revoke do anon — NUNCA restaurar o grant anon).
--
-- D. REGISTO DE MIGRATIONS: tabela public.migrations_aplicadas, registo
--    a partir da 0008 (decisão: nem "tudo fora" nem retroativos completos
--    que não se pode verificar), com linhas retroativas 0006/0007.
--
-- Idempotente: os UPDATE ... WHERE is not null são no-op em re-execução;
-- os create/drop/revoke/grant são re-executáveis; on conflict do nothing.
-- Efeito colateral: se existir trigger set_updated_at (BEFORE UPDATE),
-- o updated_at destas linhas passa a now(). Inofensivo para este cleanup.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── A. Anular hashes obsoletos (salt rodou; NULL = sem gate por IP) ──
update public.inscricoes
   set ip_hash = null
 where ip_hash is not null;

update public.waitlist_subscribers
   set ip_hash = null
 where ip_hash is not null;

update public.sponsors
   set ip_hash = null
 where ip_hash is not null;

-- ── B. DROP da 4-arg (RGPD — antes do create, ordem do Lucas) ──
drop function if exists public.registar_inscricao(text, text, text, text);

-- ── C. CREATE OR REPLACE da 5-arg ──────────────────────────────
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
    -- Guard (Lucas, 05/09): inscrição já confirmada (paga) não pode ser
    -- retomada por re-submissão — fecha o takeover por email conhecido.
    if v_existing.status = 'confirmado' then
      raise exception 'inscricao_confirmada' using errcode = '22023';
    end if;

    -- Quem voltou (ex. pagamento falhou e recomeçou) atualiza os dados.
    -- Se a inscrição tinha sido cancelada, volta a 'pendente' com método por escolher.
    -- O consentimento é re-confirmado a cada submissão: grava true + o WHEN.
    -- B0: refresca também o ip_hash — a re-submissão é a prova de posse
    -- (hashes antigos já foram anulados em A; daqui em diante grava-se o
    -- hash novo e a re-submissão mantém-no sincronizado até ao B1).
    update public.inscricoes
       set nome      = p_nome,
           telefone  = p_telefone,
           status    = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end,
           ip_hash   = p_ip_hash,
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
    -- ⚠️ NOTA (Lucas, 05/09): `select count(*) ... for update` é rejeitado
    -- pelo Postgres (FOR UPDATE não combina com agregações) — este bloco
    -- levantaria erro em runtime se a janela estivesse aberta. Está
    -- dormente desde 10/08. AUDITAR À PARTE (task #20).
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

-- ── D. Registo de migrations (a partir da 0008) ────────────────
create table if not exists public.migrations_aplicadas (
  nome        text primary key,
  aplicada_em timestamptz not null default now(),
  origem      text not null default 'sql_editor',
  nota        text
);

insert into public.migrations_aplicadas (nome, nota) values
  ('0006_pagamentos',      'retroativa: aplicada antes do registo (confirmada 05/09)'),
  ('0007_consentimento',   'retroativa: aplicada antes do registo (confirmada 05/09)'),
  ('0008_ip_hash_refresh', 'B0: cleanup ip_hash (salt rodou) + drop 4-arg RGPD + guard confirmado')
on conflict (nome) do nothing;

commit;

-- ── Verificação (correr no fim e confirmar o resultado) ───────
-- Esperado: tem_refresh_hash = true, tem_guard = true, uma única linha (a 5-arg).
select
  (prosrc like '%ip_hash = p_ip_hash%')     as tem_refresh_hash,
  (prosrc like '%inscricao_confirmada%')    as tem_guard,
  pg_get_function_identity_arguments(oid)   as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'registar_inscricao';

-- Esperado: só a 5-arg — a 4-arg já não existe.
select oid, proname, pg_get_function_identity_arguments(oid) as args,
       case when prosecdef then 'DEFINER' else 'INVOKER' end as seg
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'registar_inscricao';

-- Esperado: 3 linhas (0006, 0007, 0008).
select * from public.migrations_aplicadas order by aplicada_em;