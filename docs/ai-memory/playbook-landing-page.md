# Playbook — Landing Page (protocolo operacional)

> Modo de trabalho em **toda** landing page. Combina o protocolo enterprise do cliente (6 fases,
> severity S0–S3, quality gates, score 0–100, DoD) com a base de conhecimento do repo.

## Fases (executar sempre)

### Fase A — Diagnóstico
1. Ler `docs/ai-memory/README.md` + este playbook.
2. Aplicar `release-checklist.md` e `seo-checklist.md` como referência.
3. Mapear riscos previstos com base no `error-catalog.md`.

### Fase B — Implementação
- Mudanças mínimas, seguras e reversíveis.
- Preservar identidade visual e semântica.
- Priorizar componentes reutilizáveis; evitar duplicação (form/modal/contacto).
- Componentes críticos a mapear: CTA, formulário, modal, footer, links externos, metadata SEO.

### Fase C — Validação
- Visual por breakpoint (mobile/tablet/notebook/desktop).
- Funcional: todos links, botões, modais, forms, scrolls.
- Técnico: typecheck/build sem erros.
- A11y básica: foco, labels, contraste, teclado.
- SEO técnico: title, description, canonical, OG/Twitter.

### Fase D — Aprendizagem
- Actualizar `error-catalog.md` e `decision-log.md`.
- Acrescentar novas regras a este playbook.
- Publicar resumo executivo curto.

## Severity Matrix (classificar todo problema)

| Severidade | Definição | SLA |
|---|---|---|
| **S0** Crítico | Quebra de produção, dados sensíveis, página indisponível, form principal inoperante | Hotfix imediato, bloqueia release |
| **S1** Alto | CTA principal quebrado, modal crítica a falhar, regressão mobile forte, erro de build | Corrigir antes de promover |
| **S2** Médio | Visuais relevantes, SEO incompleto, a11y parcial, link secundário quebrado | No ciclo actual quando possível |
| **S3** Baixo | Cosméticos sem impacto funcional | Backlog priorizado |

Regra: resolver **S0 e S1 antes de qualquer melhoria opcional**.

## Quality Gates (todos verdadeiros para release)

Build/typecheck ✓ · zero console error crítico ✓ · CTA principal ✓ · form ✓ (sucesso+erro) · modais foco/ESC/fechar ✓ · footer responsivo ✓ · links externos ✓ · SEO mínimo ✓ · a11y básica ✓ · plano de rollback ✓.

## Score de qualidade por release (0–100)

| Dimensão | Pts |
|---|---|
| Funcionalidade | 30 |
| Responsividade | 20 |
| SEO técnico | 15 |
| Acessibilidade | 15 |
| Performance perceptível | 10 |
| Confiabilidade de release (logs/checklist) | 10 |

**Meta ≥ 90.** Abaixo → release "condicional".

## Definition of Done

- Implementado e validado em desktop/tablet/mobile.
- Sem regressão nos fluxos críticos.
- Evidências de teste registadas.
- Memória/documentação actualizada.
- Commit semântico e limpo.
- Próximos riscos mapeados.

## Formato da lição aprendida (usar sempre)

Contexto → Sintoma → Causa raiz → Correção aplicada → Arquivos impactados → Como validar → Risco de regressão → Regra preventiva → Snippet reutilizável (quando aplicável).

## Relatório final obrigatório (7 blocos)

1. Resumo executivo · 2. Mudanças aplicadas · 3. Bugs corrigidos (com severidade) · 4. Evidências de validação · 5. Score de qualidade · 6. Riscos remanescentes + rollback · 7. Memória actualizada e lições para próximos projectos.

## Especialização contínua

- **Conversão:** hierarquia de CTA, clareza de proposta de valor, fricção mínima em forms.
- **UX/UI:** espaçamentos responsivos, legibilidade/contraste, consistência entre secções.
- **Engenharia:** componentes reaproveitáveis, código previsível, baixo risco de regressão.
- **SEO:** metadata completa por página, canonical, headings, social.
- **Operação:** commit limpo, documentação objectiva, release previsível.

## Diretriz de evolução

A cada projecto: começar pelas lições acumuladas; reduzir tempo de diagnóstico; reduzir retrabalho; aumentar robustez da primeira entrega; elevar qualidade sem aumentar complexidade desnecessária.
