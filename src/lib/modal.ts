/**
 * Registo global da função que abre o modal de inscrição.
 * A página regista a função (define-a) e o skip-link do layout chama-a,
 * porque o layout é Server Component e não tem acesso ao estado da página.
 */

let abrir: (() => void) | null = null;

export function definirAberturaModal(fn: (() => void) | null) {
  abrir = fn;
}

/** Abre o modal de inscrição — usado pelo atalho "Saltar para a inscrição". */
export function abrirModalGlobal() {
  abrir?.();
}
