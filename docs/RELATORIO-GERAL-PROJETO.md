# Relatório Geral do Projeto — Além do Espelho 2026

> Documento de referência completo para consumo por IA (Claude.ia) e equipa.
> Última atualização: **05/08/2026**. Fonte: estado real do repositório em `main` (production).

---

## 1. Visão Geral

Landing page de captação da **2ª edição do evento "Além do Espelho"**, um dia de
desenvolvimento pessoal feminino, autoestima e networking.

- **Evento:** 17 de outubro de 2026, 09:00 (WEST) — INNSiDE by Meliá, Braga, Portugal.
- **Capacidade:** 100 vagas.
- **Anfitriã:** Vitória Gomes — empresária, escritora, ativista social feminina;
  CEO e fundadora do **Essence of Beauty**.
- **Projeto social:** arrecadação e envio de produtos de higiene feminina para
  mulheres em situação de vulnerabilidade em Angola (missão da edição).
- **Modelo de captação:** lista de espera com **corte automático** a 03/08/2026
  10:00 (Lisboa) — após o corte, a página troca sozinha para a versão do evento.
- **Entidades:** Essence of Beauty (Realização), Conexão Women (Organização),
  Organização Atos (Apoio — ONG angolana).

O repositório é o **único site**, com duas fases que partilham código: a landing
da **lista de espera** (pré-corte) e a **landing do evento** (pós-corte).

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.22 |
| UI | React | 19.1.1 |
| Linguagem | TypeScript (strict) | 5.9.2 |
| Estilos | Tailwind CSS (v4, config em CSS) | 4.1.13 |
| Animações | Framer Motion | 12.23.12 |
| Base de dados | Supabase (Postgres) via `@supabase/supabase-js` | 2.58.0 |
| Validação | Zod | 3.25.76 |
| Telefones | libphonenumber-js | 1.12.10 |
| Ícones | lucide-react | 1.28.0 |
| Teste E2E (dev) | playwright-core | 1.62.1 |
| Hosting | Vercel (integração GitHub) | — |

**Notas de stack:**
- Tailwind v4 **não usa** `tailwind.config.ts` — a configuração é CSS-first via
  `@theme` em `src/app/globals.css` (`@tailwindcss/postcss`).
- **Zero dependências de fonts externas** — Recline e Jost são self-hosted em
  WOFF2 no próprio domínio (evita transferir IPs de visitantes para fora da UE).
- **Não há ESLint configurado** no projeto. Os portões de validação são:
  `tsc --noEmit` (typecheck) e `next build`.

---

## 3. Arquitetura & Roteamento

### 3.1 Fases e o sistema de "cutover" (virada automática)

O site tem **duas fases** separadas por uma constante única:

```
CORTE_ESPERA_ISO = "2026-08-03T10:00:00+01:00"   // src/lib/site.ts
```

Esta constante é **fonte única** para o countdown, a virada e o sitemap.

| Rota | Antes do corte | No corte e depois |
|---|---|---|
| `/alem-do-espelho-2026/lista` | Lista de espera (página ativa) | **308** → `/alem-do-espelho-2026` |
| `/alem-do-espelho-2026` | **308** → lista | Landing do evento (página ativa) |
| `/lista` | **308** → `/alem-do-espelho-2026/lista` | converge |
| `/lista-de-espera` | **308** → `/alem-do-espelho-2026/lista` | converge |
| `/` | **308** → `/alem-do-espelho-2026` | idem |
| `/sitemap.xml` | lista `/alem-do-espelho-2026/lista` | evento `/alem-do-espelho-2026` |

**Decisões-chave do cutover:**
- **Anti-cache na virada:** todas as rotas de cutover são `force-dynamic` +
  `revalidate = 0`; renderização por request, o build estático nunca congela a
  virada (`Cache-Control: no-store`).
- **Testável sem esperar a data:** header `x-cutover-test: after|before` força o
  resultado **fora de produção**. Em produção (`VERCEL_ENV=production`) o header
  é ignorado — não existe forma pública de saltar o corte.
- **Nunca existem duas versões indexáveis em paralelo** — evita conteúdo duplicado
  para o Google em qualquer instante.
- **308 (permanent)** nas rotas antigas: preserva URLs que já circularam
  (WhatsApp, biografia, posts) sem duplicar conteúdo.

