"use client";

import { abrirModalGlobal } from "@/lib/modal";

/**
 * Skip-link do layout: o destino "inscrição" já não é uma âncora (#inscricao
 * foi removida), é o modal de inscrição. Abrir e focar o primeiro campo.
 *
 * D7: com as inscrições fechadas (`paraVaquinha`, decidido no SERVIDOR pelo
 * layout), passa a ser um link para a âncora do cartão da vaquinha — que é o que
 * passou a haver para fazer na página. Âncora simples, sem JavaScript: a
 * rolagem suave já vem do `scroll-behavior: smooth` global.
 */
type Props = { paraVaquinha?: boolean };

export default function SaltarParaInscricao({ paraVaquinha = false }: Props) {
  if (paraVaquinha) {
    return (
      <a
        href="#vaquinha"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-rosa focus:px-5 focus:py-3 focus:text-sm focus:text-creme"
      >
        Saltar para a vaquinha
      </a>
    );
  }

  return (
    <button
      onClick={abrirModalGlobal}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-rosa focus:px-5 focus:py-3 focus:text-sm focus:text-creme"
    >
      Saltar para a inscrição
    </button>
  );
}
