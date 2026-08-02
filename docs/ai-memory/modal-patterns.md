# Padrão de Modal Acessível (validado 20/20 QA)

> Padrão **reutilizável** de modal da landing. Validado em 4 viewports (mobile/tablet/notebook/desktop)
> com `scripts/modal-qa.mjs` e `scripts/test-lista-modal.mjs` — 0 console errors, foco/ESC/clique-fora OK.

## Componentes

- `src/components/Modal.tsx` — modal genérico acessível (base).
- `src/components/WaitlistModal.tsx` — modal de inscrição (usa `Modal` + `WaitlistForm`).
- `src/components/SponsorFlow.tsx` — botão + modal de patrocínio (form variant `sponsor` + modal de sucesso + WhatsApp).
- `src/lib/modal.ts` — `definirAberturaModal` / `abrirModalGlobal` (callback global para o skip-link do layout).

## Comportamento obrigatório (gates)

1. **Abre ao clicar no CTA** — nunca scroll inline para um form inexistente.
2. **Fecha com ESC** — `keydown` no overlay.
3. **Fecha com clique fora** — clique no overlay (não no painel).
4. **Trap de foco** — Tab circula dentro do painel; foco volta ao gatilho ao fechar.
5. **`aria-modal="true"`, `role="dialog"`, `aria-labelledby`** — leitor de ecrã.
6. **Scroll lock** no body enquanto aberta.
7. **Zero overflow horizontal**; painel nunca estoura o viewport.

## CSS anti-regressão (regra partilhada no globals.css)

- `.modal-overlay-top` aplicado **nos componentes** (Modal.tsx e WaitlistModal.tsx), com `align-items:flex-start` dominante + `justify-content:center` — impossível regressar para center.
- `--topo-modal: clamp(1.25rem, 5vh, 3.5rem)` responsivo.
- **`max-height` com fallback `100vh` antes de `100dvh`** + `overflow-y: auto` (ver E-001).

```css
.modal-overlay,
.modal-overlay-top {
  align-items: flex-start;      /* top-alinhado por intenção explícita */
  justify-content: center;
  padding: var(--topo-modal) 1rem 1rem;
}
.modal-content {
  max-height: calc(100vh - var(--topo-modal) - 1rem);  /* fallback obrigatório */
  max-height: calc(100dvh - var(--topo-modal) - 1rem); /* progressivo */
  overflow-y: auto;
}
```

## Padrão de estado React

```tsx
const [modalAberto, setModalAberto] = useState(false);
const abrirModal = useCallback(() => setModalAberto(true), []);
useEffect(() => {
  definirAberturaModal(abrirModal);        // liga o skip-link do layout
  return () => definirAberturaModal(null);
}, [abrirModal]);
// ...
<WaitlistModal aberto={modalAberto} fechar={() => setModalAberto(false)} />
```

## Validação (testes de regressão mínimos)

- `node scripts/test-lista-modal.mjs <URL>` — CTA abre modal, ESC fecha, classe top, `align-items`, console errors, desktop+mobile.
- `node scripts/modal-qa.mjs <URL>` — 4 modais × 4 viewports + foco/ESC/clique-fora/overflow.

## Regras preventivas

- **Um** componente de modal por página — nunca duplicar formulário/modal (ver D-003).
- Intenção visual crítica explícita como classe (`.modal-overlay-top`), nunca só padding implícito.
- Nunca mexer na regra partilhada de `.modal-overlay` num só componente.
- Qualquer CTA de inscrição dispara a **mesma** callback de abertura.