### 3.2 Árvore de rotas (App Router)

```
src/app/
├── api/
│   ├── waitlist/route.ts        POST — inscrição na lista (Supabase RPC)
│   └── sponsor/route.ts         POST — lead de patrocínio (log mascarado)
├── alem-do-espelho-2026/
│   ├── page.tsx                 Landing do evento (pós-corte)
│   └── lista/page.tsx           Lista de espera (pré-corte)
├── lista/page.tsx               308 → /alem-do-espelho-2026/lista
├── lista-de-espera/page.tsx     308 → /alem-do-espelho-2026/lista
├── sitemap.ts                   Sitemap fase-aware (só a rota ativa)
├── robots.ts                    robots.txt + sitemap
├── globals.css                  Tokens da marca + fontes + .espelho
├── layout.tsx                   SEO, OG, Twitter, JSON-LD, MotionProvider
└── page.tsx                     308 → /alem-do-espelho-2026
```

### 3.3 Server vs Client Components

- **Server Components (padrão):** páginas, `layout.tsx`, `sitemap.ts`,
  `robots.ts`, `generateMetadata()`.
- **Client Components (`"use client"`):** tudo com interatividade — Hero,
  Header, Countdown, WaitlistForm, WaitlistModal, modais, Footer, Reveal,
  MotionProvider, EventoPage e ListaEsperaPage (orquestração de estado do modal).

O `layout.tsx` é Server Component; o skip-link "Saltar para a inscrição" abre o
modal da página através de um **registo global** (`src/lib/modal.ts`), porque o
layout não tem acesso ao estado da página.

---

## 4. Design System

### 4.1 Paleta (tokens Tailwind v4 em `@theme`)

| Token | Hex | Papel |
|---|---|---|
| `--color-creme` | `#f5f0e8` | Fundo principal, texto sobre escuro |
| `--color-creme-profundo` | `#efe8dc` | Variação de fundo |
| `--color-blush` | `#f2cdba` | Destaques, itálicos do display |
| `--color-rosa` | `#c47e8a` | Botões, eyebrows, acentos |
| `--color-rosa-escuro` | `#ad6672` | Hover dos botões |
| `--color-sage` | `#657365` | Faixa da missão social |
| `--color-musgo` | `#3d4a40` | Hero, fundos escuros |
| `--color-vinho` | `#5c323e` | Títulos display, modais |
| `--color-vinho-claro` | `#6b3a48` | Variação do vinho |
| `--color-carvao` | `#2e3a33` | Hero, rodapé, texto de corpo |
| `--color-dourado` | `#d4af37` | Detalhes premium |
| `--color-dourado-claro` | `#e0c878` | Eyebrows sobre escuro |

> Nota: o README registava a rosa como `#BA7984` e a vinho como `#5A323A`; o
> estado atual do `globals.css` usa `#c47e8a` e `#5c323e`. O token em CSS é a
> fonte da verdade.

### 4.2 Tipografia

- **Recline** (display) — fonte oficial da marca, OTF→WOFF2 self-hosted,
  pesos 300–600 + itálico. Usada com `.display` (Light 300, `line-height 0.95`,
  `letter-spacing -0.02em`).
- **Jost** (corpo/UI) — geométrica utilitária, self-hosted (300–600 + variable),
  a mais próxima da "Now" dos materiais oficiais.

### 4.3 Elementos-assinatura

- **`.espelho`** — painel de vidro fosco com reflexo diagonal (reconstrução em
  CSS da key art). É o cartaz do hero e a moldura do formulário.
- **`.fio`** — linha ornamental fina com gradiente, separa secções.
- **`.grao`** — grão de papel sutil em `mix-blend-mode: multiply`.
- **`.eyebrow`** — etiqueta em versalete espaçado (`0.6875rem`, `0.32em`).
- **`.campo`** — inputs do formulário com foco em blush e estado `aria-invalid`.
- **Modais top-alinhados** — `modal-overlay-top` força `align-items: flex-start`
  (classe anti-regressão; documentada no CSS).

### 4.4 Acessibilidade (padrão do projeto)

