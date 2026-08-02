# Performance Checklist — Backend

> Rotas API pequenas e de pré-registo — performance aqui é: previsível, sem cache errada, sem N+1.

## Regras

1. **`force-dynamic` + `no-store`** nas rotas de cutover e API — a virada da fase não pode ser cacheada
   (ver seo-checklist frontend; anti-cache é também contracto de backend).
2. **Sem N+1:** as RPC `join_waitlist` fazem a leitura/escrita atómica na BD — nenhum loop de queries.
3. **Rate limit em memória** é O(1) — mas **não escala horizontalmente** (reset em cold start); se o volume
   crescer, migrar para Redis/Upstash (registado em B-002/B-006).
4. **Payload mínimo:** só os campos do schema são persistidos; `utm` limitado aos campos necessários.
5. **Tempo de arranque:** `runtime = "nodejs"` — cold start do node é aceitável para pré-registo; não usar
   edge sem necessidade.

## Budgets

- Rota API: resposta < ~1s em condições normais (validação + 1 RPC).
- 429 com `Retry-After` evita carga excessiva de clientes repetidores.

## Checklist

- [ ] Zero query N+1.
- [ ] Cache-control correcto (no-store onde a fase muda).
- [ ] Rate limit activo (e monitorizar necessidade de Redis).
- [ ] Latência da rota crítica dentro do budget.
