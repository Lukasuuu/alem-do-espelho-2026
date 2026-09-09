-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — Bloco J r2 (patrocínio): pagamentos,
-- comprovativos e posse_token — MIGRATION ADITIVA (sem downtime).
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0009/0010).
-- Fica aqui versionado para recriar o ambiente do zero se preciso.
-- REVERSÍVEL — bloco de down comentado no fim.
--
-- ADITIVA POR DESIGN (revisão r2):
--   • as RPCs antigas de 2 argumentos (definir_nivel_sponsor(uuid,integer)
--     da 0005 e definir_metodo_sponsor(uuid,text) da 0004) NÃO são tocadas
--     — o frontend em produção continua a funcionar enquanto o Preview é
--     testado. O hardening (drop das 2-arg) fica na 0012, aplicada SÓ
--     depois do frontend novo estar em produção e validado.
--   • registar_sponsor é create or replace da MESMA assinatura 7-arg
--     (0005:29-37) — o corpo muda, a assinatura não.
--
-- Fluxo que suporta:
--   registar_sponsor (token UMA vez; anti-takeover) → definir_nivel_sponsor
--   3-arg (bloqueado com pagamento ativo) → iniciar_pagamento_sponsor
--   (ATÓMICA: método+pagamento numa transação, race-safe, valor = nível)
--   → pagar → validar_comprovativo_upload_sponsor (awaiting_proof) →
--   upload direto (signed) para o bucket PRIVADO sponsor-payment-proofs →
--   registar_comprovativo_sponsor (proof_uploaded, canal upload) OU
--   marcar_comprovativo_whatsapp_sponsor (handoff Vitória) → admin
--   confirma (confirmed + sponsors.status='confirmado') | rejeita
--   (rejected + reenvio permitido). estado_sponsor = polling.
--
-- Segurança (mesmos guardrails de 0006/0009):
--   • RLS ativo, ZERO policies diretas nas tabelas — só SECURITY DEFINER RPCs.
--   • set search_path = '' em tudo; nomes sempre qualificados.
--   • Posse por posse_token (hex 64, padrão B1/0009) — guard acesso_negado 42501.
--   • ANTI-TAKEOVER: re-submeter o email de quem tem pagamento ativo ou
--     patrocínio confirmado NÃO roda o token nem altera o registo — devolve
--     'ja_existente' sem posse_token (recuperação humana pela Vitória).
--   • Storage: bucket NOVO e PRIVADO sponsor-payment-proofs, com policies
--     próprias. O bucket payment-proofs das inscrições NÃO é tocado.
--   • confirmar/rejeitar: só service_role (admin), nunca anon/authenticated.
--   • NUNCA ::citext (cast pelo nome rebenta com search_path vazio).
--   • heic/heif nos guards desde o dia 1.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. posse_token na tabela sponsors (padrão 0009:14)
--    ip_hash mantém-se como sinal de abuso — sem migração de dados.
-- ───────────────────────────────────────────────────────────────
alter table public.sponsors add column if not exists posse_token text unique;