- HTML semântico; botões reais (`<button>`), nunca `<div onClick>`.
- Alvo de toque mínimo **44×44px** (ex.: botão fechar do modal `h-11 w-11`).
- Foco visível (`:focus-visible` rosa) em todo elemento interativo.
- `aria-live` para erros de formulário, `role="dialog"`/`aria-modal` no modal,
  `aria-invalid` + `aria-describedby` nos campos com erro.
- **Focus trap** no modal (Tab circular) + devolução do foco ao abridor.
- Trava de scroll do fundo compensando a largura da barra (sem salto de layout).
- **`prefers-reduced-motion`**: animações e transições reduzidas a ~0.
- Skip-link "Saltar para a inscrição" (chama o modal global).
- Teclado: `Escape` fecha modais; `enterKeyHint` configurado nos inputs.

---

## 5. Componentes (inventário completo)

### Composição de páginas

| Página | Componente orquestrador | Secções |
|---|---|---|
| `/alem-do-espelho-2026` | `EventoPage.tsx` | Header + Hero + Experience + Anfitria + Gallery + Realizacao + Footer + WaitlistModal |
| `/alem-do-espelho-2026/lista` | `ListaEsperaPage.tsx` | Header + ListaEsperaHero + Experience + Anfitria + Gallery + Realizacao + Footer + WaitlistModal |

**Reutilização deliberada:** as duas páginas partilham Experience, Anfitria,
Gallery, Realizacao, Header e Footer. A única diferença é o Hero (lista vs
evento) — tudo via modal, sem formulário inline.

### Inventário (29 ficheiros `.tsx`)

| Componente | Papel | Client? |
|---|---|---|
| `EventoPage` | Landing do evento (orquestra modal + registo global) | ✓ |
| `ListaEsperaPage` | Lista de espera (mesma lógica) | ✓ |
| `ListaEsperaHero` | Hero pré-corte (lista de espera) | ✓ |
| `Header` | Fixo, encolhe ao rolar, menu mobile, data/local + CTA | ✓ |
| `Hero` | Cartaz oficial no painel `.espelho` + countdown + CTA | ✓ |
| `Countdown` | Contagem (default: fecho da lista; alvo customizável; tom claro/escuro) | ✓ |
| `Experience` | "O que vais viver" — manifesto + 4 diferenciais com ícones | — |
| `Anfitria` | Retrato com moldura de espelho + frase da anfitriã | — |
| `Gallery` | Galeria de imagens (inclui grupo.webp, "Editora Florecer", "Algumas") | — |
| `Realizacao` | "Quem faz acontecer" — missão Portugal/Angola + entidades + patrocínio | — |
| `Footer` | Contactos, legal (modais), marca Essence, barra única | ✓ |
| `WaitlistModal` | Modal de inscrição (porta ao body, focus trap, 2 colunas) | ✓ |
| `WaitlistForm` | Formulário + ecrã de confirmação (variantes waitlist/sponsor) | ✓ |
| `SponsorFlow` | Fluxo "Quero Patrocinar" → formulário → sucesso → WhatsApp | ✓ |
| `Modal` | Modal genérico reutilizável | ✓ |
| `TermosModal` / `PrivacidadeModal` | Conteúdo legal em modal | ✓ |
| `Reveal` | Animação de entrada no scroll (Framer Motion `whileInView`) | ✓ |
| `MotionProvider` | Provider global de motion | ✓ |
| `SaltarParaInscricao` | Skip-link do layout → abre modal global | ✓ |
| `icons/index` | Ícones próprios (Instagram, Mail, WhatsApp) | — |

### O formulário (WaitlistForm) — o coração do produto

- Validação **cliente + servidor** (mesmo esquema Zod partilhado).
- Campos: nome completo (exige nome + apelido, Unicode-aware), email, telemóvel
  com seletor de **10 indicativos** (PT, BR, AO, ES, FR, GB, CH, LU, DE, CV),
  consentimento RGPD, honeypot invisível.
- Erros exibidos ao sair do campo ("touched"), foco movido para o primeiro
  campo inválido.
- Estado: `inativo → a-enviar → sucesso | erro`, com `aria-live`.
- Ecrã de sucesso: posição na lista, texto "Já estavas connosco" (idempotência),
  CTA "Convidar por WhatsApp" com mensagem pré-preenchida.
