-- 0010_email_registo.sql — Bloco E
-- A. Colunas de registo de envio de email (idempotência: a app consulta
--    email_*_ok antes de enviar, para não duplicar).
-- B. RPC registar_envio_email — regista o envio (cliente|org). Posse por
--    ip_hash (NULL = sem gate; mesmo padrão das RPCs 0006). O B1 (0009)
--    substitui p_ip_hash por p_posse_token nesta função, com as outras.
-- Aplicada 06/09 via conector Supabase MCP (transação única).

alter table public.inscricoes
  add column if not exists email_cliente_em timestamptz,
  add column if not exists email_cliente_ok boolean,
  add column if not exists email_org_em     timestamptz,
  add column if not exists email_org_ok     boolean;

create or replace function public.registar_envio_email(
  p_inscricao_id uuid,
  p_ip_hash      text,
  p_destino      text,
  p_ok           boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ip_hash text;
begin
  if p_destino not in ('cliente','org') then
    raise exception 'invalid_destino' using errcode = '22023';
  end if;

  select ip_hash into v_ip_hash
    from public.inscricoes
   where id = p_inscricao_id;

  if not found then
    raise exception 'inscricao_nao_encontrada' using errcode = '22023';
  end if;

  -- Posse por ip_hash (NULL = sem gate; igual às RPCs 0006). B1 → posse_token.
  if v_ip_hash is not null and v_ip_hash <> p_ip_hash then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  -- Dois UPDATE separados por if/else (nunca CASE em update set).
  if p_destino = 'cliente' then
    update public.inscricoes
       set email_cliente_em = now(),
           email_cliente_ok = p_ok
     where id = p_inscricao_id;
  else
    update public.inscricoes
       set email_org_em = now(),
           email_org_ok = p_ok
     where id = p_inscricao_id;
  end if;
end;
$function$;

revoke all on function public.registar_envio_email(uuid, text, text, boolean) from public;
grant execute on function public.registar_envio_email(uuid, text, text, boolean)
  to anon, authenticated, service_role;

-- ── down (reversível) ──
-- drop function if exists public.registar_envio_email(uuid, text, text, boolean);
-- alter table public.inscricoes
--   drop column if exists email_cliente_em, drop column if exists email_cliente_ok,
--   drop column if exists email_org_em,     drop column if exists email_org_ok;