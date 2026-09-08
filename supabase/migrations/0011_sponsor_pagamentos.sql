-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — Bloco J (patrocínio): pagamentos, comprovativos
-- e posse_token — espelho de 0006 + 0009 para o fluxo de patrocínio.
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0009/0010).
-- Fica aqui versionado para recriar o ambiente do zero se preciso.
-- REVERSÍVEL — bloco de down comentado no fim.
--
-- Fluxo que suporta:
--   registar_sponsor (devolve posse_token, UMA vez) → escolher nível
--   (definir_nivel_sponsor) → escolher método (definir_metodo_sponsor +
--   criar_pagamento_sponsor, payment_started, valor = nível) → pagar →
--   validar_comprovativo_upload_sponsor (awaiting_proof) → upload para o
--   bucket privado payment-proofs → registar_comprovativo_sponsor
--   (proof_uploaded) → admin confirma (confirmed + sponsors.status=
--   'confirmado') | rejeita (rejected + novo comprovativo permitido).
--   estado_sponsor = polling do modal.
--
-- Segurança (mesmos guardrails de 0006/0009):
--   • RLS ativo, ZERO policies diretas nas tabelas — só SECURITY DEFINER RPCs.
--   • set search_path = '' em tudo; nomes sempre qualificados.
--   • Posse por posse_token (hex 64, padrão B1/0009) — guard acesso_negado 42501.
--   • Storage: policies ADICIONAIS token-gated no bucket payment-proofs
--     existente (permissive policies somam-se; as de inscrição ficam intactas).
--   • confirmar/rejeitar: só service_role (admin), nunca anon/authenticated.
--   • NUNCA ::citext (cast pelo nome rebenta com search_path vazio).
--   • heic/heif nos guards desde o dia 1 (o guard de inscrição 0006 ficou
--     sem eles — falha latente a reportar, fora do âmbito deste bloco).
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. posse_token na tabela sponsors (padrão 0009:14)
--    ip_hash mantém-se como sinal de abuso — sem migração de dados.
--    Reentrada (re-submeter o formulário) → token NOVO.
-- ───────────────────────────────────────────────────────────────
alter table public.sponsors add column if not exists posse_token text unique;

-- ───────────────────────────────────────────────────────────────
-- 2. Tabela pagamentos_sponsor (espelho 0006:27-47)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.pagamentos_sponsor (
  id                  uuid         primary key default gen_random_uuid(),
  sponsor_id          uuid         not null references public.sponsors(id) on delete cascade,
  -- Valor SEM default: derivado do nível pela RPC (75/150/200) — nunca
  -- confiar num valor enviado pelo cliente.
  valor               numeric(6,2) not null,
  moeda               text         not null default 'EUR',
  -- Patrocínio é SEMPRE sem cartão: só MB Way ou transferência (0004).
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
create unique index if not exists pagamentos_sponsor_um_ativo_idx
  on public.pagamentos_sponsor (sponsor_id)
  where estado not in ('cancelled','rejected');

drop trigger if exists pagamentos_sponsor_set_updated_at on public.pagamentos_sponsor;
create trigger pagamentos_sponsor_set_updated_at
  before update on public.pagamentos_sponsor
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 3. Tabela comprovativos_sponsor (espelho exato 0006:71-83)
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
-- 4. RPC: registar_sponsor (create or replace, MESMA assinatura 7-arg)
--    Gera posse_token no insert E no update (padrão 0009:41) e devolve-o
--    UMA vez. Reentrada → token NOVO (sem migração de dados, espelho B1).
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

  -- Token de posse nasce SEMPRE no servidor (hex 64, padrão 0009:41).
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  select * into v_existing from public.sponsors where email = p_email;

  if found then
    -- Quem voltou (ex. mudou de nível e recomeçou) atualiza os dados e recebe
    -- token NOVO (a posse anterior morre — igual à reentrada de inscrição).
    update public.sponsors
       set nome          = p_nome,
           telefone      = p_telefone,
           nivel         = p_nivel,
           empresa       = p_empresa,
           consentimento = p_consentimento,
           posse_token   = v_token,
           status        = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end
     where id = v_existing.id
     returning id into v_id;
    v_status := 'ja_existente';
  else
    insert into public.sponsors (nome, email, telefone, nivel, empresa, consentimento, posse_token, ip_hash)
    values (p_nome, p_email, p_telefone, p_nivel, p_empresa, p_consentimento, v_token, p_ip_hash)
    returning id into v_id;
    v_status := 'criada';
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id, 'nivel', p_nivel, 'posse_token', v_token);
end;
$$;

