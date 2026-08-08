# Error Catalog — Backend

> Catálogo cumulativo: gatilho comum, detector rápido, correção padrão, teste de regressão mínimo.

---

## B-001 — Payload inválido → 422 com campos de erro

- **Gatilho:** request com corpo que falha `waitlistSchema.parse` (Zod).
- **Detector rápido:** `erro instanceof ZodError` na rota; resposta `{ ok:false, mensagem, campos }`.
- **Correção padrão:** normalizar `issue.path` → `campos[chave] = issue.message`; status 422.
- **Teste mínimo:** POST sem `phone` → esperar 422 com `campos.phone`.

## B-002 — JSON do corpo mal formado → 400

- **Gatilho:** `request.json()` lança (corpo vazio/corrompido).
- **Detector rápido:** try/catch em `request.json()`.
- **Correção padrão:** `{ ok:false, mensagem: MENSAGENS.invalido }` status 400.
- **Teste mínimo:** POST com corpo não-JSON → 400.

## B-003 — Bot detectado (honeypot ou tempo) → 400 genérico

- **Gatilho:** campo `website` preenchido OU `elapsedMs < 2500`.
- **Detector rápido:** resposta genérica `MENSAGENS.bot` (não revela qual gatilho).
- **Correção padrão:** devolver 400 sem detalhe — esconder o mecanismo.
- **Teste mínimo:** POST com `website:"x"` → 400 genérico.

## B-004 — Telemóvel inválido para o país → 422 `campos.phone`

- **Gatilho:** `validarTelefone(phone, phoneCountry)` falha.
- **Detector rápido:** `!telefone.ok || !telefone.e164`.
- **Correção padrão:** 422 com `campos:{phone: telefone.erro}`; normalização E.164 quando válido.
- **Teste mínimo:** `+351 123` (inválido PT) → 422; `+351 928 400 069` → OK.

## B-005 — Erro do Supabase (RPC) → 502 / 422 mapeado

- **Gatilho:** RPC devolve `error` (email inválido, telefone inválido, nome, ou falha geral).
- **Detector rápido:** `error.message.includes("invalid_email"|"invalid_phone"|"invalid_full_name")`.
- **Correção padrão:** mapear códigos conhecidos → 422 com campo; resto → `MENSAGENS.servidor` 502.
- **Teste mínimo:** forçar constraint na BD → status esperado; erro inesperado → 502, nunca vaza detalhe ao cliente.

## B-006 — Rate limit atingido → 429 com Retry-After

- **Gatilho:** `rateLimit('waitlist:${ip}')` nega.
- **Detector rápido:** `!limite.permitido`.
- **Correção padrão:** 429 + header `Retry-After` (segundos até reset).
- **Risco conhecido:** Map em memória **reseta em cold start** (ver decision-log B-002) — aceitável para pré-registo; monitorizar se volume crescer.

## B-007 — Método não suportado → 405

- **Gatilho:** `GET` (ou outro) nas rotas POST-only.
- **Detector rápido:** `GET()` devolve `{ ok:false }` 405.
- **Correção padrão:** manter handler GET explícito com 405.
- **Teste mínimo:** GET /api/waitlist → 405.

## B-008 — Excepção inesperada na rota → 500

- **Gatilho:** falha não capturada no bloco try do Supabase.
- **Detector rápido:** catch final `console.error("[waitlist] falha inesperada:", erro)`.
- **Correção padrão:** `MENSAGENS.servidor` 500 — **nunca** vazar stack/erro ao cliente.
- **Teste mínimo:** não aplicável directamente; monitorar logs.
