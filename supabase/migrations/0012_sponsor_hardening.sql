-- ═══════════════════════════════════════════════════════════════
-- Além do Espelho 2026 — Bloco J r2: HARDENING (0012) — NÃO APLICAR
-- AGORA. Só depois de:
--   1. a 0011 estar aplicada no Supabase (SQL Editor);
--   2. o frontend novo (modal C com iniciar_pagamento_sponsor +
--      posse_token) estar EM PRODUÇÃO e validado;
--   3. confirmação explícita do Lucas.
-- Enquanto o frontend antigo estiver em produção, as RPCs de 2
-- argumentos têm de continuar a existir — este ficheiro remove-as.
-- ═══════════════════════════════════════════════════════════════

-- As 2-arg são os caminhos SEM posse_token que o frontend atual (main
-- @ ad62d56) usa. Quando tudo novo estiver em produção, fecham-se.
drop function if exists public.definir_nivel_sponsor(uuid, integer);
drop function if exists public.definir_metodo_sponsor(uuid, text);

-- Criar_pagamento_sponsor ficou obsoleto: iniciar_pagamento_sponsor
-- substitui-o (método + pagamento numa única transação).
drop function if exists public.criar_pagamento_sponsor(uuid, text, text);

insert into public.migrations_aplicadas (nome, origem, nota) values
  ('0012_sponsor_hardening','sql_editor','Bloco J r2 hardening: drop das RPCs 2-arg (definir_nivel_sponsor/definir_metodo_sponsor) e de criar_pagamento_sponsor (substituída por iniciar_pagamento_sponsor atómica). Aplicar SÓ após frontend novo em produção.')
on conflict (nome) do update set nota = excluded.nota;

-- ───────────────────────────────────────────────────────────────
-- DOWN — recriar as assinaturas antigas a partir de:
--   definir_nivel_sponsor(uuid, integer)  → 0005:104-124
--   definir_metodo_sponsor(uuid, text)    → 0004:115-138
--   criar_pagamento_sponsor(uuid,text,text) → 0011 (versão anterior)
-- Os corpos originais estão nos ficheiros de migrations; re-aplicar os
-- blocos correspondentes (create or replace) e re-grantar:
--   grant execute on function ... to anon, authenticated, service_role;
--   delete from public.migrations_aplicadas where nome = '0012_sponsor_hardening';