# Decision Log

> Registar **sempre** decisões técnicas e de produto: problema, opções, decisão,
> trade-offs, impacto (UX, performance, manutenção, SEO).

## D-001 — Domínio único canónico (essenceofbeautysalon.com)

- **Problema:** cliente precisa de 1 domínio; o secundário custaria mais e criava duplicação de conteúdo indexável.
- **Opções:** (a) domínio único; (b) domínio principal + secundário com 308; (c) dois domínios em paralelo.
- **Decisão:** (a) domínio único `essenceofbeautysalon.com`, default em `src/lib/site.ts` com `NEXT_PUBLIC_SITE_URL` para override. Sitemap/robots/canonical/OG apontam sempre para aqui.
- **Trade-offs:** sem alternância de marca para o público; SEO concentrado num único sítio (bom).
- **Impacto:** SEO ✓ concentração de autoridade; UX ✓ 1 URL para partilhar; manutenção ✓ zero DNS extra.
- **Nota histórica:** `essenceofbeauty.com` (sem "salon") pertence à CVS Health — não é da cliente. `alemdoespelho.com` está estacionado/à venda no GoDaddy.

## D-002 — Cutover temporizado lista→evento (release manager)

- **Problema:** a mesma página deve mostrar lista de espera até 03/08/2026 10:00 e o evento depois, sem intervenção manual e sem 2 versões indexáveis.
- **Opções:** (a) constante única + render por request; (b) cron/server action manual; (c) dois deploys separados.
- **Decisão:** (a) `CORTE_ESPERA_ISO` como fonte única em `src/lib/site.ts`; `isDepoisDoCorte()` em `src/lib/cutover.ts` (server-only). Pré-corte: `/alem-do-espelho-2026` → 308 → `/lista`; pós-corte: `/lista` → 308 → `/alem-do-espelho-2026`.
- **Trade-offs:** rotas de cutover ficam `force-dynamic` + `revalidate=0` (perdem cache estática — aceitável para página de evento).
- **Impacto:** performance — troca cache por correcção de fase (correcto); SEO ✓ só 1 rota indexada por fase; manutenção ✓ corte muda só em `site.ts`.
- **Teste:** `scripts/smoke-cutover.mjs` (header `x-cutover-test: before|after` força fase em preview; ignorado em produção).

## D-003 — Interacção de inscrição via modal em vez de scroll inline

- **Problema:** formulário inline `#inscricao` longe do CTA; scroll inline perde conversão e a modal já existia na EventoPage.
- **Opções:** (a) scroll inline + form no corpo; (b) modal única reutilizada por todos os CTAs; (c) ambos.
- **Decisão:** (b) **um** componente `WaitlistModal` aberto por todos os CTAs (`definirAberturaModal` global). Form inline **removido** do corpo (commit `0de9cb9`) para eliminar duplicação de formulário/modal — regra inegociável.
- **Trade-offs:** SEO perde o form inline no DOM; compensado por metadata + a secção Realizacao continua.
- **Impacto:** UX ✓ CTA no lugar certo abre modal; manutenção ✓ um único form; conversão ✓ esperado.
- **Anti-regressão:** `scripts/test-lista-modal.mjs` valida que CTA abre modal (não scroll) em desktop+mobile.

## D-004 — Secção Realizacao (missão Angola + patrocinadores) na /lista

- **Problema:** a `/lista` não renderizava a secção "Quem faz acontecer" (missão Angola + SponsorFlow) que existia na EventoPage — conteúdo crítico do cliente faltava.
- **Opções:** (a) duplicar a secção; (b) reutilizar o componente `Realizacao.tsx` na mesma ordem.
- **Decisão:** (b) `<Realizacao />` após `<Gallery />` em `ListaEsperaPage.tsx` (commit `7529f95`) — espelha a EventoPage.
- **Impacto:** UX ✓ missão Angola visível; manutenção ✓ zero duplicação; SEO ✓ conteúdo presente.

## D-005 — Anti-cache na virada (force-dynamic + no-store)

- **Problema:** build estático congelaria a fase do cutover na virada de 03/08 10:00.
- **Decisão:** rotas de cutover + sitemap com `force-dynamic`, `revalidate = 0`, `Cache-Control: no-store`.
- **Trade-offs:** sem cache CDN nessas rotas (aceitável — conteúdo dinâmico de fase).
- **Impacto:** confiabilidade ✓ corte no minuto certo; performance — request por request (consciente).

## D-006 — Verificação Vercel: `vercel.json` com framework nextjs

- **Problema:** o project Vercel foi criado para o app Vite antigo (`framework: null`, `outputDirectory: dist`) → build Next.js não era servido (404).
- **Decisão:** `vercel.json` no repo com `"framework": "nextjs"` para forçar o builder correcto.
- **Impacto:** confiabilidade ✓; manutenção ✓ replicável em projecto novo.
- **Risco:** mexer em project settings no painel pode reverter — manter o `vercel.json` no repo.