revoke all on function public.registar_sponsor(text, text, text, integer, text, boolean, text) from public;
grant execute on function public.registar_sponsor(text, text, text, integer, text, boolean, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 5. RPC: criar_pagamento_sponsor (método → pagamento payment_started)
--    Idempotente: reutiliza o pagamento ativo (índice parcial protege em
--    corrida). Valor derivado do nível — nunca do cliente. Guard de posse
--    ANTES de qualquer detalhe de negócio (não vazar estado sem token).
-- ───────────────────────────────────────────────────────────────
create or replace function public.criar_pagamento_sponsor(
  p_sponsor_id uuid,
  p_metodo     text,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_posse    text;
  v_nivel    integer;
  v_pagamento_id uuid;
  v_proof_token  uuid;
  v_estado_pagamento text;
begin
  if p_metodo not in ('mbway','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;

  select s.posse_token, s.nivel
    into v_posse, v_nivel
    from public.sponsors s
   where s.id = p_sponsor_id;

  if not found then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;

  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  -- O nível é escolhido no passo B, antes da modal C — sem ele não há valor.
  if v_nivel is null then
    raise exception 'nivel_nao_definido' using errcode = '22023';
  end if;

  -- Já existe pagamento ativo? Devolve-o (não duplica).
  select p.id, p.proof_token, p.estado
    into v_pagamento_id, v_proof_token, v_estado_pagamento
    from public.pagamentos_sponsor p
   where p.sponsor_id = p_sponsor_id
     and p.estado not in ('cancelled','rejected')
   order by p.created_at desc, p.id desc
   limit 1;

  if v_pagamento_id is not null then
    return jsonb_build_object(
      'status','existente','pagamento_id',v_pagamento_id,
      'proof_token',v_proof_token,'estado',v_estado_pagamento
    );
  end if;

  insert into public.pagamentos_sponsor (sponsor_id, metodo, valor, estado)
  values (p_sponsor_id, p_metodo, v_nivel, 'payment_started')
  returning id, proof_token into v_pagamento_id, v_proof_token;

  return jsonb_build_object(
    'status','criado','pagamento_id',v_pagamento_id,
    'proof_token',v_proof_token,'estado','payment_started'
  );
end;
$$;

revoke all on function public.criar_pagamento_sponsor(uuid, text, text) from public;
grant execute on function public.criar_pagamento_sponsor(uuid, text, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 6. RPCs definir_nivel_sponsor / definir_metodo_sponsor
--    2→3 args (posse_token) → drop + create + grants explícitos
--    (padrão 0009:111-133).
-- ───────────────────────────────────────────────────────────────
drop function if exists public.definir_nivel_sponsor(uuid, integer);
create or replace function public.definir_nivel_sponsor(
  p_sponsor_id uuid,
  p_nivel      integer,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_posse text;
begin
  if p_nivel not in (75, 150, 200) then
    raise exception 'invalid_nivel' using errcode = '22023';
  end if;

  select posse_token into v_posse from public.sponsors where id = p_sponsor_id;
  if not found then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  update public.sponsors set nivel = p_nivel where id = p_sponsor_id;
  return jsonb_build_object('status', 'ok', 'id', p_sponsor_id, 'nivel', p_nivel);
end;
$$;
grant execute on function public.definir_nivel_sponsor(uuid, integer, text)
  to anon, authenticated, service_role;

drop function if exists public.definir_metodo_sponsor(uuid, text);
create or replace function public.definir_metodo_sponsor(
  p_sponsor_id uuid,
  p_metodo     text,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_posse text;
begin
  if p_metodo not in ('mbway','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;

  select posse_token into v_posse from public.sponsors where id = p_sponsor_id;
  if not found then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  update public.sponsors set metodo_pagamento = p_metodo where id = p_sponsor_id;
  return jsonb_build_object('status', 'ok', 'id', p_sponsor_id, 'metodo', p_metodo);
end;
$$;
grant execute on function public.definir_metodo_sponsor(uuid, text, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 7. RPC: validar_comprovativo_upload_sponsor (espelho 0009:164-186)
--    Corre ANTES do upload: devolve o proof_token para a rota montar o
--    path e faz a transição payment_started/rejected → awaiting_proof.
-- ───────────────────────────────────────────────────────────────
create or replace function public.validar_comprovativo_upload_sponsor(
  p_pagamento_id uuid,
  p_sponsor_id uuid,
  p_posse_token text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_estado text; v_token uuid; v_posse text;
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
-- 8. RPC: registar_comprovativo_sponsor (espelho 0009:190-230)
--    Path tem de apontar para a pasta deste pagamento (proof_token).
--    heic/heif aceites (não regredir o Bloco D). Nunca base64.
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
  v_comprovativo_id uuid; v_ext text;
begin
  select p.estado, p.proof_token, s.posse_token into v_estado, v_token, v_posse
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
  -- Path: payment-proofs/{sponsor_id}/{proof_token}/{uuid}.{ext}
  if split_part(p_storage_path, '/', 3) <> v_token::text then
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
     set estado = 'proof_uploaded', updated_at = now(), motivo_rejeicao = null
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
-- 9. RPC: estado_sponsor (polling do modal; espelho estado_inscricao
--    0009:136-161). Leitura, sem escrita. Posse por token.
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
  v_motivo text;
  v_comprovativo text;
begin
  select * into v_sponsor from public.sponsors where id = p_sponsor_id;
  if v_sponsor.id is null then
    raise exception 'sponsor_nao_encontrada' using errcode = '22023';
  end if;
  if p_posse_token is null or v_sponsor.posse_token is null or v_sponsor.posse_token <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  select p.id, p.estado, p.metodo, p.motivo_rejeicao
    into v_pagamento_id, v_pagamento_estado, v_metodo, v_motivo
    from public.pagamentos_sponsor p
   where p.sponsor_id = p_sponsor_id
   order by p.created_at desc, p.id desc
   limit 1;

  select c.status
    into v_comprovativo
    from public.comprovativos_sponsor c
    join public.pagamentos_sponsor p on p.id = c.pagamento_id
   where p.sponsor_id = p_sponsor_id
   order by c.uploaded_at desc, c.id desc
   limit 1;

  return jsonb_build_object(
    'status',              v_sponsor.status,
    'nivel',               v_sponsor.nivel,
    'metodo',              v_metodo,
    'pagamento_id',        v_pagamento_id,
    'pagamento_estado',    coalesce(v_pagamento_estado, 'pending'),
    'motivo_rejeicao',     v_motivo,
    'comprovativo_status', v_comprovativo
  );
end;
$$;

revoke all on function public.estado_sponsor(uuid, text) from public;
grant execute on function public.estado_sponsor(uuid, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 10. RPCs ADMIN: confirmar / rejeitar (espelho 0006:506-586)
--     anon e authenticated NUNCA executam. Não há endpoint público.
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
         paid_at = now(),
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
-- 11. Storage: guards + policies ADICIONAIS no bucket payment-proofs
--     existente. Path sponsor:
--       payment-proofs/{sponsor_id}/{proof_token}/{uuid}.{ext}
--     Permissive policies somam-se — as de inscrição (payment_proofs_*)
--     ficam intactas. heic/heif no regex desde o dia 1.
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
  if array_length(v_partes, 1) <> 4 or v_partes[1] <> 'payment-proofs' then
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
  if array_length(v_partes, 1) <> 4 or v_partes[1] <> 'payment-proofs' then
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

-- ADITIVAS: não tocar nas policies payment_proofs_insert/select de 0006.
drop policy if exists payment_proofs_sponsor_insert on storage.objects;
create policy payment_proofs_sponsor_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'payment-proofs'
    and public.comprovativo_sponsor_pode_upload(name)
  );

drop policy if exists payment_proofs_sponsor_select on storage.objects;
create policy payment_proofs_sponsor_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'payment-proofs'
    and public.comprovativo_sponsor_pode_ler(name)
  );

-- ───────────────────────────────────────────────────────────────
-- 12. Registo da migração
-- ───────────────────────────────────────────────────────────────
insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0011_sponsor_pagamentos','sql_editor','Bloco J: pagamentos/comprovativos de patrocínio com posse_token (espelho 0006+0009); valor derivado do nivel; policies storage aditivas; heic/heif nos guards')
on conflict (nome) do nothing;

-- ───────────────────────────────────────────────────────────────
-- DOWN (rollback) — descomentar para reverter:
--   drop policy if exists payment_proofs_sponsor_insert on storage.objects;
--   drop policy if exists payment_proofs_sponsor_select on storage.objects;
--   drop function public.comprovativo_sponsor_pode_upload(text);
--   drop function public.comprovativo_sponsor_pode_ler(text);
--   drop function public.rejeitar_pagamento_sponsor(uuid, text);
--   drop function public.confirmar_pagamento_sponsor(uuid);
--   drop function public.estado_sponsor(uuid, text);
--   drop function public.registar_comprovativo_sponsor(uuid, text, text, text, integer, text);
--   drop function public.validar_comprovativo_upload_sponsor(uuid, uuid, text);
--   drop function public.definir_metodo_sponsor(uuid, text, text);
--   -- recriar definir_metodo_sponsor(uuid, text) da 0004 (sem posse)
--   drop function public.definir_nivel_sponsor(uuid, integer, text);
--   -- recriar definir_nivel_sponsor(uuid, integer) da 0005 (sem posse)
--   drop function public.criar_pagamento_sponsor(uuid, text, text);
--   -- recriar registar_sponsor(text,text,text,integer,text,boolean,text) da 0005 (sem posse_token)
--   drop table public.comprovativos_sponsor;
--   drop table public.pagamentos_sponsor;
--   alter table public.sponsors drop column if exists posse_token;
--   delete from public.migrations_aplicadas where nome = '0011_sponsor_pagamentos';