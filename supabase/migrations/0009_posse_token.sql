-- 0009_posse_token.sql — B1 (cutover coordenado com o deploy Vercel)
-- Ownership por token de capacidade em vez de ip_hash. ip_hash fica só
-- sinal de abuso. APLICAR EM SIMULTÂNEO com o deploy do frontend token
-- (o site atual envia ip_hash e parte se esta migração entrar sozinha).
-- Reentrada de inscrição antiga (posse_token null): re-submeter o formulário
-- → novo token (caminho existente). Sem migração de dados.
-- Autoria/aplicação: sessão Supabase-MCP. Ficheiro no repo = registo canónico.
--
-- NOTA (guard de inscrição confirmada): igual ao vivo (0008b) — soft-return
-- {status:'ja_confirmada', id, is_bonus} SEM posse_token e SEM raise. A rota
-- POST deve detetar status==='ja_confirmada' e devolver 409 com a mensagem
-- verbatim, ANTES do check "sem token -> 502".

alter table public.inscricoes add column if not exists posse_token text unique;

-- ── registar_inscricao: gera e devolve posse_token (ambos os ramos) ──
create or replace function public.registar_inscricao(
  p_nome text, p_email text, p_telefone text,
  p_ip_hash text default null::text,
  p_consentimento boolean default false
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_existing public.inscricoes%rowtype;
  v_id uuid; v_status text; v_bonus boolean := false; v_token text;
  v_inicio timestamptz := '2026-08-05T22:00:00+01:00'::timestamptz;
  v_fim    timestamptz := '2026-08-10T10:00:00+01:00'::timestamptz;
  v_count integer;
begin
  if p_consentimento is distinct from true then
    raise exception 'consentimento_obrigatorio' using errcode = '22023';
  end if;
  p_nome     := trim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'));
  p_email    := lower(trim(coalesce(p_email,'')));
  p_telefone := regexp_replace(coalesce(p_telefone,''), '[^0-9+]', '', 'g');
  if char_length(p_nome) < 3 then raise exception 'invalid_full_name' using errcode = '22023'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = '22023'; end if;
  if p_telefone !~ '^\+[1-9][0-9]{6,15}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  select * into v_existing from public.inscricoes where email = p_email;
  if found then
    if v_existing.status = 'confirmado' then
      -- soft-return (anti-takeover): não toca na linha, não emite token novo.
      return jsonb_build_object('status','ja_confirmada','id',v_existing.id,
                                'is_bonus',coalesce(v_existing.is_bonus,false));
    end if;
    update public.inscricoes
       set nome = p_nome, telefone = p_telefone,
           posse_token = v_token,
           ip_hash = p_ip_hash,
           status = case when status = 'cancelado' then 'pendente' else status end,
           metodo_pagamento = case when status = 'cancelado' then null else metodo_pagamento end,
           consentimento = true, consentimento_em = now()
     where id = v_existing.id
     returning id into v_id;
    v_status := 'ja_inscrita'; v_bonus := v_existing.is_bonus;
  else
    insert into public.inscricoes (nome, email, telefone, ip_hash, posse_token, consentimento, consentimento_em)
    values (p_nome, p_email, p_telefone, p_ip_hash, v_token, true, now())
    returning id into v_id;
    v_status := 'criada';
    if now() between v_inicio and v_fim then
      select count(*)::int into v_count from public.inscricoes
       where is_bonus = true and status <> 'cancelado' for update;
      if v_count < 50 then update public.inscricoes set is_bonus = true where id = v_id; v_bonus := true; end if;
    end if;
  end if;
  return jsonb_build_object('status',v_status,'id',v_id,'is_bonus',v_bonus,'posse_token',v_token);
end;
$function$;

-- ── criar_pagamento: posse por token ──
create or replace function public.criar_pagamento(
  p_inscricao_id uuid, p_metodo text, p_posse_token text
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_estado_inscricao text; v_posse text;
  v_pagamento_id uuid; v_proof_token uuid; v_estado_pagamento text;
begin
  if p_metodo not in ('sumup','mbway','qr','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;
  select i.status, i.posse_token into v_estado_inscricao, v_posse
    from public.inscricoes i where i.id = p_inscricao_id;
  if v_estado_inscricao is null then raise exception 'inscricao_nao_encontrada' using errcode = '22023'; end if;
  if v_estado_inscricao = 'cancelado' then raise exception 'inscricao_cancelada' using errcode = '22023'; end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  select p.id, p.proof_token, p.estado into v_pagamento_id, v_proof_token, v_estado_pagamento
    from public.pagamentos p
   where p.inscricao_id = p_inscricao_id and p.estado not in ('cancelled','rejected')
   order by p.created_at desc, p.id desc limit 1;
  if v_pagamento_id is not null then
    return jsonb_build_object('status','existente','pagamento_id',v_pagamento_id,
                              'proof_token',v_proof_token,'estado',v_estado_pagamento);
  end if;
  insert into public.pagamentos (inscricao_id, metodo, estado)
  values (p_inscricao_id, p_metodo, 'payment_started')
  returning id, proof_token into v_pagamento_id, v_proof_token;
  return jsonb_build_object('status','criado','pagamento_id',v_pagamento_id,
                            'proof_token',v_proof_token,'estado','payment_started');
end;
$function$;

-- ── definir_metodo_inscricao: EXIGE token (2->3 args -> drop+create) ──
drop function if exists public.definir_metodo_inscricao(uuid, text);
create or replace function public.definir_metodo_inscricao(
  p_inscricao_id uuid, p_metodo text, p_posse_token text
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_posse text;
begin
  if p_metodo not in ('sumup','mbway','qr','transferencia') then
    raise exception 'invalid_metodo' using errcode = '22023';
  end if;
  select posse_token into v_posse from public.inscricoes where id = p_inscricao_id;
  if not found then raise exception 'inscricao_nao_encontrada' using errcode = '22023'; end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  update public.inscricoes set metodo_pagamento = p_metodo where id = p_inscricao_id;
  return jsonb_build_object('status','ok','id',p_inscricao_id,'metodo',p_metodo);
end;
$function$;
grant execute on function public.definir_metodo_inscricao(uuid, text, text)
  to anon, authenticated, service_role;

-- ── estado_inscricao: posse por token ──
create or replace function public.estado_inscricao(
  p_inscricao_id uuid, p_posse_token text
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_inscricao public.inscricoes%rowtype; v_pagamento_id uuid;
  v_pagamento_estado text; v_metodo text; v_motivo text; v_comprovativo text;
begin
  select * into v_inscricao from public.inscricoes where id = p_inscricao_id;
  if v_inscricao.id is null then raise exception 'inscricao_nao_encontrada' using errcode = '22023'; end if;
  if p_posse_token is null or v_inscricao.posse_token is null or v_inscricao.posse_token <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  select p.id, p.estado, p.metodo, p.motivo_rejeicao
    into v_pagamento_id, v_pagamento_estado, v_metodo, v_motivo
    from public.pagamentos p where p.inscricao_id = p_inscricao_id
   order by p.created_at desc, p.id desc limit 1;
  select c.status into v_comprovativo from public.comprovativos c
    join public.pagamentos p on p.id = c.pagamento_id
   where p.inscricao_id = p_inscricao_id order by c.uploaded_at desc, c.id desc limit 1;
  return jsonb_build_object('status',v_inscricao.status,'is_bonus',coalesce(v_inscricao.is_bonus,false),
    'metodo',v_metodo,'pagamento_id',v_pagamento_id,'pagamento_estado',coalesce(v_pagamento_estado,'pending'),
    'motivo_rejeicao',v_motivo,'comprovativo_status',v_comprovativo);
end;
$function$;

-- ── validar_comprovativo_upload: posse por token ──
create or replace function public.validar_comprovativo_upload(
  p_pagamento_id uuid, p_inscricao_id uuid, p_posse_token text
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_estado text; v_token uuid; v_posse text;
begin
  select p.estado, p.proof_token, i.posse_token into v_estado, v_token, v_posse
    from public.pagamentos p join public.inscricoes i on i.id = p.inscricao_id
   where p.id = p_pagamento_id and p.inscricao_id = p_inscricao_id;
  if v_estado is null then raise exception 'pagamento_nao_encontrado' using errcode = '22023'; end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if v_estado not in ('payment_started','awaiting_proof','proof_uploaded','rejected') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;
  if v_estado in ('payment_started','rejected') then
    update public.pagamentos set estado = 'awaiting_proof', updated_at = now(), motivo_rejeicao = null
     where id = p_pagamento_id;
  end if;
  return jsonb_build_object('ok',true,'proof_token',v_token,'estado','awaiting_proof');
end;
$function$;

-- ── registar_comprovativo: posse por token + heic/heif (nao regredir D) ──
create or replace function public.registar_comprovativo(
  p_pagamento_id uuid, p_storage_path text, p_original_filename text,
  p_mime_type text, p_file_size integer, p_posse_token text
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_estado text; v_token uuid; v_posse text; v_comprovativo_id uuid; v_ext text;
begin
  select p.estado, p.proof_token, i.posse_token into v_estado, v_token, v_posse
    from public.pagamentos p join public.inscricoes i on i.id = p.inscricao_id
   where p.id = p_pagamento_id for update;
  if v_estado is null then raise exception 'pagamento_nao_encontrado' using errcode = '22023'; end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if v_estado not in ('awaiting_proof','proof_uploaded','rejected') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;
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
  insert into public.comprovativos
    (pagamento_id, storage_path, original_filename, mime_type, file_size, status)
  values
    (p_pagamento_id, p_storage_path, p_original_filename, p_mime_type, p_file_size, 'aguardando_confirmacao')
  returning id into v_comprovativo_id;
  update public.pagamentos set estado = 'proof_uploaded', updated_at = now(), motivo_rejeicao = null
   where id = p_pagamento_id;
  return jsonb_build_object('status','recebido','comprovativo_id',v_comprovativo_id,'pagamento_estado','proof_uploaded');
end;
$function$;

-- ── registar_envio_email (0010): posse por token ──
create or replace function public.registar_envio_email(
  p_inscricao_id uuid, p_posse_token text, p_destino text, p_ok boolean
)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_posse text;
begin
  if p_destino not in ('cliente','org') then raise exception 'invalid_destino' using errcode = '22023'; end if;
  select posse_token into v_posse from public.inscricoes where id = p_inscricao_id;
  if not found then raise exception 'inscricao_nao_encontrada' using errcode = '22023'; end if;
  if p_posse_token is null or v_posse is null or v_posse <> p_posse_token then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  if p_destino = 'cliente' then
    update public.inscricoes set email_cliente_em = now(), email_cliente_ok = p_ok where id = p_inscricao_id;
  else
    update public.inscricoes set email_org_em = now(), email_org_ok = p_ok where id = p_inscricao_id;
  end if;
end;
$function$;

insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0009_posse_token','mcp','B1: posse por posse_token nas RPCs de escrita; ip_hash = sinal de abuso; heic/heif mantido; guard soft-return ja_confirmada')
on conflict (nome) do nothing;

-- ── DOWN (rollback): restaurar as assinaturas ip_hash de:
--    0008b (registar_inscricao soft-guard), 0006 (criar_pagamento, estado_inscricao,
--    validar_comprovativo_upload), 0010b (registar_comprovativo com ip_hash+heic),
--    0010 (registar_envio_email com ip_hash);
--    drop function public.definir_metodo_inscricao(uuid,text,text);
--    recriar definir_metodo_inscricao(uuid,text) da 0006 (sem posse);
--    alter table public.inscricoes drop column if exists posse_token;
