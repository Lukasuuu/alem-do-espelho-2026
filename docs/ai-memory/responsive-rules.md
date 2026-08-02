# Regras de Responsividade

> Regras validadas no QA de 4 viewports (mobile 390, tablet 768, notebook 1280, desktop 1536).
> Mobile-first: `min-width` nas media queries.

## Breakpoints reais usados

| Faixa | Viewport QA | Comportamento |
|---|---|---|
| Mobile | 390×844 | Stack vertical; modal top-alinhada; footer em coluna |
| Tablet | 768×1024 | Grids intermédios; alvo de toque ok |
| Notebook | 1280×800 | Layout completo; sem overflow |
| Desktop | 1536×864 | Layout completo |

## Regras inegociáveis

1. **Mobile-first** — estilos base para mobile, media queries com `min-width`.
2. **Zero overflow horizontal** em qualquer breakpoint (detectado no QA de modais e footer).
3. **Imagem com dimensões explícitas** — layout shift é bug.
4. **Alvo de toque ≥ 44×44px** em elementos interativos.
5. **Animação só em `transform`/`opacity`** — nunca `width`/`height`/`top`/`left`.
6. **Contraste ≥ 4.5:1** em texto de corpo.
7. **Respeitar `prefers-reduced-motion`**.
8. **CSS com design tokens**, nunca valor mágico (escala tipográfica e espaçamento definidas).

## Padrão de modal responsivo

- `--topo-modal: clamp(1.25rem, 5vh, 3.5rem)` — espaçamento ao topo proporcional ao viewport.
- `max-height: calc(100vh - …)` fallback + `calc(100dvh - …)` progressivo + `overflow-y: auto` (ver E-001).
- Overlay `align-items:flex-start` (classe `.modal-overlay-top`) — top-alinhada em mobile.

## Validação

- `scripts/modal-qa.mjs` mede `top`, `height`, `maxHeight`, `overflowY` em cada viewport e falha se o painel estourar.
- Check visual manual por breakpoint: texto sem corte, grids sem quebra, CTA visível sem scroll extra.
