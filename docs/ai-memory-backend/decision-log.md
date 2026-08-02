# Decision Log — Backend

> Problema, opções, decisão, trade-offs, impacto (segurança, performance, manutenção, custo).

## B-001 — Persistência via RPC Supabase (join_waitlist) em vez de insert directo

- **Problema:** inscrever na lista de espera com consistência (duplicados, validação de domínio, posição na fila).
- **Opções:** (a) `supabase.from('waitlist').insert()`; (b) RPC dedicado `join_waitlist` no Postgres; (c) serviço externo.
- **Decisão:** (b) `supabase.rpc("join_waitlist", {…})` — a lógica de "created | already_registered" e constraints vivem na BD.
- **Trade-offs:** mais uma camada (SQL mantido fora do repo) mas consistência atómica na BD.
- **Impacto:** segurança ✓ menos código no servidor; performance ✓ atómico; manutenção — o SQL vive no Supabase (documentar no README); custo ✓ zero extra.

## B-002 — Rate limit por IP em memória (hash do IP)

- **Problema:** endpoint público de inscrição vulnerável a spam/bot.
- **Opções:** (a) rate limit em memória (Map) por hash de IP; (b) Upstash/Redis; (c) sem rate limit.
- **Decisão:** (a) `rate-limit.ts` — Map em memória com `hashIp()`; simples, sem dependência externa.
- **Trade-offs:** **reseta em cold start** (perde contagem entre instâncias/restarts) — aceitável para pré-registo com anti-bot complementar; nunca escala horizontal sem Redis.
- **Impacto:** segurança ✓ bloqueia abuso básico; custo ✓ zero; manutenção ✓ simples.
- **Registado em error-catalog B-006.**

## B-003 — Rotas `force-dynamic` + `runtime = "nodejs"` (não edge)

- **Problema:** as rotas de API precisam de ler headers, `request.json()` e aceder ao Supabase.
- **Decisão:** `runtime = "nodejs"` + `dynamic = "force-dynamic"` — comportamento previsível, sem edge quirks, streaming desnecessário aqui.
- **Impacto:** performance ✓ latência de arranque do node aceitável; confiabilidade ✓ sem incompatibilidades de runtime.

## B-004 — Sponsors sem tabela → log com email mascarado (RGPD)

- **Problema:** não existe tabela de leads de patrocínio; ainda assim é preciso capturar interesse.
- **Decisão:** `console.info` com **email mascarado** (`a***@dominio`) + `hashIp` — nunca PII em claro nos logs.
- **Trade-offs:** sem persistência consultável até criar a tabela; **quando a tabela existir, trocar o passo 6 por um insert** (estrutura já documentada no código).
- **Impacto:** segurança ✓ RGPD; manutenção ✓ caminho de evolução claro.

## B-005 — Anti-bot com honeypot + tempo mínimo (não só rate limit)

- **Problema:** rate limit por IP não distingue bot de humano; bots preenchem rápido.
- **Decisão:** campo `website` escondido (honeypot) + `elapsedMs` < 2,5s → resposta genérica 400 `MENSAGENS.bot`.
- **Impacto:** segurança ✓ custo baixo; UX ✓ humano real raramente submete <2,5s.
