-- ═══════════════════════════════════════════════════════════════
-- 0013_cron_emails.sql — R15 FASE 5: drenagem minuto a minuto (OPÇÃO B)
--
-- ⚠️ OPÇÃO A (PREFERIDA pela adenda): Cron nativo do Supabase
--    Dashboard → Integrations → Cron → Create schedule:
--      Name:        drenar-emails
--      Schedule:    * * * * *
--      Target:      Edge Function enviar-emails
--      Method:      POST
--      Headers:     { "x-worker-secret": "<WORKER_SECRET>",
--                     "Authorization": "Bearer <SUPABASE_ANON_KEY>" }
--      Body:        {}
--    R16 — os DOIS cabeçalhos são obrigatórios: o gateway das Edge Functions
--    verifica JWT por omissão (verify_jwt) e rejeita com 401 antes de o
--    código da função correr. A chave anónima é pública e não autentica nada;
--    quem autoriza de verdade é o x-worker-secret.
--    Vantagens: não precisa do pg_net nem do WORKER_SECRET dentro de SQL.
--    Se criares o cron nativo, NÃO apliques este ficheiro.
--
-- OPÇÃO B (este ficheiro): pg_cron + pg_net via SQL.
--   Substituir <WORKER_SECRET> e <SUPABASE_ANON_KEY> pelo valor real ANTES de
--   aplicar (R16: os dois cabeçalhos, como na opção A).
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
      -- R16: o gateway das Edge Functions verifica JWT por omissão
      -- (verify_jwt) e rejeita com 401 antes de o código da função correr —
      -- sem este header, TODAS as drenagens davam 401 e a fila não esvazia.
      -- A chave anónima é pública; quem autoriza de verdade é o
      -- x-worker-secret (a função devolve {"erro":"segredo_invalido"} no
      -- seu 401 próprio, distinto do 401 do gateway).
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) $$
);