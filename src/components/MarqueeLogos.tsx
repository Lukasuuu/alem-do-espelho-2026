"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import AzulejoLogo from "./AzulejoLogo";
import { patrocinadores } from "@/lib/patrocinadores";

/**
 * Faixa de logos em marquee (REESCRITA 3) — movimento infinito SUAVIZADO.
 *
 * O movimento é gerado pela Web Animations API (track.animate): translateX
 * (0 → -50%) linear sobre o bloco duplicado (nº PAR de cópias, calculado para
 * cada metade encher 1920px — volta sem salto). O :hover NÃO trava de forma
 * brusca (animation-play-state: paused): o JS desacelera a playbackRate até 0
 * aos poucos (travão de veludo) e acelera de volta ao sair.
 *
 * O isolamento de foco (logos vizinhos mais apagados/desfocados + revelação
 * 100% do logo sob o cursor) vive em .marquee-foco no globals.css.
 *
 * A11y/WCAG:
 *  - cópias duplicadas com aria-hidden="true" e alt="" (só a 1ª leitura conta);
 *  - prefers-reduced-motion → fila estática centrada, sem animação;
 *  - máscara de fade nas extremidades.
 */
const ALTURA_AZULEJO = 72;
const PADDING_H = 16; // px-4 (igual ao AzulejoLogo)
const GAP = 24; // gap-6
/** Largura mínima de cada metade do track — cobre as telas de QA (1920px). */
const LARGURA_VIEWPORT_MIN = 1920;
/** Teto defensivo de cópias para não explodir o DOM. */
const MAX_COPIAS = 12;
/** Duração de meia-volta (ms) — mesma cadência do CSS anterior (28s ≈ 25s). */
const DURACAO_MS = 25000;
/** Passo de aproximação da velocidade — 0.1 ≈ trava em ~0.4s (60fps). */
const PASSO_VELOCIDADE = 0.1;
/** Tolerância a partir da qual a velocidade é considerada "chegada". */
const TOLERANCIA_VELOCIDADE = 0.05;

function larguraTile(
  logo: (typeof patrocinadores)[number]["logo"]
): number {
  // Proporção real do asset a 72px de altura + padding interno uniforme.
  return Math.ceil((logo.width / logo.height) * ALTURA_AZULEJO) + PADDING_H * 2;
}

/** Nº PAR de cópias até cada metade do track encher a viewport mínima. */
function calcularCopias(): number {
  const bloco = patrocinadores.reduce(
    (soma, p, i) =>
      soma + larguraTile(p.logo) + (i < patrocinadores.length - 1 ? GAP : 0),
    0
  );
  let copias = 2;
  while ((copias / 2) * bloco < LARGURA_VIEWPORT_MIN) copias += 2;
  return Math.min(copias, MAX_COPIAS);
}

export default function MarqueeLogos() {
  // prefers-reduced-motion: sem carrossel nem movimento (fila estática).
  const reduzido = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduzido) return;
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    // Animação infinita via Web Animations API — o CSS já não a controla.
    const animacao = track.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-50%)" },
      ],
      { duration: DURACAO_MS, iterations: Infinity, easing: "linear" }
    );

    let velocidade = 1;
    let temporizador: ReturnType<typeof setInterval> | undefined;

    /** Aproxima a velocidade do objetivo gradualmente (~60fps) — travão de veludo. */
    function suavizarVelocidade(alvo: number) {
      if (temporizador) clearInterval(temporizador);
      temporizador = setInterval(() => {
        if (Math.abs(velocidade - alvo) < TOLERANCIA_VELOCIDADE) {
          velocidade = alvo;
          if (temporizador) clearInterval(temporizador);
          return;
        }
        velocidade += (alvo - velocidade) * PASSO_VELOCIDADE;
        animacao.playbackRate = velocidade;
      }, 16);
    }

    function aoEntrar() {
      suavizarVelocidade(0); // desacelera suavemente até parar
    }
    function aoSair() {
      suavizarVelocidade(1); // acelera suavemente de volta
    }

    container.addEventListener("mouseenter", aoEntrar);
    container.addEventListener("mouseleave", aoSair);

    return () => {
      container.removeEventListener("mouseenter", aoEntrar);
      container.removeEventListener("mouseleave", aoSair);
      if (temporizador) clearInterval(temporizador);
      animacao.cancel();
    };
  }, [reduzido]);

  // prefers-reduced-motion: fila estática centrada (WCAG) — nunca o marquee.
  if (reduzido) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-6">
        {patrocinadores.map((p) => (
          <AzulejoLogo key={p.id} logo={p.logo} flexivel />
        ))}
      </div>
    );
  }

  const copias = calcularCopias();

  return (
    <div
      ref={containerRef}
      className="marquee-foco relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
    >
      <div
        ref={trackRef}
        className="flex w-max items-center gap-6"
        aria-label="Marcas patrocinadores do Além do Espelho"
      >
        {Array.from({ length: copias }).map((_, copia) => (
          <div
            key={copia}
            className="flex items-center gap-6"
            aria-hidden={copia !== 0 || undefined}
          >
            {patrocinadores.map((p) => (
              <AzulejoLogo
                key={`${copia}-${p.id}`}
                logo={p.logo}
                altOculto={copia !== 0}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
