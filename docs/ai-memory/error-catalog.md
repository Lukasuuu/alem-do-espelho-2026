# Error Catalog & Anti-Regressão

> Catálogo cumulativo. Cada erro tem: **gatilho comum, detector rápido, correção padrão,
> teste de regressão mínimo.** Novos erros são adicionados aqui quando resolvidos.

---

## E-001 — Painel da modal estourava o viewport (CSS `dvh` inválido)

- **Contexto:** modal aberta em mobile; o painel ficava maior que o ecrã e não dava para fechar a secção.
- **Sintoma:** conteúdo cortado na base, scroll vertical impossível no painel.
- **Causa raiz:** `max-height: calc(100dvh - var(--topo-modal) - 1rem)` sem fallback; browsers sem suporte a `dvh` invalidavam o `calc()` inteiro.
- **Correção aplicada:** `max-height` com **fallback `100vh` antes de `100dvh`** + `overflow-y: auto` no `.modal-content`.
- **Arquivos:** `src/app/globals.css`, `src/components/Modal.tsx`, `src/components/WaitlistModal.tsx`.
- **Como validar:** `scripts/modal-qa.mjs` (4 modais × 4 viewports) — painel `top>=0`, `height<=maxHeight`, `overflowY=auto`.
- **Risco de regressão:** baixo se a regra partilhada `.modal-overlay/.modal-overlay-top` não for alterada.
- **Regra preventiva:** nunca usar `dvh` sem fallback `vh`; nunca alterar a regra partilhada de modal num só componente.
- **Snippet:**
  ```css
  .modal-content {
    max-height: calc(100vh - var(--topo-modal) - 1rem); /* fallback */
    max-height: calc(100dvh - var(--topo-modal) - 1rem); /* progressivo */
    overflow-y: auto;
  }
  ```

---

## E-002 — Modal abria ao centro em vez de ao topo (regressão silenciosa)

- **Contexto:** após alterações de CSS, a modal passou a abrir centrada verticalmente.
- **Sintoma:** painel "flutuando" no meio; em mobile ficava fora da área de leitura.
- **Causa raiz:** `.modal-overlay` com `align-items: center`; intenção de top-alinhamento implícita no `padding-top`, facilmente perdida.
- **Correção aplicada:** classe anti-regressão `.modal-overlay-top` aplicada **nos componentes** (Modal.tsx e WaitlistModal.tsx) com `align-items:flex-start` dominante; regra partilhada no globals.css.
- **Como validar:** QA verifica `classList.contains("modal-overlay-top")` + `align-items: flex-start` calculado.
- **Risco de regressão:** impossível voltar a center sem remover a classe em ambos os componentes.
- **Regra preventiva:** intenção visual crítica explícita como classe própria, nunca só um estilo implícito.

---

## E-003 — CTA da /lista fazia scroll inline em vez de abrir a modal

- **Contexto:** versão lista reutilizava CTAs; a interacção principal devia ser a modal.
- **Sintoma:** clique em "Entrar na lista" scrollava até `#inscricao` (e o form inline já não existia → click perdido).
- **Causa raiz:** `irParaInscricao` fazia `document.getElementById('inscricao')?.scrollIntoView()`; `#inscricao` foi removido → scroll vazio.
- **Correção aplicada:** todos os CTAs → `abrirModal()` (estado local + `definirAberturaModal` global); form inline removido (commit `0de9cb9`).
- **Como validar:** `scripts/test-lista-modal.mjs` — clicar CTA deve abrir `.modal-overlay` visível (desktop+mobile).
- **Risco de regressão:** se alguém reintroduzir scroll inline num CTA, o teste falha.
- **Regra preventiva:** em página com modal única, todo CTA de inscrição dispara a mesma callback de abertura — nunca duplicar lógica de destino.

---

## E-004 — Sitemap fase-aware tinha falso positivo no teste (substring)

- **Contexto:** smoke test do sitemap pós-corte.
- **Sintoma:** teste acusava presença da rota da outra fase quando não existia.
- **Causa raiz:** `body.includes("/alem-do-espelho-2026")` — a rota `/alem-do-espelho-2026/lista` contém o prefixo da rota evento → substring engana.
- **Correção aplicada:** extrair `<loc>` e comparar com `.endsWith()`; assert de contagem exacta (1 loc).
- **Como validar:** `scripts/smoke-cutover.mjs` — `locs.length === 1` e `locs[0].endsWith(rotaEsperada)`.
- **Risco de regressão:** baixo; o próprio teste cobre o caso.
- **Regra preventiva:** em asserts de rotas com prefixos partilhados, comparar caminho exacto (endsWith), nunca substring `includes`.

---

## E-005 — Preview sem a correcção da modal (branch desactualizada)

- **Contexto:** fix commitado em `main` mas preview apontava para branch `feature/lista-de-espera-preview` num commit antigo.
- **Sintoma:** preview falhava QA de modal; main já passava.
- **Causa raiz:** preview e produção em refs diferentes (branch não sincronizada).
- **Correção aplicada:** fast-forward da branch feature para `main` e redeploy do preview.
- **Como validar:** correr o QA no URL do preview novo.
- **Risco de regressão:** repetível se branchs divergirem — **regra:** preview e produção devem apontar para o mesmo commit antes de validar.

---

## E-006 — Build Next.js 404 no Vercel (project criado para Vite)

- **Contexto:** deploy do app Next.js num project Vercel originalmente Vite.
- **Sintoma:** página 404 após deploy; build "passava" mas não servia o app.
- **Causa raiz:** `project settings` com `framework: null` / `outputDirectory: dist`.
- **Correção aplicada:** `vercel.json` no repo com `"framework": "nextjs"`.
- **Como validar:** request a rota real devolve 200 (não 404).
- **Risco de regressão:** se project settings do painel forem editados, o `vercel.json` no repo continua a impor o builder correcto.

---

## E-007 — Domínio não obtenível (essenceofbeauty.com = CVS Health)

- **Contexto:** escolha do domínio canónico.
- **Sintoma:** domínio "ideal" não era do cliente.
- **Causa raiz:** marca "Essence of Beauty" é própria da CVS Health (registo 2004, redirect para cvshealth.com).
- **Correção aplicada:** adoptar `essenceofbeautysalon.com` como canónico.
- **Como validar:** pesquisa de registo WHOIS antes de assumir disponibilidade.
- **Regra preventiva:** **verificar titularidade WHOIS de domínios da marca antes de decidir canonical** — nunca assumir por semelhança de nome.
