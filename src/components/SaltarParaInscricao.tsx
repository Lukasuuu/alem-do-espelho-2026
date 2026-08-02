"use client";

import { abrirModalGlobal } from "@/lib/modal";

/**
 * Skip-link do layout: o destino "inscrição" já não é uma âncora (#inscricao
 * foi removida), é o modal de inscrição. Abrir e focar o primeiro campo.
 */
export default function SaltarParaInscricao() {
  return (
    <button
      onClick={abrirModalGlobal}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-rosa focus:px-5 focus:py-3 focus:text-sm focus:text-creme"
    >
      Saltar para a inscrição
    </button>
  );
}
