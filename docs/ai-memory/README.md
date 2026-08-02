# AI Memory — Base de Conhecimento (Frontend / Landing Pages)

> Memória persistente e versionada do projecto. Lê este index **antes** de qualquer
> edição de UI numa landing page. Cada lição segue o formato único (contexto →
> sintoma → causa → correção → validação → regressão).

## Como usar (obrigatório)

1. **Fase A — Diagnóstico:** lê este README + `playbook-landing-page.md` antes de editar.
2. **Fase B — Implementação:** mudanças mínimas, reversíveis, componentes reutilizáveis.
3. **Fase C — Validação:** corre `release-checklist.md` (visual/functional/technical/SEO/a11y).
4. **Fase D — Aprendizagem:** regista lições em `error-catalog.md` e `decision-log.md`.

## Índice dos artefactos

| Artefacto | Conteúdo |
|---|---|
| `playbook-landing-page.md` | Protocolo operacional completo (fases, gates, severidades, score) |
| `decision-log.md` | Decisões técnicas/produto com trade-offs |
| `error-catalog.md` | Catálogo cumulativo de erros + anti-regressão |
| `modal-patterns.md` | Padrão de modal acessível validado (20/20 QA) |
| `footer-patterns.md` | Padrão de footer compacto responsivo + modais legais |
| `seo-checklist.md` | Checklist SEO técnico por página de evento |
| `responsive-rules.md` | Regras de responsividade por breakpoint real |
| `release-checklist.md` | Checklist de release (gates antes de merge/deploy) |
| `templates/prompt-template.md` | Prompt reutilizável para próximas landings |

## Contexto do projecto actual

- **Stack:** Next.js 15.5 App Router + React 19 + TypeScript + Tailwind v4 + Framer Motion + React Hook Form + Zod + Supabase.
- **Evento:** Além do Espelho 2ª Edição (17 Out 2026, Braga). Cliente: Vitória Gomes / Essence of Beauty.
- **Domínio único:** `https://essenceofbeautysalon.com` (canónico). Sempre com `NEXT_PUBLIC_SITE_URL` para override.
- **Cutover automático:** lista→evento em `2026-08-03T10:00+01:00` (fonte única `src/lib/site.ts`).
- Ver também a memória do agente em `~/.claude/projects/*/memory/` (cross-session).
