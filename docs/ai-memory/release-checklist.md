# Release Checklist (Landing Page)

> Gates obrigatórios antes de merge/promover a produção. Todos têm de ser verdadeiros.

## Antes do build

- [ ] Mudança mínima e reversível (escopo cirúrgico — nada de refactor amplo sem aprovação).
- [ ] Sem duplicação de formulário/modal/contacto (fonte única `site.ts`).
- [ ] Identidade visual preservada (paleta/KeyArt/tipografia).

## Qualidade (Quality Gates)

- [ ] `tsc --noEmit` — zero erros.
- [ ] Build — passa.
- [ ] Zero erro crítico de console (QA com Playwright).
- [ ] CTA principal funcionando (abre modal / destino correcto).
- [ ] Form principal funcionando — estados de sucesso e erro.
- [ ] Modais: abrir / ESC / clique fora / trap de foco / sem overflow.
- [ ] Footer responsivo sem overflow.
- [ ] Links externos principais válidos (WhatsApp, email).
- [ ] SEO mínimo: title, description, canonical absoluto, OG, Twitter.
- [ ] A11y básica: teclado, labels, contraste mínimo operacional.

## Validação automatizada disponível

```bash
node scripts/test-lista-modal.mjs <URL>   # CTA → modal, desktop+mobile
node scripts/modal-qa.mjs <URL>           # 4 modais × 4 viewports
node scripts/smoke-cutover.mjs <URL>      # redirects, no-store, sitemap
node scripts/check-inscricao.mjs <URL>    # presença do form/CTA
```

## Release / Deploy

- [ ] Commit semântico e limpo (`feat|fix|refactor|docs` + Conventional Commits).
- [ ] Changelog / mensagem descreve mudança + impacto.
- [ ] Preview deployado e validado no URL de preview (mesmo commit da produção).
- [ ] Plano de rollback definido (tag ou deploy anterior no Vercel).
- [ ] Produção aprovada pelo utilizador antes de promover.

## Pós-deploy

- [ ] Smoke test imediato na produção (domínio canónico).
- [ ] Registar status: OK / risco / bloqueio.
- [ ] Memória actualizada (error-catalog, decision-log, playbook).

## Modelo de evolução

> A cada release, medir: tempo de diagnóstico, retrabalho, regressões, score de qualidade.
> Objectivo: reduzir diagnóstico e retrabalho, aumentar robustez da primeira entrega.
