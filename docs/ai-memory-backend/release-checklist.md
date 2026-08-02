# Release Checklist — Backend

> Gates antes de promover qualquer alteração de API.

## Qualidade

- [ ] `tsc --noEmit` — zero erros.
- [ ] Build — passa.
- [ ] Contratos de API preservados (envelope, status codes) ou versionados.
- [ ] Testes críticos passando (verificar rotas via curl/script).
- [ ] Zod na fronteira de toda rota nova/alterada.
- [ ] Rate limit em endpoints públicos.
- [ ] Sem endpoints críticos sem autenticação adequada (quando aplicável).

## Segurança / Dados / Observabilidade

- [ ] Sem segredo no client bundle (só env).
- [ ] Sem PII em logs (email mascarado, IP hasheado).
- [ ] Escritas idempotentes (created | already_registered).
- [ ] Migração reversível (se houver).
- [ ] Logs estruturados com prefixo de rota.

## Release / Deploy

- [ ] Commit semântico e limpo.
- [ ] Preview validado (rota atinge o Supabase real do ambiente de preview).
- [ ] Rollback simples (reverter deploy/commit anterior no Vercel).
- [ ] Produção aprovada pelo utilizador.
- [ ] Pós-deploy: smoke test dos endpoints na produção (201/200/422/429 esperados).

## Validação rápida dos endpoints

```bash
# inscrição válida (espera 201) — usar dados de teste
curl -X POST https://essenceofbeautysalon.com/api/waitlist -H 'Content-Type: application/json' \
  -d '{"fullName":"Teste QA","email":"qa@example.com","phone":"+351939009874","phoneCountry":"PT","consent":true}'

# método não suportado (espera 405)
curl -s https://essenceofbeautysalon.com/api/waitlist
```
