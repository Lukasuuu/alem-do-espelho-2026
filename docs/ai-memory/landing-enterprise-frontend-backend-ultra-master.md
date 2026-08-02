# Landing Enterprise Master — Frontend + Backend + Go-Live (Sincronizado)

Data de sincronização: 2026-08-02  
Escopo: consolidar todas as versões enterprise propostas para Landing Pages nesta conversa e tornar reutilizável em novos projetos.

## 1) Frontend Enterprise (protocolo oficial)
- Modelo operacional em 6 fases: Discovery, Design Técnico, Build, Verification, Release, Learning.
- Severity matrix S0–S3 para priorização de correções.
- Quality gates obrigatórios antes de concluir entrega.
- Score de qualidade 0–100 (meta >= 90).
- Definition of Done com evidências por breakpoint, funcional, técnico, SEO e acessibilidade.
- Resposta final padronizada em blocos (resumo, mudanças, bugs, evidências, score, riscos/rollback, memória).

Referência principal:
- playbook-landing-page.md

## 2) Backend Enterprise (versão completa)
- Arquitetura orientada a confiabilidade, segurança, integridade de dados e observabilidade.
- Contratos de API explícitos, validação de entrada, idempotência, transações, proteção de segredos.
- Playbook de release backend com gates, rollback e aprendizado pós-incidente.

## 3) Backend Ultra Enterprise (S0–S3 + SLA + Score + DoD)
- Severidade:
  - S0 crítico (bloqueia tudo)
  - S1 alto (bloqueia produção)
  - S2 médio (corrigir no ciclo)
  - S3 baixo (backlog)
- SLA:
  - S0: imediato
  - S1: antes de produção
  - S2: ciclo atual
  - S3: backlog priorizado
- Quality Score por release (0–100), com regra de aprovação.
- DoD backend obrigatório com testes, contratos, segurança, observabilidade e rollback.

## 4) Base processual no repositório (fonte de verdade)
Frontend:
- docs/ai-memory/README.md
- docs/ai-memory/decision-log.md
- docs/ai-memory/error-catalog.md
- docs/ai-memory/footer-patterns.md
- docs/ai-memory/modal-patterns.md
- docs/ai-memory/seo-checklist.md
- docs/ai-memory/responsive-rules.md
- docs/ai-memory/release-checklist.md
- docs/ai-memory/playbook-landing-page.md
- docs/ai-memory/templates/prompt-template.md

Backend:
- docs/ai-memory-backend/README.md
- docs/ai-memory-backend/decision-log.md
- docs/ai-memory-backend/error-catalog.md
- docs/ai-memory-backend/api-standards.md
- docs/ai-memory-backend/security-patterns.md
- docs/ai-memory-backend/data-integrity-patterns.md
- docs/ai-memory-backend/observability-playbook.md
- docs/ai-memory-backend/performance-checklist.md
- docs/ai-memory-backend/release-checklist.md
- docs/ai-memory-backend/playbook-backend.md
- docs/ai-memory-backend/templates/prompt-template.md
- docs/ai-memory-backend/templates/incident-postmortem.md

## 5) Operação já validada no projeto Além do Espelho
- Domínio canônico único em produção: https://essenceofbeautysalon.com
- Evento em rota: /alem-do-espelho-2026
- Lista em rota: /alem-do-espelho-2026/lista
- Modal de inscrição consolidada via overlay (fora do corpo), CTA abrindo modal.
- Deploy preview e produção validados com status 200.

Referência operacional:
- alem-do-espelho-go-live-operacao.md

## 6) Regras de anti-regressão reutilizáveis
1. Sempre validar preview e produção no mesmo commit hash.
2. Nunca assumir que preview está atualizado sem confirmar branch/deploy.
3. Em modal: validar abrir, ESC, clique fora, foco, responsividade.
4. Evitar duplicidade: ou modal, ou inline — não manter fluxo híbrido sem objetivo.
5. Confirmar canonical/OG/sitemap após troca de domínio.

## 7) Procedimento obrigatório em todo novo projeto
- Fase A: abrir primeiro playbook-landing-page.md e release-checklist.md.
- Ler error-catalog e decision-log antes de editar código.
- Aplicar quality gates antes de marcar entrega como concluída.
- Registrar lições aprendidas no formato padrão (contexto, sintoma, causa, correção, validação, prevenção).

## 8) Status da sincronização
- Memória local do Claude no PC: sincronizada.
- Memória de operação do projeto: preservada.
- Frontend Enterprise + Backend Enterprise + Backend Ultra Enterprise: consolidados neste arquivo.