/**
 * Trava o scroll do body com contador de referências.
 *
 * Ao contrário de mexer diretamente no body a cada modal, aqui cada modal que
 * abre chama `travarScroll()` e cada um que fecha chama `destravarScroll()`.
 * O scroll só destrava quando TODOS os modais fecharem — permite empilhar
 * modais (ex. formulário + pagamento) sem um fechar desbloquear por cima do
 * outro. Compensa a barra de scroll para não haver salto de layout.
 */

let referencias = 0;
let paddingAnterior = "";

export function travarScroll() {
  if (referencias === 0) {
    const larguraScroll = window.innerWidth - document.documentElement.clientWidth;
    paddingAnterior = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (larguraScroll > 0) document.body.style.paddingRight = `${larguraScroll}px`;
  }
  referencias += 1;
}

export function destravarScroll() {
  referencias = Math.max(0, referencias - 1);
  if (referencias === 0) {
    document.body.style.overflow = "";
    document.body.style.paddingRight = paddingAnterior;
  }
}
