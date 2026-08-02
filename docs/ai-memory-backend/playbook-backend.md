# Playbook — Backend (protocolo operacional)

> Modo de trabalho em **todo** backend/API. Alinhado ao protocolo enterprise do cliente.

## Fases (executar sempre)

### Fase A — Diagnóstico
1. Ler `docs/ai-memory-backend/README.md` + este playbook.
2. Aplicar `release-checklist.md` como referência.
3. Mapear riscos técnicos e operacionais com base no `error-catalog.md`.

### Fase B — Implementação
- Mudanças pequenas, seguras e reversíveis.
- Preservar contratos de API; evitar breaking changes sem versionamento.
- Priorizar reutilização (schema Zod, rate-limit, validarTelefone) e baixo acoplamento.

### Fase C — Validação
- Funcional: rotas, status codes, contratos.
- Segurança: auth, autorização, rate limit, input validation.
- Dados: transações, constraints, idempotência.
- Técnica: typecheck/build/test/lint.
- Observabilidade: logs estruturados, métricas, traces.
- Performance: latência, throughput, queries críticas.

### Fase D — Aprendizagem
- Actualizar `error-catalog.md` e `decision-log.md`.
- Registrar novas regras neste playbook.
- Publicar resumo executivo curto; documentar próximos riscos.

## Quality Gates (obrigatórios)

- [ ] Zero erro de build/typecheck.
- [ ] Testes críticos passando.
- [ ] Contratos de API validados.
- [ ] Sem endpoints críticos sem autenticação adequada.
- [ ] Sem regressão de latência em rotas sensíveis.
- [ ] Logs estruturados e rastreabilidade mínima.
- [ ] Checklist preenchido em `release-checklist.md`.
- [ ] Memória actualizada com lições aprendidas.

## Especialização contínua

- **Confiabilidade:** idempotência em operações sensíveis; retry/backoff; timeouts explícitos; circuit breaker.
- **Segurança:** validação estrita de entrada; menor privilégio; segredo fora do código; auditoria de eventos sensíveis.
- **Dados:** consistência transacional; migrações com rollback; constraints e invariantes explícitas.
- **Performance:** redução de N+1; caching com estratégia clara; budget de latência por endpoint.
- **Operação:** deploy previsível; rollback simples; observabilidade accionável.

## Diretriz de evolução

A cada projecto: iniciar pelas lições acumuladas; reduzir tempo de diagnóstico; reduzir incidentes e regressões; aumentar robustez da primeira entrega; elevar qualidade sem aumentar complexidade desnecessária.