- Recolhe **UTMs**, locale, referrer e user-agent (atribuição de campanhas).
- Variante **sponsor**: mesmo payload → `/api/sponsor` → sucesso abre WhatsApp
  com a Vitória.

---

## 6. Backend

### 6.1 Supabase (Postgres)

Tabela `waitlist_subscribers` (migração versionada em
`supabase/migrations/0001_waitlist.sql`):

- Colunas: id (uuid), full_name, email (`citext`), phone, phone_country, status
  (`pending/confirmed/unsubscribed`), consent, locale, source, utm_* (5 colunas),
  referrer, user_agent, ip_hash, created_at, updated_at.
- **CHECK constraints** no nome, email e telefone (`^\+[1-9][0-9]{6,15}$`).
- **Índices:** único no email (`citext`), created_at desc, status.
- **Trigger** `set_updated_at` no update.
- **RLS ativo, zero policies públicas** — nem com a chave de cliente alguém lê
  a tabela.
- **`join_waitlist()`** — função `SECURITY DEFINER`, única superfície de escrita:
  normaliza/valida, **deduplica por email** (update + retorno
  `already_registered`), devolve `{ status, position }`. Reactiva
  `unsubscribed` → `pending`.
- **`waitlist_count()`** — contagem pública sem expor dados pessoais.
- A **service role key nunca sai do painel Supabase** — a API usa
  `SUPABASE_PUBLISHABLE_KEY` (anon) e só chama funções RPC.

### 6.2 API Routes

**`POST /api/waitlist`** (`runtime=nodejs`, `force-dynamic`, `preferredRegion=["cdg1"]`):
1. Rate limit por IP (5/min) → `429` + `Retry-After`.
2. Parse JSON com try/catch → `400`.
3. Validação Zod → `422` com `campos` por campo.
4. Anti-bot: honeypot preenchido ou `elapsedMs < 2500ms` → `400` genérico.
5. Telefone: `libphonenumber-js` valida contra regras reais do país e
   converte para **E.164**; exige MOBILE/FIXED_LINE_OR_MOBILE.
6. `supabase.rpc("join_waitlist", ...)` com todos os metadados.
   - Erros mapeados: `invalid_email`/`invalid_phone`/`invalid_full_name` → `422`
     com mensagem em português.
   - Sucesso: `201` (created) ou `200` (already_registered) + posição.
   - **Região:** função deployada junto da base (Supabase em Paris/cdg1) — dados
     pessoais tratados na UE.

**`POST /api/sponsor`** — reutiliza validação e anti-bot do waitlist. Persistência
ainda é **log com email mascarado** (`m•••@domínio`, RGPD). Documentado o ponto
exato de troca para insert quando a tabela existir.

### 6.3 Pipeline de proteção (camadas, em ordem)

| Camada | O que faz |
|---|---|
| Cliente | Valida nome/email/telefone antes de submeter |
| Rate limit | 5 tentativas por IP por minuto (janela fixa em memória) |
| Honeypot | Campo invisível — se preenchido, é robô |
| Tempo mínimo | Submissões < 2,5 s rejeitadas |
| Zod | Valida e normaliza o formato de tudo |
| libphonenumber | Valida o telefone real por país → E.164 |
| Postgres | CHECK constraints + índice único no email + RPC SECURITY DEFINER |

**Decisões RGPD relevantes:**
- IP guardado **apenas como hash** (SHA-256 + salt, truncado a 32 hex).
- Zero pedidos a Google Fonts (sem transferência de IPs para fora da UE).
- Consentimento obrigatório no formulário.
- Emails de sponsor mascarados nos logs.

---

## 7. SEO & Metadata

### 7.1 Domínio canónico

- **Primário:** `https://essenceofbeautysalon.com` — apontado por canonical, OG,
  sitemap e robots.
- **Secundário:** `alemdoespelho2026.com` (nunca canónico).
- `NEXT_PUBLIC_SITE_URL` sobrescreve; sem ela, o default em `site.ts` é
  `essenceofbeautysalon.com`. Nos previews `*.vercel.app` o canonical continua a
  resolver para o domínio canónico (evita conteúdo duplicado).

### 7.2 Metadata (layout + generateMetadata por rota)

