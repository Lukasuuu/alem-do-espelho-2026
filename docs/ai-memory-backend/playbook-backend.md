# Playbook — Backend (protocolo Ultra Enterprise)

> Modo de trabalho em **todo** backend/API, nível produção. Combina o protocolo
> Backend Ultra Enterprise do cliente com a base de conhecimento do repo
> (`error-catalog.md`, `decision-log.md`, `security-patterns.md`).

## Fases (executar sempre)

### Fase A — Diagnose
1. Ler `docs/ai-memory-backend/README.md` + este playbook.
2. Mapear riscos **S0/S1 primeiro** (base: `error-catalog.md`).
3. Revisar contratos de API e dependências externas.

### Fase B — Build
- Mudanças pequenas, isoladas e reversíveis.
- Evitar breaking changes sem versionamento.
- Garantir idempotência onde necessário.

### Fase C — Verify
- Testes funcionais + regressão.
- Teste de segurança básico.
- Teste de latência em endpoints críticos.
- Verificar logs/métricas/traces.

### Fase D — Release
- Commit semântico.
- Changelog objetivo.
- Deploy preview/staging.
- Go/no-go baseado em quality score.

### Fase E — Learn
- Atualizar `decision-log.md` e `error-catalog.md`.
- Criar regra de prevenção para falhas novas.

## Matriz de Severidade (S0–S3)

| Severidade | Exemplos | SLA |
|---|---|---|
| **S0** Crítico — bloqueia tudo | vazamento de dados sensíveis; indisponibilidade total de API crítica; corrupção de dados; auth bypass / falha grave de autorização | **imediato (0–2h)** + mitigação emergencial; hotfix; bloquear deploy; incidente + postmortem obrigatórios |
| **S1** Alto — bloqueia produção | endpoint crítico quebrado; falha de transação com perda funcional; timeout generalizado em fluxo principal; regressão grave de performance | mesmo dia / antes do próximo release; validação extra de regressão |
| **S2** Médio — corrigir no ciclo | inconsistência de resposta não crítica; observabilidade incompleta; warning relevante de segurança/performance | no ciclo atual; documentar risco residual se não for possível |
| **S3** Baixo — melhoria | refino de logs; cleanup técnico sem impacto imediato; padronização de mensagens | backlog priorizado por impacto/risco/esforço |

Regra: resolver **S0 e S1 antes de qualquer melhoria opcional**.

## Quality Score por release (0–100)

| Dimensão | Pts |
|---|---|
| Confiabilidade funcional | 30 |
| Segurança | 20 |
| Integridade de dados | 15 |
| Observabilidade | 15 |
| Performance | 10 |
| Governança de release/documentação | 10 |

Regra: **≥90 aprovado** · 80–89 aprovado com ressalvas · **<80 não promover produção**.

## Definition of Done (DoD) Backend

Uma entrega só está pronta quando:
- [ ] Build/typecheck sem erros.
- [ ] Testes críticos passando.
- [ ] Endpoints críticos validados (happy/edge/error path).
- [ ] Segurança mínima garantida (authN/authZ/input validation/rate limit quando aplicável).
- [ ] Migração de dados segura e reversível (se houver).
- [ ] Logs estruturados + correlação de request (trace id).
- [ ] Métricas mínimas instrumentadas (latência, erro, throughput).
- [ ] Checklist de release preenchido (`release-checklist.md`).
- [ ] Memória persistente atualizada com lições aprendidas.
- [ ] Plano de rollback testável documentado.

## Política de segurança mínima

- Validação estrita de payload · sanitização de entrada · autenticação/autorização explícitas ·
  proteção contra abuso (rate limit quando aplicável) · segredos via env/secret manager (**nunca hardcoded**) ·
  mascaramento de dados sensíveis em logs. → ver `security-patterns.md`.

## Política de dados e migração

Sempre que houver mudança de schema: migração versionada · plano de rollback · compatibilidade
retroativa temporária (se necessário) · validação pós-migração · janela de risco documentada.
→ ver `data-integrity-patterns.md`.

## Relatório final obrigatório (9 blocos)

1. Resumo executivo · 2. Alterações implementadas · 3. Bugs corrigidos por severidade (S0–S3) ·
4. Evidências de validação · 5. Quality Score final · 6. Riscos remanescentes · 7. Plano de rollback ·
8. Memória persistente atualizada · 9. Próximos passos recomendados.

## Especialização contínua

- **Confiabilidade:** idempotência em operações sensíveis; retry/backoff; timeouts explícitos; circuit breaker.
- **Segurança:** validação estrita de entrada; menor privilégio; segredo fora do código; auditoria de eventos sensíveis.
- **Dados:** consistência transacional; migrações com rollback; constraints e invariantes explícitas.
- **Performance:** redução de N+1; caching com estratégia clara; budget de latência por endpoint.
- **Operação:** deploy previsível; rollback simples; observabilidade accionável.

## Diretriz de evolução

A cada projecto: iniciar pelo histórico acumulado; reduzir tempo de diagnóstico; reduzir incidentes
pós-release; melhorar score médio de qualidade; aumentar previsibilidade sem aumentar complexidade
desnecessária.