-- ───────────────────────────────────────────────────────────────
-- 2. Bucket PRIVADO dedicado ao patrocínio (ISOLAMENTO total das
--    inscrições — o payment-proofs de 0006 NÃO é tocado).
-- ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sponsor-payment-proofs',
  'sponsor-payment-proofs',
  false,
  8388608,
  array['image/png','image/jpeg','image/webp','application/pdf','image/heic','image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 8388608,
      allowed_mime_types = excluded.allowed_mime_types;

-- ───────────────────────────────────────────────────────────────
-- 3. Tabela pagamentos_sponsor (domínio EXCLUSIVO do patrocínio;
--    nunca toca em public.pagamentos das inscrições)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.pagamentos_sponsor (
  id                  uuid         primary key default gen_random_uuid(),
  sponsor_id          uuid         not null references public.sponsors(id) on delete cascade,
  -- Valor SEM default: derivado do nível pela RPC (75/150/200) — nunca
  -- confiar num valor enviado pelo cliente.
  valor               numeric(8,2) not null,
  moeda               text         not null default 'EUR',
  -- Patrocínio é SEMPRE sem cartão/QR/SumUp: só MB Way ou transferência.
  metodo              text         not null check (metodo in ('mbway','transferencia')),
  estado              text         not null default 'pending'
                                   check (estado in (
                                     'pending','payment_started','awaiting_proof',
                                     'proof_uploaded','under_review','confirmed',
                                     'rejected','cancelled'
                                   )),
  referencia_externa  text,
  proof_token         uuid         unique not null default gen_random_uuid(),
  -- Motivo da última rejeição (para o modal mostrar à pessoa e permitir reenvio).
  motivo_rejeicao     text,
  -- Como o comprovativo chegou: upload no site ou handoff WhatsApp Vitória.
  canal_comprovativo  text         check (canal_comprovativo in ('upload','whatsapp')),
  -- Momento em que a pessoa foi encaminhada para o WhatsApp da Vitória.
  whatsapp_handoff_at timestamptz,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now(),
  paid_at             timestamptz,
  confirmed_at        timestamptz
);

-- Nada de RLS policies: acesso só via RPC SECURITY DEFINER.
alter table public.pagamentos_sponsor enable row level security;

create index if not exists pagamentos_sponsor_sponsor_id_idx
  on public.pagamentos_sponsor (sponsor_id);
create index if not exists pagamentos_sponsor_estado_idx
  on public.pagamentos_sponsor (estado);

-- Máximo de 1 pagamento ativo por patrocínio (idempotência; espelho 0006:59).
-- A RPC iniciar_pagamento_sponsor trata a corrida por exceção — o índice é
-- a rede de segurança, não o único mecanismo.
create unique index if not exists pagamentos_sponsor_um_ativo_idx
  on public.pagamentos_sponsor (sponsor_id)
  where estado not in ('cancelled','rejected');

drop trigger if exists pagamentos_sponsor_set_updated_at on public.pagamentos_sponsor;
create trigger pagamentos_sponsor_set_updated_at
  before update on public.pagamentos_sponsor
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 4. Tabela comprovativos_sponsor (espelho de comprovativos 0006:71-83,
--    domínio exclusivo do patrocínio)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.comprovativos_sponsor (
  id                  uuid         primary key default gen_random_uuid(),
  pagamento_id        uuid         not null references public.pagamentos_sponsor(id) on delete cascade,
  storage_path        text         unique not null,
  original_filename   text         not null,
  mime_type           text         not null,
  file_size           integer      not null,
  status              text         not null default 'aguardando_confirmacao'
                                   check (status in ('aguardando_confirmacao','aprovado','rejeitado')),
  uploaded_at         timestamptz  not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         text
);

alter table public.comprovativos_sponsor enable row level security;

create index if not exists comprovativos_sponsor_pagamento_id_idx
  on public.comprovativos_sponsor (pagamento_id);

-- ───────────────────────────────────────────────────────────────
-- 5. RPC: registar_sponsor (create or replace, MESMA assinatura 7-arg)
--    REVISÃO r2 — anti-takeover:
--      • email NOVO → insert + token (status 'criada');
--      • email existente SEM pagamento ativo e NÃO confirmado → update +
--        token NOVO (reentrada legítima: ex. falhou a meio, pagamento
--        rejeitado/cancelado; nivel só é alterado se vier preenchido);
--      • email existente COM pagamento ativo (qualquer estado fora de
--        cancelled/rejected) ou status 'confirmado' → NÃO altera nada,
--        NÃO roda token, devolve 'ja_existente' SEM posse_token. Quem só
--        conhece o email não toma posse do registo de outra pessoa.
--    Corrida de insert duplicado (unique email) → tratada, sem 23505 exposto.
-- ───────────────────────────────────────────────────────────────
create or replace function public.registar_sponsor(
  p_nome          text,
  p_email         text,
  p_telefone      text,
  p_nivel         integer default null,
  p_empresa       text default null,
  p_consentimento boolean default false,
  p_ip_hash       text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.sponsors%rowtype;
  v_id       uuid;
  v_status   text;
  v_token    text;
  v_protegido boolean;
begin
  p_nome          := trim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'));
  p_email         := lower(trim(coalesce(p_email,'')));
  p_telefone      := regexp_replace(coalesce(p_telefone,''), '[^0-9+]', '', 'g');
  p_empresa       := trim(regexp_replace(coalesce(p_empresa,''), '\s+', ' ', 'g'));
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
  -- Nível só é validado quando já veio escolhido (passo B); null é válido aqui.
  if p_nivel is not null and p_nivel not in (75, 150, 200) then
    raise exception 'invalid_nivel' using errcode = '22023';
  end if;

  -- RGPD (Lucas, 11/08): o consentimento é obrigatório e tem de ser true.
  if p_consentimento is distinct from true then
    raise exception 'consentimento_obrigatorio' using errcode = '22023';
  end if;

  select * into v_existing from public.sponsors where email = p_email;

  if found then
    -- Anti-takeover: pagamento ativo (fora de cancelled/rejected) ou
    -- patrocínio já confirmado ⇒ o registo NÃO é re-aberto por quem só
    -- conhece o email. Sem token, sem update — recuperação é humana
    -- (Vitória). Nunca devolver posse_token aqui.
    select exists (
      select 1
        from public.pagamentos_sponsor pa
       where pa.sponsor_id = v_existing.id
         and pa.estado not in ('cancelled','rejected')
    ) into v_protegido;

    if v_protegido or v_existing.status = 'confirmado' then
      return jsonb_build_object('status', 'ja_existente', 'id', v_existing.id);
    end if;

    -- Reentrada legítima (sem pagamento ativo, não confirmada): atualiza os
    -- dados e emite token NOVO (a posse anterior morre — padrão 0009:41).
    -- nivel PRESERVADO quando a submissão vem sem nível (passo A) — nunca
    -- zerar um nível já escolhido.
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.sponsors
       set nome          = p_nome,
           telefone      = p_telefone,
           nivel         = coalesce(p_nivel, nivel),
           empresa       = p_empresa,
           consentimento = p_consentimento,
           posse_token   = v_token,
           status        = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end
     where id = v_existing.id
     returning id into v_id;
    v_status := 'ja_existente';
  else
    -- Token de posse nasce SEMPRE no servidor (hex 64, padrão 0009:41).
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    begin
      insert into public.sponsors (nome, email, telefone, nivel, empresa, consentimento, posse_token, ip_hash)
      values (p_nome, p_email, p_telefone, p_nivel, p_empresa, p_consentimento, v_token, p_ip_hash)
      returning id into v_id;
      v_status := 'criada';
    exception
      -- Corrida: outra request inseriu o mesmo email entre o select e o insert.
      -- Não expor 23505: tratar como já existente, SEM token (a outra request
      -- ganhou a posse — quem aqui chega não prova ser o dono).
      when unique_violation then
        select id into v_id from public.sponsors where email = p_email;
        return jsonb_build_object('status', 'ja_existente', 'id', v_id);
    end;
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id, 'nivel', p_nivel, 'posse_token', v_token);
end;
$$;

revoke all on function public.registar_sponsor(text, text, text, integer, text, boolean, text) from public;
grant execute on function public.registar_sponsor(text, text, text, integer, text, boolean, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 6. RPC NOVA: iniciar_pagamento_sponsor — ATÓMICA (revisão r2).
--    Método + pagamento numa ÚNICA transação (elimina a sequência
--    definir_metodo → criar_pagamento que deixava sponsors.metodo_pagamento
--    escrito sem pagamento quando a 2.ª escrita falhava).
--    Na MESMA transação: 1 valida método; 2 valida posse; 3 valida sponsor;
--    4 valida nível; 5 deriva valor do nível; 6 trata pagamento ativo
--    (reutiliza / troca método antes do comprovativo / bloqueia após);
--    7 atualiza sponsors.metodo_pagamento; 8 cria/reutiliza pagamento
--    race-safe (unique_violation do índice parcial é capturada — nunca 500
--    por corrida); 9 devolve pagamento_id + estado.
--    Troca de método (§10): payment_started/awaiting_proof sem comprovativo
--    → atualiza o MESMO pagamento; proof_uploaded/under_review →
--    'pagamento_em_analise'; confirmed → 'pagamento_confirmado'.
-- ───────────────────────────────────────────────────────────────
create or replace function public.iniciar_pagamento_sponsor(
  p_sponsor_id  uuid,
  p_metodo      text,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_posse      text;
  v_nivel      integer;
  v_status     text;
  v_pagamento_id   uuid;
  v_proof_token    uuid;
  v_estado         text;
  v_metodo_atual   text;
  v_criado         boolean;
begin
  if p_metodo not in ('mbway','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;

  select s.posse_token, s.nivel, s.status
    into v_posse, v_nivel, v_status
    from public.sponsors s
   where s.id = p_sponsor_id;

  if not found then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;

  -- Guard de posse ANTES de qualquer detalhe de negócio.
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  -- O nível é escolhido no passo B, antes da modal C — sem ele não há valor.
  if v_nivel is null then
    raise exception 'nivel_nao_definido' using errcode = '22023';
  end if;

  -- Patrocínio já confirmado não reabre pagamento.
  if v_status = 'confirmado' then
    raise exception 'pagamento_confirmado' using errcode = '22023';
  end if;

  -- Corrida (§9): tenta INSERIR primeiro. Se o índice parcial disparar
  -- unique_violation, a request concorrente ganhou — adoptamos a linha dela
  -- (for update) e seguimos o mesmo ramo de "pagamento ativo existente".
  v_criado := true;
  begin
    insert into public.pagamentos_sponsor (sponsor_id, metodo, valor, estado)
    values (p_sponsor_id, p_metodo, v_nivel, 'payment_started')
    returning id, proof_token, estado into v_pagamento_id, v_proof_token, v_estado;
  exception
    when unique_violation then
      v_criado := false;
      select p.id, p.proof_token, p.estado, p.metodo
        into v_pagamento_id, v_proof_token, v_estado, v_metodo_atual
        from public.pagamentos_sponsor p
       where p.sponsor_id = p_sponsor_id
         and p.estado not in ('cancelled','rejected')
       order by p.created_at desc, p.id desc
       limit 1
       for update;
      if v_pagamento_id is null then
        -- O índice disse que havia ativo e o select não o encontrou — corrida
        -- com cancelamento em simultâneo. Repete a exceção original: a request
        -- repete e o fluxo recomeça limpo.
        raise;
      end if;
  end;

  if not v_criado then
    if v_estado = 'confirmed' then
      raise exception 'pagamento_confirmado' using errcode = '22023';
    end if;
    if v_estado in ('proof_uploaded','under_review') then
      raise exception 'pagamento_em_analise' using errcode = '22023';
    end if;
    -- payment_started/awaiting_proof sem comprovativo: troca de método
    -- atualiza o MESMO pagamento (não cria um novo, não zera nada).
    if v_metodo_atual <> p_metodo and v_estado in ('payment_started','awaiting_proof') then
      update public.pagamentos_sponsor
         set metodo = p_metodo, updated_at = now()
       where id = v_pagamento_id;
    end if;
    v_estado := case when v_estado in ('payment_started','awaiting_proof')
                     then v_estado else v_estado end;
  end if;

  -- sponsors.metodo_pagamento acompanha o pagamento (transação única —
  -- nunca fica escrito sem pagamento).
  update public.sponsors set metodo_pagamento = p_metodo where id = p_sponsor_id;

  return jsonb_build_object(
    'status',       case when v_criado then 'criado' else 'existente' end,
    'pagamento_id', v_pagamento_id,
    'estado',       v_estado,
    'metodo',       p_metodo,
    'valor',        v_nivel
  );
end;
$$;

revoke all on function public.iniciar_pagamento_sponsor(uuid, text, text) from public;
grant execute on function public.iniciar_pagamento_sponsor(uuid, text, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 7. RPCs definir_nivel_sponsor / definir_metodo_sponsor — OVERLOADS de 3
--    argumentos (posse_token). ADITIVO: as assinaturas antigas de 2 args
--    (0005:104-108 e 0004:115-119) NÃO são tocadas — o frontend em produção
--    continua a funcionar até à 0012. Guard de posse PRIMEIRO (não vazar
--    estado sem token). O 3-arg de nível BLOQUEIA alteração com pagamento
--    ativo (§11): ou cancela o pagamento explicitamente, ou recomeça —
--    nunca sponsors.nivel=200 com pagamentos_sponsor.valor=75.
-- ───────────────────────────────────────────────────────────────
drop function if exists public.definir_nivel_sponsor(uuid, integer, text);
create or replace function public.definir_nivel_sponsor(
  p_sponsor_id  uuid,
  p_nivel       integer,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_posse  text;
  v_ativo  boolean;
begin
  select posse_token into v_posse from public.sponsors where id = p_sponsor_id;
  if not found then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  if p_nivel not in (75, 150, 200) then
    raise exception 'invalid_nivel' using errcode = '22023';
  end if;

  -- §11: com pagamento ativo o nível está congelado (o valor já foi
  -- derivado). A alteração exige voltar ao início do pagamento.
  select exists (
    select 1
      from public.pagamentos_sponsor pa
     where pa.sponsor_id = p_sponsor_id
       and pa.estado not in ('cancelled','rejected')
  ) into v_ativo;
  if v_ativo then
    raise exception 'nivel_bloqueado' using errcode = '22023';
  end if;

  update public.sponsors set nivel = p_nivel where id = p_sponsor_id;
  return jsonb_build_object('status', 'ok', 'id', p_sponsor_id, 'nivel', p_nivel);
end;
$$;
revoke all on function public.definir_nivel_sponsor(uuid, integer, text) from public;
grant execute on function public.definir_nivel_sponsor(uuid, integer, text)
  to anon, authenticated, service_role;

drop function if exists public.definir_metodo_sponsor(uuid, text, text);
create or replace function public.definir_metodo_sponsor(
  p_sponsor_id  uuid,
  p_metodo      text,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_posse text;
begin
  select posse_token into v_posse from public.sponsors where id = p_sponsor_id;
  if not found then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  if p_metodo not in ('mbway','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;

  update public.sponsors set metodo_pagamento = p_metodo where id = p_sponsor_id;
  return jsonb_build_object('status', 'ok', 'id', p_sponsor_id, 'metodo', p_metodo);
end;
$$;
revoke all on function public.definir_metodo_sponsor(uuid, text, text) from public;
grant execute on function public.definir_metodo_sponsor(uuid, text, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 8. RPC: validar_comprovativo_upload_sponsor (espelho 0009:164-186)
--    Corre ANTES do upload: devolve o proof_token para a rota montar o
--    path do bucket sponsor-payment-proofs e faz a transição
--    payment_started/rejected → awaiting_proof.
-- ───────────────────────────────────────────────────────────────
create or replace function public.validar_comprovativo_upload_sponsor(
  p_pagamento_id uuid,
  p_sponsor_id   uuid,
  p_posse_token  text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_estado text; v_token uuid; v_posse text;
begin
  select p.estado, p.proof_token, s.posse_token into v_estado, v_token, v_posse
    from public.pagamentos_sponsor p
    join public.sponsors s on s.id = p.sponsor_id
   where p.id = p_pagamento_id and p.sponsor_id = p_sponsor_id;
  if v_estado is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if v_estado not in ('payment_started','awaiting_proof','proof_uploaded','rejected') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;
  if v_estado in ('payment_started','rejected') then
    update public.pagamentos_sponsor
       set estado = 'awaiting_proof', updated_at = now(), motivo_rejeicao = null
     where id = p_pagamento_id;
  end if;
  return jsonb_build_object('ok', true, 'proof_token', v_token, 'estado', 'awaiting_proof');
end;
$$;

revoke all on function public.validar_comprovativo_upload_sponsor(uuid, uuid, text) from public;
grant execute on function public.validar_comprovativo_upload_sponsor(uuid, uuid, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 9. RPC: registar_comprovativo_sponsor (espelho 0009:190-230)
--    Path tem de apontar para o bucket DEDICADO, pasta deste sponsor e
--    proof_token deste pagamento:
--      sponsor-payment-proofs/{sponsor_id}/{proof_token}/{uuid}.{ext}
--    heic/heif aceites (não regredir o Bloco D). Nunca base64.
--    Upload concluído ⇒ canal_comprovativo='upload', estado='proof_uploaded'.
--    NUNCA confirmed, NUNCA paid_at — confirmação é só admin (RPC 12).
-- ───────────────────────────────────────────────────────────────
create or replace function public.registar_comprovativo_sponsor(
  p_pagamento_id      uuid,
  p_storage_path      text,
  p_original_filename text,
  p_mime_type         text,
  p_file_size         integer,
  p_posse_token       text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_estado text; v_token uuid; v_posse text;
  v_sponsor_id uuid;
  v_comprovativo_id uuid; v_ext text;
begin
  select p.estado, p.proof_token, s.posse_token, p.sponsor_id
    into v_estado, v_token, v_posse, v_sponsor_id
    from public.pagamentos_sponsor p
    join public.sponsors s on s.id = p.sponsor_id
   where p.id = p_pagamento_id
   for update;
  if v_estado is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if v_estado not in ('awaiting_proof','proof_uploaded','rejected') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;
  -- Path: sponsor-payment-proofs/{sponsor_id}/{proof_token}/{uuid}.{ext}
  if split_part(p_storage_path, '/', 1) <> 'sponsor-payment-proofs'
     or split_part(p_storage_path, '/', 2) <> v_sponsor_id::text
     or split_part(p_storage_path, '/', 3) <> v_token::text then
    raise exception 'storage_path_invalido' using errcode = '22023';
  end if;
  v_ext := lower(split_part(lower(p_storage_path), '.', -1));
  if v_ext not in ('png','jpg','jpeg','webp','pdf','heic','heif') then
    raise exception 'extensao_invalida' using errcode = '22023';
  end if;
  if p_file_size is null or p_file_size <= 0 or p_file_size > 8388608 then
    raise exception 'tamanho_invalido' using errcode = '22023';
  end if;
  if p_mime_type not in ('image/png','image/jpeg','image/webp','application/pdf','image/heic','image/heif') then
    raise exception 'mime_invalido' using errcode = '22023';
  end if;
  insert into public.comprovativos_sponsor
    (pagamento_id, storage_path, original_filename, mime_type, file_size, status)
  values
    (p_pagamento_id, p_storage_path, p_original_filename, p_mime_type, p_file_size, 'aguardando_confirmacao')
  returning id into v_comprovativo_id;
  update public.pagamentos_sponsor
     set estado = 'proof_uploaded',
         canal_comprovativo = 'upload',
         updated_at = now(),
         motivo_rejeicao = null
   where id = p_pagamento_id;
  return jsonb_build_object(
    'status','recebido','comprovativo_id',v_comprovativo_id,
    'pagamento_estado','proof_uploaded'
  );
end;
$$;

revoke all on function public.registar_comprovativo_sponsor(uuid, text, text, text, integer, text) from public;
grant execute on function public.registar_comprovativo_sponsor(uuid, text, text, text, integer, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 10. RPC NOVA: marcar_comprovativo_whatsapp_sponsor — handoff Vitória.
--     Corre ANTES de abrir o WhatsApp (a UI só abre a conversa se esta
--     escrita responder OK). Regista o canal e o momento; o pagamento vai
--     para awaiting_proof (a menos que já tenha comprovativo em análise —
--     nesse caso o estado mantém-se e só o canal/handoff ficam registados).
-- ───────────────────────────────────────────────────────────────
create or replace function public.marcar_comprovativo_whatsapp_sponsor(
  p_sponsor_id  uuid,
  p_pagamento_id uuid,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_estado text; v_posse text; v_sponsor_id uuid;
begin
  select p.estado, s.posse_token, p.sponsor_id
    into v_estado, v_posse, v_sponsor_id
    from public.pagamentos_sponsor p
    join public.sponsors s on s.id = p.sponsor_id
   where p.id = p_pagamento_id
   for update;
  if v_estado is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;
  -- Ownership: o pagamento tem de pertencer ao sponsor indicado.
  if v_sponsor_id <> p_sponsor_id then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if v_estado not in ('payment_started','awaiting_proof','proof_uploaded','rejected') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;

  update public.pagamentos_sponsor
     set canal_comprovativo = 'whatsapp',
         whatsapp_handoff_at = now(),
         estado = case when v_estado in ('payment_started','rejected')
                       then 'awaiting_proof' else v_estado end,
         updated_at = now(),
         motivo_rejeicao = case when v_estado = 'rejected' then null else motivo_rejeicao end
   where id = p_pagamento_id;

  return jsonb_build_object(
    'status', 'handoff_registado',
    'pagamento_estado', case when v_estado in ('payment_started','rejected')
                             then 'awaiting_proof' else v_estado end,
    'canal_comprovativo', 'whatsapp'
  );
end;
$$;

revoke all on function public.marcar_comprovativo_whatsapp_sponsor(uuid, uuid, text) from public;
grant execute on function public.marcar_comprovativo_whatsapp_sponsor(uuid, uuid, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 11. RPC: estado_sponsor (polling do modal; espelho estado_inscricao
--     0009:136-161). Leitura, sem escrita. Posse por token.
--     REVISÃO r2: só o pagamento ATIVO (exclui cancelled/rejected) e o
--     comprovativo DESSE pagamento — nunca misturar com pagamentos
--     rejeitados antigos.
-- ───────────────────────────────────────────────────────────────
create or replace function public.estado_sponsor(
  p_sponsor_id uuid,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sponsor public.sponsors%rowtype;
  v_pagamento_id uuid;
  v_pagamento_estado text;
  v_metodo text;
  v_valor numeric;
  v_motivo text;
  v_canal text;
  v_comprovativo text;
begin
  select * into v_sponsor from public.sponsors where id = p_sponsor_id;
  if v_sponsor.id is null then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;
  if p_posse_token is null or v_sponsor.posse_token is null or v_sponsor.posse_token <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  select p.id, p.estado, p.metodo, p.valor, p.motivo_rejeicao, p.canal_comprovativo
    into v_pagamento_id, v_pagamento_estado, v_metodo, v_valor, v_motivo, v_canal
    from public.pagamentos_sponsor p
   where p.sponsor_id = p_sponsor_id
     and p.estado not in ('cancelled','rejected')
   order by p.created_at desc, p.id desc
   limit 1;

  if v_pagamento_id is not null then
    select c.status
      into v_comprovativo
      from public.comprovativos_sponsor c
     where c.pagamento_id = v_pagamento_id
     order by c.uploaded_at desc, c.id desc
     limit 1;
  end if;

  return jsonb_build_object(
    'status',              v_sponsor.status,
    'nivel',               v_sponsor.nivel,
    'metodo',              v_metodo,
    'valor',               v_valor,
    'pagamento_id',        v_pagamento_id,
    'pagamento_estado',    coalesce(v_pagamento_estado, 'pending'),
    'canal_comprovativo',  v_canal,
    'motivo_rejeicao',     v_motivo,
    'comprovativo_status', v_comprovativo
  );
end;
$$;

revoke all on function public.estado_sponsor(uuid, text) from public;
grant execute on function public.estado_sponsor(uuid, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 12. RPCs ADMIN: confirmar / rejeitar (espelho 0006:506-586)
--     anon e authenticated NUNCA executam. Não há endpoint público.
--     Confirmar: estado confirmed, paid_at coalesce, confirmed_at now,
--     sponsors.status='confirmado', último comprovativo em análise → aprovado.
--     Rejeitar: estado rejected + motivo, comprovativo → rejeitado,
--     reenvio seguro (validar aceita 'rejected'; sponsor fica 'pendente').
-- ───────────────────────────────────────────────────────────────
create or replace function public.confirmar_pagamento_sponsor(
  p_pagamento_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sponsor_id uuid;
  v_estado text;
begin
  select p.sponsor_id, p.estado
    into v_sponsor_id, v_estado
    from public.pagamentos_sponsor p
   where p.id = p_pagamento_id
   for update;

  if v_sponsor_id is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;

  if v_estado not in ('awaiting_proof','proof_uploaded','under_review') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;

  update public.pagamentos_sponsor
     set estado = 'confirmed',
         paid_at = coalesce(paid_at, now()),
         confirmed_at = now(),
         updated_at = now()
   where id = p_pagamento_id;

  update public.sponsors
     set status = 'confirmado', updated_at = now()
   where id = v_sponsor_id;

  update public.comprovativos_sponsor
     set status = 'aprovado', reviewed_at = now()
   where pagamento_id = p_pagamento_id
     and status = 'aguardando_confirmacao';

  return jsonb_build_object('status','confirmado','pagamento_id',p_pagamento_id,'sponsor_id',v_sponsor_id);
end;
$$;

create or replace function public.rejeitar_pagamento_sponsor(
  p_pagamento_id uuid,
  p_motivo       text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sponsor_id uuid;
begin
  select p.sponsor_id
    into v_sponsor_id
    from public.pagamentos_sponsor p
   where p.id = p_pagamento_id
   for update;

  if v_sponsor_id is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;

  update public.pagamentos_sponsor
     set estado = 'rejected', updated_at = now(), motivo_rejeicao = p_motivo
   where id = p_pagamento_id;

  update public.comprovativos_sponsor
     set status = 'rejeitado', reviewed_at = now()
   where pagamento_id = p_pagamento_id
     and status = 'aguardando_confirmacao';

  -- sponsor mantém 'pendente' → novo comprovativo permitido
  -- (validar_comprovativo_upload_sponsor aceita 'rejected').

  return jsonb_build_object('status','rejeitado','pagamento_id',p_pagamento_id,'sponsor_id',v_sponsor_id,'motivo',p_motivo);
end;
$$;

-- Confirmar/rejeitar: só service_role. Nem anon, nem authenticated, nem public.
revoke all on function public.confirmar_pagamento_sponsor(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_pagamento_sponsor(uuid) to service_role;

revoke all on function public.rejeitar_pagamento_sponsor(uuid, text) from public, anon, authenticated;
grant execute on function public.rejeitar_pagamento_sponsor(uuid, text) to service_role;

-- ───────────────────────────────────────────────────────────────
-- 13. Storage: guards + policies SÓ no bucket sponsor-payment-proofs.
--     Path sponsor:
--       sponsor-payment-proofs/{sponsor_id}/{proof_token}/{uuid}.{ext}
--     O bucket payment-proofs das inscrições e as policies
--     payment_proofs_insert/select de 0006 NÃO são tocados.
--     heic/heif no regex desde o dia 1.
-- ───────────────────────────────────────────────────────────────
create or replace function public.comprovativo_sponsor_pode_upload(p_path text)
returns boolean language plpgsql security definer set search_path = '' stable as $$
declare
  v_partes text[];
  v_sponsor_id uuid;
  v_token uuid;
  v_existe boolean;
begin
  v_partes := string_to_array(p_path, '/');
  if array_length(v_partes, 1) <> 4
     or v_partes[1] <> 'sponsor-payment-proofs' then
    return false;
  end if;

  begin
    v_sponsor_id := v_partes[2]::uuid;
    v_token      := v_partes[3]::uuid;
  exception when others then
    return false;
  end;

  if lower(v_partes[4]) !~
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|pdf|heic|heif)$' then
    return false;
  end if;

  select exists (
    select 1
      from public.pagamentos_sponsor p
     where p.sponsor_id  = v_sponsor_id
       and p.proof_token = v_token
       and p.estado in ('awaiting_proof','proof_uploaded','rejected')
  ) into v_existe;

  return v_existe;
end;
$$;

create or replace function public.comprovativo_sponsor_pode_ler(p_path text)
returns boolean language plpgsql security definer set search_path = '' stable as $$
declare
  v_partes text[];
  v_sponsor_id uuid;
  v_token uuid;
  v_existe boolean;
begin
  v_partes := string_to_array(p_path, '/');
  if array_length(v_partes, 1) <> 4
     or v_partes[1] <> 'sponsor-payment-proofs' then
    return false;
  end if;

  begin
    v_sponsor_id := v_partes[2]::uuid;
    v_token      := v_partes[3]::uuid;
  exception when others then
    return false;
  end;

  select exists (
    select 1
      from public.pagamentos_sponsor p
     where p.sponsor_id  = v_sponsor_id
       and p.proof_token = v_token
  ) into v_existe;

  return v_existe;
end;
$$;

revoke all on function public.comprovativo_sponsor_pode_upload(text) from public;
revoke all on function public.comprovativo_sponsor_pode_ler(text) from public;
grant execute on function public.comprovativo_sponsor_pode_upload(text) to anon, authenticated, service_role;
grant execute on function public.comprovativo_sponsor_pode_ler(text) to anon, authenticated, service_role;

-- Policies SÓ no bucket dedicado — nunca ampliam permissões no bucket
-- payment-proofs das inscrições (invariante §3.7 da revisão).
drop policy if exists sponsor_proofs_insert on storage.objects;
create policy sponsor_proofs_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'sponsor-payment-proofs'
    and public.comprovativo_sponsor_pode_upload(name)
  );

drop policy if exists sponsor_proofs_select on storage.objects;
create policy sponsor_proofs_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'sponsor-payment-proofs'
    and public.comprovativo_sponsor_pode_ler(name)
  );

-- ───────────────────────────────────────────────────────────────
-- 14. Registo da migração
-- ───────────────────────────────────────────────────────────────
insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0011_sponsor_pagamentos','sql_editor','Bloco J r2 ADITIVO: pagamentos/comprovativos de patrocínio com posse_token; anti-takeover (ja_existente sem token); iniciar_pagamento_sponsor atómica race-safe; bucket privado sponsor-payment-proofs (payment-proofs intacto); overloads 3-arg sem drop das 2-arg (hardening na 0012); canal_comprovativo + whatsapp_handoff_at; heic/heif')
on conflict (nome) do update set nota = excluded.nota;

-- ───────────────────────────────────────────────────────────────
-- DOWN (rollback) — descomentar para reverter:
--   drop policy if exists sponsor_proofs_insert on storage.objects;
--   drop policy if exists sponsor_proofs_select on storage.objects;
--   delete from storage.buckets where id = 'sponsor-payment-proofs';
--   drop function public.comprovativo_sponsor_pode_upload(text);
--   drop function public.comprovativo_sponsor_pode_ler(text);
--   drop function public.rejeitar_pagamento_sponsor(uuid, text);
--   drop function public.confirmar_pagamento_sponsor(uuid);
--   drop function public.marcar_comprovativo_whatsapp_sponsor(uuid, uuid, text);
--   drop function public.estado_sponsor(uuid, text);
--   drop function public.registar_comprovativo_sponsor(uuid, text, text, text, integer, text);
--   drop function public.validar_comprovativo_upload_sponsor(uuid, uuid, text);
--   drop function public.iniciar_pagamento_sponsor(uuid, text, text);
--   drop function public.definir_metodo_sponsor(uuid, text, text);
--   -- manter a definir_metodo_sponsor(uuid, text) da 0004 (2-arg, intacta)
--   drop function public.definir_nivel_sponsor(uuid, integer, text);
--   -- manter a definir_nivel_sponsor(uuid, integer) da 0005 (2-arg, intacta)
--   drop function public.registar_sponsor(text,text,text,integer,text,boolean,text);
--   -- recriar registar_sponsor 7-arg com o corpo da 0005 (sem posse_token)
--   drop table public.comprovativos_sponsor;
--   drop table public.pagamentos_sponsor;
--   alter table public.sponsors drop column if exists posse_token;
--   delete from public.migrations_aplicadas where nome = '0011_sponsor_pagamentos';