# SEO Checklist (técnico) — por página de evento

> Gates de SEO validados 18/18 no preview do projecto. Aplicar a **toda** página de evento/landing.

## Por página

- [ ] **`<title>` orientado a intenção** (evento + valor + data/edição).
- [ ] **`<meta name="description">`** com proposta de valor + CTA.
- [ ] **`<link rel="canonical">` absoluto correcto** — domínio canónico único (`site.url`), nunca relativo.
- [ ] **Open Graph completo**: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:site_name`, `og:locale`.
- [ ] **Twitter card configurado**: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`.
- [ ] **Semântica de headings consistente** — 1×`h1` por página, hierarquia `h2`→`h3` sem saltos.
- [ ] **Revisão de links internos** relevantes (CTAs, ancoras, rotas activas).

## Por sítio

- [ ] **Sitemap dinâmico e fase-aware** — só a rota activa (`/lista` pré-corte, `/evento` pós-corte). Nunca indexar 2 versões.
- [ ] **robots.txt** → `Sitemap: {site.url}/sitemap.xml`.
- [ ] **Rotas legacy sempre 308** (`/`, `/lista`, `/lista-de-espera`) — nunca 200 duplicado.
- [ ] **Canonical/OG/sitemap/robots** todos no mesmo domínio canónico.

## Anti-cache e fase

- [ ] Rotas de cutover `force-dynamic` + `revalidate=0` + `Cache-Control: no-store` (virada no minuto).
- [ ] Header `x-cutover-test: before|after` só para preview; **ignorado em produção**.
- [ ] Verificar `robots: index, follow` na rota activa.

## Validação

- `node scripts/smoke-cutover.mjs <URL>` — redirects, `no-store`, sitemap exacto (1 loc, `endsWith`).
- Fetch ao HTML: conferir `<title>`, `description`, `canonical`, `og:*`, `twitter:*`, headings.