- `metadataBase`, título com template `%s | Além do Espelho`, descrição,
  keywords, authors (Vitória Gomes).
- Open Graph + Twitter card (`summary_large_image`) com `/og-image.jpg`
  (1200×630).
- **JSON-LD `Event`** (Schema.org) no layout: nome, data, local (Place +
  PostalAddress), organizador (Essence of Beauty), performer (Vitória Gomes),
  evento presencial.
- Por rota, `generateMetadata()` define título absoluto, canonical **fase-aware**
  e robots index/follow.

### 7.3 Sitemap & robots

- `sitemap.ts` — **fase-aware** (`force-dynamic`, `revalidate=0`): lista apenas
  a rota ativa no momento (lista pré-corte / evento pós-corte).
- `robots.ts` — allow all + sitemap no domínio canónico.

---

## 8. Segurança

| Medida | Onde |
|---|---|
| `X-Content-Type-Options: nosniff` | headers globais (next.config.ts) |
| `X-Frame-Options: SAMEORIGIN` | idem |
| `Referrer-Policy: strict-origin-when-cross-origin` | idem |
| `Permissions-Policy` camera/mic/geo proibidos | idem |
| `Cache-Control` imutável (1 ano) nas fonts | headers `/fonts/:path*` |
| `poweredByHeader: false`, `compress: true`, `reactStrictMode` | next.config.ts |
| Fonts self-hosted | sem dependência externa de terceiros |
| RLS + nenhuma policy pública | tabela Supabase |
| Service role key nunca no bundle | cliente usa anon/publishable |
| Rate limit + honeypot + tempo mínimo | API routes |
| IP só como hash | rate-limit.ts |
| `preferredRegion=["cdg1"]` | tratamento de dados na UE |

---

## 9. Deploy & Git

### 9.1 Fluxo de deploy (Vercel + GitHub)

- **Integração GitHub:** branch → preview automático; `main` → produção.
- **Estratégia de release:** fast-forward (`--ff-only`) da branch de preview
  para `main` + push → Vercel auto-deploy em produção.
- **Tag de segurança:** `backup/main-vite-pre-cutover` marca o último estado
  Vite pré-cutover (o projeto migrou de Vite para Next.js na linha do tempo).
- **Vercel project:** `prj_fRmldSAKmcHeujOt3Ad1qWZjTTfl` (team
  `team_NaRYnRvQ3ZeFIbHuCgNmmn8R`).
- `vercel.json` mínimo: `{ "framework": "nextjs" }`.

