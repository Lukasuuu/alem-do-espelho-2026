# Observability Playbook

> Rastreabilidade mínima com zero PII. Logs consultáveis no Vercel (runtime logs).

## Regras

1. **Prefixo por rota** — `[waitlist]` / `[sponsor]` no início de cada log.
2. **Nunca logar PII**: email → `mascararEmail` (`a***@dominio`); IP → `hashIp`.
3. **Log de eventos de negócio** em `console.info` (JSON.stringify), erros em `console.error` com contexto suficiente para debugar sem reproduzir.
4. **Correlação:** o request id do Vercel aparece nos runtime logs; usar contexto da rota no corpo do log.

## Padrão de log

```ts
// evento de negócio (sem PII)
console.info("[sponsor] novo interesse de patrocínio", JSON.stringify({
  email: mascararEmail(dados.email),
  pais: dados.phoneCountry,
  utmSource: dados.utm?.utm_source ?? null,
  ipHash: hashIp(ip),
}));

// erro do Supabase (mensagem de erro do provider, sem dados do utilizador)
console.error("[waitlist] erro do supabase:", error.message);

// excepção inesperada (stack sim, dados pessoais não)
console.error("[waitlist] falha inesperada:", erro);
```

## Como consultar

- Vercel → project → Logs (runtime logs), filtrar por `[waitlist]` / `[sponsor]` e por request.
- `scripts/smoke-cutover.mjs` não cobre logs — verificação pós-cutover = consultar runtime logs no painel.

## Checklist

- [ ] Logs estruturados (JSON) em eventos de negócio.
- [ ] PII nunca em logs (email mascarado, IP hasheado).
- [ ] Erros com contexto suficiente.
- [ ] Filtros por rota documentados.
