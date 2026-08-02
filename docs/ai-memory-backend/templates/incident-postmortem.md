# Incident Postmortem (template)

> Obrigatório para incidentes **S0** (e recomendado para S1 graves). Preencher com factos,
> sem culpas. O objetivo é uma regra de prevenção nova no `error-catalog.md`.

---

## Incidente

- **ID:** `INC-YYYYMMDD-###`
- **Data/hora início:** `…` (UTC)
- **Data/hora fim:** `…` (UTC)
- **Duração (MTTR):** `…`
- **Severidade:** S0 / S1
- **Impacto:** `…` (utilizadores afectados, fluxos, dados, receita)
- **Reportado por:** `…`
- **Endpoints/componentes envolvidos:** `…`

## Resumo executivo (1–3 frases)

> O que aconteceu, para quem, e qual o estado actual.

## Timeline

| Hora (UTC) | Evento |
|---|---|
| … | Deteção |
| … | Resposta inicial |
| … | Mitigação |
| … | Resolução |
| … | Verificação pós-recuperação |

## Detalhes

### Contexto
O que estava a acontecer antes do incidente (release, tráfego, mudança de schema/contrato).

### Sintoma
Como foi observado (erro, alerta, utilizador, monitorização).

### Causa raiz
Porquê — a causa real, não o sintoma. Incluir diagrama/evidência quando aplicável.

### Correção aplicada
O que foi feito para mitigar e para resolver definitivamente.

### Arquivos afetados
Lista de ficheiros/rotas/migrações envolvidas.

## Validação pós-incidente

- [ ] Endpoints críticos validados (happy/edge/error path).
- [ ] Dados íntegros (sem corrupção/perda).
- [ ] Logs/métricas/traces conferem a resolução.
- [ ] Rollback desfeito correctamente (se usado).

## Regra de prevenção

> Nova entrada no `error-catalog.md` (gatilho, detector rápido, correção padrão, teste de regressão).

## Ações de acompanhamento

| Ação | Dona | Prazo | Status |
|---|---|---|---|
| … | … | … | aberta |

## Lições e melhoria contínua

- O que funcionou bem na resposta.
- O que demorou/custou tempo de diagnóstico.
- Como reduzir tempo de diagnóstico da próxima vez.

---
*Reutilizar este template a cada incidente S0/S1 — registar no `error-catalog.md` e `decision-log.md`.*