### 9.2 Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
IP_HASH_SALT=<string longa aleatória>
NEXT_PUBLIC_SITE_URL=https://essenceofbeautysalon.com
```

`.env.example` versionado; `.env.local` ignorado.

### 9.3 Estado Git atual (05/08/2026)

- **Branches:** `main` (produção) · `preview/8-mudancas` · `feature/lista-de-espera-preview` · `docs/ai-memory`.
- **48 commits** em `main`.
- **`main` = produção** contém as 8 mudanças de copy/imagem (commit
  `c8005fc` "feat(copy): 8 mudanças de copy e imagem para revisão do cliente"),
  já verificadas nos 3 breakpoints.

### 9.4 As 8 mudanças de copy/imagem (todas em produção)

1. **Hero** — h1 em 4 linhas com "Além de Mim!" em itálico blush.
2. **Anfitria** — "MUNDO" com acento rosa + `whitespace-nowrap`.
3. **Experience** — texto de fecho movido para o fim da secção.
4. **Realizacao** — cabeçalho de marca "Além do Espelho 2026:" + missão
   Portugal/Angola separada.
5. **Footer** — links "Instagram" → "Vitória Gomes".
6. **Gallery** — nova imagem `grupo.webp` + "Editora Florecer" + "Algumas".
7. Novo asset `public/brand/grupo.webp` (conversão de grupo.jpg via sharp,
   1079×720, ~31 KB).

---

## 10. QA & Verificação

### 10.1 Portões de validação (obrigatórios)

1. `tsc --noEmit` — zero erros. ✓
2. `eslint .` — **não aplicável** (sem ESLint configurado; documentado).
3. `next build` — passa. ✓

### 10.2 Scripts de QA (em `scripts/`)

- `modal-qa.mjs` — smoke test do modal.
- `check-inscricao.mjs` — smoke test da inscrição.
- `smoke-cutover.mjs` — smoke test do sistema de virada (headers
  `x-cutover-test`).
- `test-lista-modal.mjs` — smoke test do modal na lista.

### 10.3 Verificação visual (Playwright) — completa

| Breakpoint | Status | Cobertura |
|---|---|---|
| Desktop 1280×900 | ✅ | Screenshot full-page; as 8 mudanças confirmadas |
| Tablet 768×1024 | ✅ | Idem |
| Mobile 390×844 | ✅ | Idem (scroll full 9258px para lazy-load) |

- Produção `essenceofbeautysalon.com` verificado nos 3 breakpoints.
- Preview Vercel (branch `preview/8-mudancas`) verificado via `web_fetch_vercel_url`
  (autenticado com SSO).

### 10.4 Pendências documentadas no README

- A gravação real no Supabase originalmente não testada em rede — o tratamento de
  erro (502 amigável) foi validado. Primeira ação pós-deploy: submeter 1 vez e
  confirmar linha na tabela.

---

## 11. Assets (public/)

- **Brand:** keyart, keyart-sm, logos (offwhite, bege, verde, rosa), essence,
  atos, conexao (+tiles/branco), bandeira, vitoria, vitoria-sentada, autoras,
  edicao-1, grupo, ecobag, mulheres.
- **Fonts:** Recline (Light/Regular/Italic/Medium/SemiBold) + Jost (300–600 +
  variable) — WOFF2.
- **Logo Essence:** múltiplas variações (papel, rose, marsala, monogramas).
- **Ícones:** whatsapp.svg, instagram.svg, mail.svg.
- **Imagens de pagamento (documentação):** mbway, transferência.
- **PDF:** dossiê do projeto "Além de Mim!".
- **SEO:** og-image.jpg (1200×630), icon.png, favicon-512.
- Diretórios auxiliares com histórico de otimização: `fotos-otimizadas/`,
  `logos-transparentes/`, `assets-final/`, `logos-v2/`, `assets-realizacao/`.

---

## 12. Documentação (docs/)

- **`docs/ai-memory/`** — base de conhecimento do frontend: playbook de landing
  pages enterprise, modal-patterns, footer-patterns, responsive-rules,
  seo-checklist, release-checklist, decision-log, error-catalog.
- **`docs/ai-memory-backend/`** — base do backend: api-standards,
  data-integrity-patterns, security-patterns, observability-playbook,
  performance-checklist, release-checklist, error-catalog, decision-log,
  templates (postmortem, prompt).
- **`docs/ai-memory/landing-enterprise-frontend-backend-ultra-master.md`** —
  consolidação master do playbook enterprise (FE+BE+Ultra).

---

## 13. Estado Atual & Próximos Passos

**Hoje (05/08/2026):** o corte já passou (03/08 10:00). A rota ativa é
**`/alem-do-espelho-2026`** (landing do evento); `/alem-do-espelho-2026/lista`
redireciona 308 para ela. Tudo verificado em produção nos 3 breakpoints.

**Próximos passos naturais (do README):**
1. Adicionar **programação, oradoras e bilheteira** à versão do evento.
2. **Persistência de leads de patrocínio** (criar tabela e trocar o `console.info`
   do `/api/sponsor` por um insert).
3. Continuar o crescimento da lista → usar os dados para alimentar as comunicações
   de abertura das inscrições.

---

## 14. Ficha técnica rápida (para o Claude.ia)

- **Repositório:** `github.com/Lukasuuu/alem-do-espelho-2026` (privado).
- **Produção:** `https://essenceofbeautysalon.com` (+ alemdoespelho2026.com).
- **Fonte única de conteúdo:** `src/lib/site.ts` (textos, datas, países, corte).
- **Fonte única de tokens:** `src/app/globals.css` (`@theme`).
- **Backend:** Supabase `qtiyxibqeignvsnfhzpw` — migração versionada em
  `supabase/migrations/0001_waitlist.sql`.
- **Virada automática:** `CORTE_ESPERA_ISO` + gate `isDepoisDoCorte()`.
- **Comandos:** `npm run dev` · `npm run typecheck` · `npm run build` · `npm start`.
