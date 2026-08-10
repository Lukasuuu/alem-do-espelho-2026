-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — pagamentos + comprovativos + confirmação
-- Aplicar no projeto Supabase qtiyxibqeignvsnfhzpw (depois de 0005).
-- Fica aqui versionado para recriar o ambiente do zero se preciso.
--
-- Fluxo que suporta:
--   escolher método → criar_pagamento (payment_started) → pagar →
--   validar_comprovativo_upload (awaiting_proof) → upload para o bucket
--   privado payment-proofs → registar_comprovativo (proof_uploaded) →
--   admin confirma (confirmed + inscricoes.status=confirmado) | rejeita
--   (rejected + novo comprovativo permitido).
--
-- Segurança (mesmos guardrails da FASE1):
--   • RLS ativo, zero policies diretas nas tabelas — só SECURITY DEFINER RPCs.
--   • set search_path = '' em tudo; nomes sempre qualificados.
--   • NUNCA ::citext (cast pelo nome rebenta com search_path vazio).
--   • Storage privado com policies token-gated (proof_token, nunca public).
--   • confirmar_pagamento / rejeitar_pagamento: só service_role (admin),
--     nunca anon/authenticated. Não há endpoint público de confirmação.
--   • Escritas de FASE2 verificam ownership via ip_hash da inscrição
--     (o formulário grava ip_hash; o dono real vem do mesmo IP).
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Tabela pagamentos
-- ───────────────────────────────────────────────────────────────
create table if not exists public.pagamentos (
  id                  uuid         primary key default gen_random_uuid(),
  inscricao_id        uuid         not null references public.inscricoes(id) on delete cascade,
  valor               numeric(6,2) not null default 40.00,
  moeda               text         not null default 'EUR',
  metodo              text         not null check (metodo in ('sumup','mbway','qr','transferencia')),
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
alter table public.pagamentos enable row level security;

create index if not exists pagamentos_inscricao_id_idx
  on public.pagamentos (inscricao_id);
create index if not exists pagamentos_estado_idx
  on public.pagamentos (estado);

-- Máximo de 1 pagamento ativo por inscrição (active = ainda não
-- terminado). Cancelados/rejeitados ficam de fora → permitem novo pagamento.
create unique index if not exists pagamentos_um_ativo_por_inscricao_idx
  on public.pagamentos (inscricao_id)
  where estado not in ('cancelled','rejected');

drop trigger if exists pagamentos_set_updated_at on public.pagamentos;
create trigger pagamentos_set_updated_at
  before update on public.pagamentos
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 2. Tabela comprovativos (metadados; ficheiro no Storage, nunca base64)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.comprovativos (
  id                  uuid         primary key default gen_random_uuid(),
  pagamento_id        uuid         not null references public.pagamentos(id) on delete cascade,
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

alter table public.comprovativos enable row level security;

create index if not exists comprovativos_pagamento_id_idx
  on public.comprovativos (pagamento_id);

-- ───────────────────────────────────────────────────────────────
-- 3. Estender a FASE1: método 'qr' na coluna e na função definidora
-- ───────────────────────────────────────────────────────────────
-- A coluna foi criada com um CHECK anónimo (nome auto-gerado). Remove-se o
-- que existir (procurando por condef que mencione metodo_pagamento) e
-- recria-se com nome fixo incluindo 'qr' — idempotente.
do $$
declare
  v_nome text;
begin
  select c.conname into v_nome
    from pg_constraint c
    join pg_class t  on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'inscricoes'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%metodo_pagamento%';
  if v_nome is not null then
    execute format('alter table public.inscricoes drop constraint %I', v_nome);
  end if;
end $$;

alter table public.inscricoes
  add constraint inscricoes_metodo_pagamento_check
  check (metodo_pagamento in ('sumup','mbway','qr','transferencia'));

create or replace function public.definir_metodo_inscricao(
  p_inscricao_id uuid,
  p_metodo       text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_metodo not in ('sumup','mbway','qr','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;

  update public.inscricoes
     set metodo_pagamento = p_metodo
   where id = p_inscricao_id;

  if not found then
    raise exception 'inscricao_nao_encontrada' using errcode = '22023';
  end if;

  return jsonb_build_object('status', 'ok', 'id', p_inscricao_id, 'metodo', p_metodo);
end;
$$;

revoke all on function public.definir_metodo_inscricao(uuid, text) from public;
grant execute on function public.definir_metodo_inscricao(uuid, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 4. Bucket privado payment-proofs + policies token-gated
-- ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('payment-proofs', 'payment-proofs', false, 8388608)
on conflict (id) do nothing;

-- Guardas de storage. O objecto vive em
--   payment-proofs/{inscricao_id}/{proof_token}/{uuid}.{ext}
-- e só quem conhece o proof_token (gerado no servidor) consegue escrever/ler.
-- SECURITY DEFINER: lê pagamentos por baixo do RLS das tabelas.
create or replace function public.comprovativo_pode_upload(p_path text)
returns boolean language plpgsql security definer set search_path = '' stable as $$
declare
  v_partes text[];
  v_inscricao_id uuid;
  v_token uuid;
  v_existe boolean;
begin
  v_partes := string_to_array(p_path, '/');
  if array_length(v_partes, 1) <> 4 or v_partes[1] <> 'payment-proofs' then
    return false;
  end if;

  begin
    v_inscricao_id := v_partes[2]::uuid;
    v_token        := v_partes[3]::uuid;
  exception when others then
    return false;
  end;

  if lower(v_partes[4]) !~
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|pdf)$' then
    return false;
  end if;

  select exists (
    select 1
      from public.pagamentos p
     where p.inscricao_id = v_inscricao_id
       and p.proof_token  = v_token
       and p.estado in ('awaiting_proof','proof_uploaded','rejected')
  ) into v_existe;

  return v_existe;
end;
$$;

create or replace function public.comprovativo_pode_ler(p_path text)
returns boolean language plpgsql security definer set search_path = '' stable as $$
declare
  v_partes text[];
  v_inscricao_id uuid;
  v_token uuid;
  v_existe boolean;
begin
  v_partes := string_to_array(p_path, '/');
  if array_length(v_partes, 1) <> 4 or v_partes[1] <> 'payment-proofs' then
    return false;
  end if;

  begin
    v_inscricao_id := v_partes[2]::uuid;
    v_token        := v_partes[3]::uuid;
  exception when others then
    return false;
  end;

  select exists (
    select 1
      from public.pagamentos p
     where p.inscricao_id = v_inscricao_id
       and p.proof_token  = v_token
  ) into v_existe;

  return v_existe;
end;
$$;

revoke all on function public.comprovativo_pode_upload(text) from public;
revoke all on function public.comprovativo_pode_ler(text) from public;
grant execute on function public.comprovativo_pode_upload(text) to anon, authenticated, service_role;
grant execute on function public.comprovativo_pode_ler(text) to anon, authenticated, service_role;

drop policy if exists payment_proofs_insert on storage.objects;
create policy payment_proofs_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'payment-proofs'
    and public.comprovativo_pode_upload(name)
  );

drop policy if exists payment_proofs_select on storage.objects;
create policy payment_proofs_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'payment-proofs'
    and public.comprovativo_pode_ler(name)
  );

-- ───────────────────────────────────────────────────────────────
-- 5. RPC: criar_pagamento (escolha do método → pagamento payment_started)
-- ───────────────────────────────────────────────────────────────
-- Reutiliza o pagamento ativo existente (idempotente) em vez de duplicar.
-- p_ip_hash verifica que quem chama é o dono da inscrição (mesmo IP do
-- formulário). O proof_token nasce aqui, no servidor.
create or replace function public.criar_pagamento(
  p_inscricao_id uuid,
  p_metodo       text,
  p_ip_hash      text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_estado_inscricao text;
  v_ip_hash_inscricao text;
  v_pagamento_id     uuid;
  v_proof_token      uuid;
  v_estado_pagamento text;
begin
  if p_metodo not in ('sumup','mbway','qr','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;

  select i.status, i.ip_hash
    into v_estado_inscricao, v_ip_hash_inscricao
    from public.inscricoes i
   where i.id = p_inscricao_id;

  if v_estado_inscricao is null then
    raise exception 'inscricao_nao_encontrada' using errcode = '22023';
  end if;
  if v_estado_inscricao = 'cancelado' then
    raise exception 'inscricao_cancelada' using errcode = '22023';
  end if;
  if v_ip_hash_inscricao is not null and v_ip_hash_inscricao <> p_ip_hash then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  -- Já existe pagamento ativo? Devolve-o (não duplica; o índice parcial também
  -- protege em corrida — o erro vira 502 e o utilizador repete, recebendo o mesmo).
  select p.id, p.proof_token, p.estado
    into v_pagamento_id, v_proof_token, v_estado_pagamento
    from public.pagamentos p
   where p.inscricao_id = p_inscricao_id
     and p.estado not in ('cancelled','rejected')
   order by p.created_at desc, p.id desc
   limit 1;

  if v_pagamento_id is not null then
    return jsonb_build_object(
      'status','existente','pagamento_id',v_pagamento_id,
      'proof_token',v_proof_token,'estado',v_estado_pagamento
    );
  end if;

  insert into public.pagamentos (inscricao_id, metodo, estado)
  values (p_inscricao_id, p_metodo, 'payment_started')
  returning id, proof_token into v_pagamento_id, v_proof_token;

  return jsonb_build_object(
    'status','criado','pagamento_id',v_pagamento_id,
    'proof_token',v_proof_token,'estado','payment_started'
  );
end;
$$;

revoke all on function public.criar_pagamento(uuid, text, text) from public;
grant execute on function public.criar_pagamento(uuid, text, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 6. RPC: validar_comprovativo_upload (dono + estado + proof_token)
-- ───────────────────────────────────────────────────────────────
-- Corre ANTES do upload: devolve o proof_token para a rota montar o path
-- correto no bucket e faz a transição payment_started/rejected → awaiting_proof.
create or replace function public.validar_comprovativo_upload(
  p_pagamento_id uuid,
  p_inscricao_id uuid,
  p_ip_hash      text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
  v_token  uuid;
  v_ip_hash_inscricao text;
begin
  select p.estado, p.proof_token, i.ip_hash
    into v_estado, v_token, v_ip_hash_inscricao
    from public.pagamentos p
    join public.inscricoes i on i.id = p.inscricao_id
   where p.id = p_pagamento_id
     and p.inscricao_id = p_inscricao_id;

  if v_estado is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;

  if v_ip_hash_inscricao is not null and v_ip_hash_inscricao <> p_ip_hash then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  if v_estado not in ('payment_started','awaiting_proof','proof_uploaded','rejected') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;

  if v_estado in ('payment_started','rejected') then
    update public.pagamentos
       set estado = 'awaiting_proof', updated_at = now(), motivo_rejeicao = null
     where id = p_pagamento_id;
  end if;

  return jsonb_build_object('ok', true, 'proof_token', v_token, 'estado', 'awaiting_proof');
end;
$$;

revoke all on function public.validar_comprovativo_upload(uuid, uuid, text) from public;
grant execute on function public.validar_comprovativo_upload(uuid, uuid, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 7. RPC: registar_comprovativo (metadados → proof_uploaded)
-- ───────────────────────────────────────────────────────────────
-- O path tem de apontar para a pasta deste pagamento (proof_token) — se um
-- atacante conseguisse escolher o path, o RPC rejeita. Ficheiro no Storage;
-- aqui só metadados. Nunca base64.
create or replace function public.registar_comprovativo(
  p_pagamento_id      uuid,
  p_storage_path      text,
  p_original_filename text,
  p_mime_type         text,
  p_file_size         integer,
  p_ip_hash           text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
  v_token  uuid;
  v_ip_hash_inscricao text;
  v_comprovativo_id   uuid;
  v_ext    text;
begin
  select p.estado, p.proof_token, i.ip_hash
    into v_estado, v_token, v_ip_hash_inscricao
    from public.pagamentos p
    join public.inscricoes i on i.id = p.inscricao_id
   where p.id = p_pagamento_id
   for update;

  if v_estado is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;

  if v_ip_hash_inscricao is not null and v_ip_hash_inscricao <> p_ip_hash then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  if v_estado not in ('awaiting_proof','proof_uploaded','rejected') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;

  -- Path tem de ser  payment-proofs/{inscricao_id}/{proof_token}/ficheiro
  if split_part(p_storage_path, '/', 3) <> v_token::text then
    raise exception 'storage_path_invalido' using errcode = '22023';
  end if;

  v_ext := lower(split_part(lower(p_storage_path), '.', -1));
  if v_ext not in ('png','jpg','jpeg','webp','pdf') then
    raise exception 'extensao_invalida' using errcode = '22023';
  end if;

  if p_file_size is null or p_file_size <= 0 or p_file_size > 8388608 then
    raise exception 'tamanho_invalido' using errcode = '22023';
  end if;

  if p_mime_type not in ('image/png','image/jpeg','image/webp','application/pdf') then
    raise exception 'mime_invalido' using errcode = '22023';
  end if;

  insert into public.comprovativos
    (pagamento_id, storage_path, original_filename, mime_type, file_size, status)
  values
    (p_pagamento_id, p_storage_path, p_original_filename, p_mime_type, p_file_size, 'aguardando_confirmacao')
  returning id into v_comprovativo_id;

  update public.pagamentos
     set estado = 'proof_uploaded', updated_at = now(), motivo_rejeicao = null
   where id = p_pagamento_id;

  return jsonb_build_object(
    'status','recebido','comprovativo_id',v_comprovativo_id,
    'pagamento_estado','proof_uploaded'
  );
end;
$$;

revoke all on function public.registar_comprovativo(uuid, text, text, text, integer, text) from public;
grant execute on function public.registar_comprovativo(uuid, text, text, text, integer, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 8. RPC: estado_inscricao (polling não-agressivo do modal)
-- ───────────────────────────────────────────────────────────────
-- Exige ip_hash: sem ele, qualquer anon com um uuid espreitava o estado
-- (status, is_bonus, método) de outra pessoa. É leitura, sem escrita.
create or replace function public.estado_inscricao(
  p_inscricao_id uuid,
  p_ip_hash      text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_inscricao      public.inscricoes%rowtype;
  v_pagamento_id   uuid;
  v_pagamento_estado text;
  v_metodo         text;
  v_motivo         text;
  v_comprovativo   text;
begin
  select * into v_inscricao from public.inscricoes where id = p_inscricao_id;

  if v_inscricao.id is null then
    raise exception 'inscricao_nao_encontrada' using errcode = '22023';
  end if;

  if v_inscricao.ip_hash is not null and v_inscricao.ip_hash <> p_ip_hash then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  select p.id, p.estado, p.metodo, p.motivo_rejeicao
    into v_pagamento_id, v_pagamento_estado, v_metodo, v_motivo
    from public.pagamentos p
   where p.inscricao_id = p_inscricao_id
   order by p.created_at desc, p.id desc
   limit 1;

  select c.status
    into v_comprovativo
    from public.comprovativos c
    join public.pagamentos p on p.id = c.pagamento_id
   where p.inscricao_id = p_inscricao_id
   order by c.uploaded_at desc, c.id desc
   limit 1;

  return jsonb_build_object(
    'status',            v_inscricao.status,
    'is_bonus',          coalesce(v_inscricao.is_bonus, false),
    'metodo',            v_metodo,
    'pagamento_id',      v_pagamento_id,
    'pagamento_estado',  coalesce(v_pagamento_estado, 'pending'),
    'motivo_rejeicao',   v_motivo,
    'comprovativo_status', v_comprovativo
  );
end;
$$;

revoke all on function public.estado_inscricao(uuid, text) from public;
grant execute on function public.estado_inscricao(uuid, text)
  to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 9. RPCs ADMIN: confirmar / rejeitar
--    anon e authenticated NUNCA executam. Não há endpoint público.
--    Sem service_role no frontend: são chamadas via SQL Editor/dashboard.
-- ───────────────────────────────────────────────────────────────
create or replace function public.confirmar_pagamento(
  p_pagamento_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_inscricao_id uuid;
  v_estado text;
begin
  select p.inscricao_id, p.estado
    into v_inscricao_id, v_estado
    from public.pagamentos p
   where p.id = p_pagamento_id
   for update;

  if v_inscricao_id is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;

  if v_estado not in ('awaiting_proof','proof_uploaded','under_review') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;

  update public.pagamentos
     set estado = 'confirmed',
         paid_at = now(),
         confirmed_at = now(),
         updated_at = now()
   where id = p_pagamento_id;

  update public.inscricoes
     set status = 'confirmado', updated_at = now()
   where id = v_inscricao_id;

  update public.comprovativos
     set status = 'aprovado', reviewed_at = now()
   where pagamento_id = p_pagamento_id
     and status = 'aguardando_confirmacao';

  return jsonb_build_object('status','confirmado','pagamento_id',p_pagamento_id,'inscricao_id',v_inscricao_id);
end;
$$;

create or replace function public.rejeitar_pagamento(
  p_pagamento_id uuid,
  p_motivo       text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_inscricao_id uuid;
begin
  select p.inscricao_id
    into v_inscricao_id
    from public.pagamentos p
   where p.id = p_pagamento_id
   for update;

  if v_inscricao_id is null then
    raise exception 'pagamento_nao_encontrado' using errcode = '22023';
  end if;

  update public.pagamentos
     set estado = 'rejected', updated_at = now(), motivo_rejeicao = p_motivo
   where id = p_pagamento_id;

  update public.comprovativos
     set status = 'rejeitado', reviewed_at = now()
   where pagamento_id = p_pagamento_id
     and status = 'aguardando_confirmacao';

  -- inscricao mantém 'pendente' → novo comprovativo permitido (validar_comprovativo_upload aceita 'rejected').

  return jsonb_build_object('status','rejeitado','pagamento_id',p_pagamento_id,'inscricao_id',v_inscricao_id,'motivo',p_motivo);
end;
$$;

-- Confirmar/rejeitar: só service_role. Nem anon, nem authenticated, nem public.
revoke all on function public.confirmar_pagamento(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_pagamento(uuid) to service_role;

revoke all on function public.rejeitar_pagamento(uuid, text) from public, anon, authenticated;
grant execute on function public.rejeitar_pagamento(uuid, text) to service_role;
