"use client";

import { useEffect } from "react";

/**
 * Ao montar, leva a pessoa ao cartão da vaquinha.
 *
 * Vive separado da página do evento para o efeito existir SÓ nesta rota: quem
 * chega pelo link partilhado (WhatsApp, Instagram) tem de aterrar na causa, não
 * no topo da landing. É scroll de cliente, não um redirect nem uma âncora no
 * URL — as redes sociais seguem redirects e leem os metadados do destino, e
 * voltaria a aparecer a pré-visualização do evento em vez da vaquinha.
 *
 * Com `prefers-reduced-motion` o salto é instantâneo: quem pediu menos movimento
 * não leva com um scroll animado de meio ecrã.
 */
export default function IrParaVaquinha() {
  useEffect(() => {
    const alvo = document.getElementById("vaquinha");
    if (!alvo) return;
    const semMovimento =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Espera um frame para o layout assentar (imagens com dimensões explícitas
    // já reservam o espaço, mas a hidratação pode ainda estar a decorrer).
    const id = window.requestAnimationFrame(() => {
      alvo.scrollIntoView({ behavior: semMovimento ? "auto" : "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return null;
}
