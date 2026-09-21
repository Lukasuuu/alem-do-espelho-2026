-- ═══════════════════════════════════════════════════════════════
-- 0013_cron_emails.sql — R15 FASE 5: drenagem minuto a minuto (OPÇÃO B)
--
-- ⚠️ OPÇÃO A (PREFERIDA pela adenda): Cron nativo do Supabase
--    Dashboard → Integrations → Cron → Create schedule:
--      Name:        drenar-emails
--      Schedule:    * * * * *
--      Target:      Edge Function enviar-emails
--      Method:      POST
--      Headers:     { "x-worker-secret": "<WORKER_SECRET>" }
--      Body:        {}
--    Vantagens: não precisa do pg_net nem do WORKER_SECRET dentro de SQL.
--    Se criares o cron nativo, NÃO apliques este ficheiro.
--
-- OPÇÃO B (este ficheiro): pg_cron + pg_net via SQL.
--   Substituir <WORKER_SECRET> pelo valor real ANTES de aplicar.
--   O secret fica visível em cron.job (só visível a service_role/dashboard) —
--   é o custo conhecido desta opção; a alternativa nativa evita-o.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('drenar-emails');

select cron.schedule(
  'drenar-emails',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://qtiyxibqeignvsnfhzpw.supabase.co/functions/v1/enviar-emails',
    headers := jsonb_build_object(
      'x-worker-secret', '<WORKER_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) $$
);