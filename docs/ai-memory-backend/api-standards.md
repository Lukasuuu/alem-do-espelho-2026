# API Standards

> Contratos e padrões das rotas deste projecto. Preservar em qualquer evolução.

## Regras gerais

- **Runtime:** `nodejs` + `dynamic = "force-dynamic"` (headers, body, Supabase).
- **Validação na fronteira com Zod** (`waitlistSchema`) — nunca confiar em input externo.
- **Envelope de resposta uniforme:** `{ ok: true|false, ... }`.
- **Erro é valor de retorno, não excepção** (excepto catch final defensivo).
- **Nunca vazar detalhe interno ao cliente** (mensagens genéricas `MENSAGENS.*`).
- **Sem PII em logs** — email mascarado, IP hasheado.

## Envelopes

```ts
type RespostaOk = { ok: true; status: "created" | "already_registered" | "sponsor"; posicao?: number };
type RespostaErro = { ok: false; mensagem: string; campos?: Record<string, string> };
```

## Rotas e status codes

### `POST /api/waitlist`
| Status | Significado |
|---|---|
| 201 | `created` — nova inscrição (`posicao` devolvida) |
| 200 | `already_registered` — duplicado tratado na BD |
| 400 | JSON inválido / bot detectado |
| 422 | Validação Zod ou telefone/email — `campos` com erro por campo |
| 429 | Rate limit — header `Retry-After` |
| 500 | Excepção inesperada |
| 502 | Erro do Supabase não mapeado |

### `POST /api/sponsor`
| Status | Significado |
|---|---|
| 201 | `sponsor` — interesse registado (log, email mascarado) |
| 400 | JSON inválido / bot detectado |
| 422 | Validação — `campos` |
| 429 | Rate limit |
| 500 | Excepção inesperada |

### Qualquer rota com método não suportado
- **405** `{ ok:false, mensagem: "Método não permitido." }` (handler `GET` explícito).

## Payload esperado (waitlist/sponsor — mesmo esquema)

`fullName`, `email`, `phone`, `phoneCountry` (código de país), `consent`, `locale?`, `utm?` (`utm_source` etc.), `website?` (honeypot), `elapsedMs?` (anti-bot).

## Evolução segura

- Nunca mudar o envelope sem versionar a rota.
- Campos novos opcionais no schema; nunca tornar obrigatório campo que já estava no ar sem aviso.
- Novo endpoint de sponsors: trocar o `console.info` (passo 6) por insert, mantendo o resto da rota igual (ver decision-log B-004).
