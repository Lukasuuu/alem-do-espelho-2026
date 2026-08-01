-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — lista de espera
-- Já aplicado no projeto Supabase qtiyxibqeignvsnfhzpw.
-- Fica aqui versionado para recriar o ambiente do zero se preciso.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists public.waitlist_subscribers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text        not null check (char_length(trim(full_name)) between 3 and 120),
  email         citext      not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         text        not null check (phone ~ '^\+[1-9][0-9]{6,15}$'),
  phone_country text,
  status        text        not null default 'pending'
                check (status in ('pending','confirmed','unsubscribed')),
  consent       boolean     not null default true,
  locale        text,
  source        text        not null default 'waitlist-lp',
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_term      text,
  utm_content   text,
  referrer      text,
  user_agent    text,
  ip_hash       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists waitlist_subscribers_email_key
  on public.waitlist_subscribers (email);
create index if not exists waitlist_subscribers_created_at_idx
  on public.waitlist_subscribers (created_at desc);
create index if not exists waitlist_subscribers_status_idx
  on public.waitlist_subscribers (status);

create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists waitlist_subscribers_set_updated_at on public.waitlist_subscribers;
create trigger waitlist_subscribers_set_updated_at
  before update on public.waitlist_subscribers
  for each row execute function public.set_updated_at();

-- RLS ativo, sem policies públicas: a tabela é inacessível por qualquer chave de cliente.
alter table public.waitlist_subscribers enable row level security;

-- Única superfície de escrita, validada e idempotente.
create or replace function public.join_waitlist(
  p_full_name     text,
  p_email         text,
  p_phone         text,
  p_phone_country text default null,
  p_consent       boolean default true,
  p_locale        text default null,
  p_source        text default 'waitlist-lp',
  p_utm           jsonb default '{}'::jsonb,
  p_referrer      text default null,
  p_user_agent    text default null,
  p_ip_hash       text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.waitlist_subscribers%rowtype;
  v_id       uuid;
  v_position int;
  v_status   text;
begin
  p_full_name := trim(regexp_replace(coalesce(p_full_name,''), '\s+', ' ', 'g'));
  p_email     := lower(trim(coalesce(p_email,'')));
  p_phone     := regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g');

  if char_length(p_full_name) < 3 then
    raise exception 'invalid_full_name' using errcode = '22023';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_phone !~ '^\+[1-9][0-9]{6,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  select * into v_existing from public.waitlist_subscribers where email = p_email::citext;

  if found then
    update public.waitlist_subscribers
       set full_name     = p_full_name,
           phone         = p_phone,
           phone_country = coalesce(p_phone_country, phone_country),
           status        = case when status = 'unsubscribed' then 'pending' else status end
     where id = v_existing.id
     returning id into v_id;
    v_status := 'already_registered';
  else
    insert into public.waitlist_subscribers (
      full_name, email, phone, phone_country, consent, locale, source,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referrer, user_agent, ip_hash
    ) values (
      p_full_name, p_email::citext, p_phone, p_phone_country, coalesce(p_consent, true),
      p_locale, coalesce(p_source, 'waitlist-lp'),
      nullif(p_utm->>'utm_source',''), nullif(p_utm->>'utm_medium',''),
      nullif(p_utm->>'utm_campaign',''), nullif(p_utm->>'utm_term',''),
      nullif(p_utm->>'utm_content',''),
      left(nullif(p_referrer,''), 500), left(nullif(p_user_agent,''), 500), p_ip_hash
    ) returning id into v_id;
    v_status := 'created';
  end if;

  select count(*)::int into v_position
  from public.waitlist_subscribers
  where created_at <= (select created_at from public.waitlist_subscribers where id = v_id)
    and status <> 'unsubscribed';

  return jsonb_build_object('status', v_status, 'position', v_position);
end;
$$;

revoke all on function public.join_waitlist(
  text, text, text, text, boolean, text, text, jsonb, text, text, text) from public;
grant execute on function public.join_waitlist(
  text, text, text, text, boolean, text, text, jsonb, text, text, text)
  to anon, authenticated, service_role;

-- Contagem pública sem expor dados pessoais.
create or replace function public.waitlist_count()
returns integer language sql security definer set search_path = '' stable as $$
  select count(*)::int from public.waitlist_subscribers where status <> 'unsubscribed';
$$;

revoke all on function public.waitlist_count() from public;
grant execute on function public.waitlist_count() to anon, authenticated, service_role;
