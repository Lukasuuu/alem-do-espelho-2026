# AI Memory — Base de Conhecimento (Backend / APIs)

> Memória persistente do backend deste projecto (rotas `/api/waitlist` e `/api/sponsor`).
> Lê este index **antes** de alterar qualquer rota. Cada lição segue o formato único.

## Como usar (obrigatório)

1. **Fase A — Diagnóstico:** lê este README + `playbook-backend.md` antes de editar.
2. **Fase B — Implementação:** mudanças pequenas, seguras, reversíveis; preservar contratos de API.
3. **Fase C — Validação:** corre `release-checklist.md` (funcional/segurança/dados/técnico/observabilidade/performance).
4. **Fase D — Aprendizagem:** regista lições em `error-catalog.md` e `decision-log.md`.

## Índice dos artefactos

| Artefacto | Conteúdo |
|---|---|
| `playbook-backend.md` | Protocolo operacional backend (fases, gates, DoD) |
| `decision-log.md` | Decisões com trade-offs (segurança/performance/manutenção/custo) |
| `error-catalog.md` | Catálogo cumulativo de erros + anti-regressão |
| `api-standards.md` | Padrões de contrato, status codes, validação, respostas |
| `security-patterns.md` | Segredos, anti-bot, rate limit, RGPD/PII |
| `data-integrity-patterns.md` | Transações, idempotência, constraints (Supabase RPC) |
| `observability-playbook.md` | Logs estruturados, rastreabilidade, sem PII |
| `performance-checklist.md` | Latência, cache, force-dynamic, no-store |
| `release-checklist.md` | Checklist de release backend |
| `templates/prompt-template.md` | Prompt reutilizável para novos backends |

## Superfície actual

- `POST /api/waitlist` — inscrição na lista de espera (Supabase RPC `join_waitlist`).
- `POST /api/sponsor` — interesse em patrocínio (registo no log com email mascarado; sem tabela ainda).
- Ambos: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, reutilizam `waitlistSchema` (Zod) + `rate-limit` + `validarTelefone`.
- Contratos detalhados em `api-standards.md`.
