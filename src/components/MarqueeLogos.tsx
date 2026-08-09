"use client";

import { useReducedMotion } from "framer-motion";
import AzulejoLogo from "./AzulejoLogo";
import { patrocinadores } from "@/lib/patrocinadores";

/**
 * Faixa de logos em marquee (REESCRITA) — ativada só com >= 5 patrocinadores.
 *
 * Animação CSS pura (Tailwind 4): `--animate-marquee` + `@keyframes marquee`
 * definidos no @theme, translateX(0 → -50%) linear 28s. O track leva um nº PAR
 * de cópias do bloco de logos, calculado para cada metade encher 1920px — assim
 * o translateX(-50%) devolve o track ao início visual idêntico (volta sem salto).
 * Sem setTimeout nem classList — o projeto usa Framer Motion, reservado aqui
 * para o `useReducedMotion` (fila estática sob prefers-reduced-motion).
 *
 * A11y/WCAG:
 *  - cópias duplicadas com aria-hidden="true" e alt="" (só a 1ª leitura conta);
 *  - pausa no :hover e no :focus-within (WCAG 2.2.2);
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
  const reduzido = useReducedMotion();

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
    <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div
        className="flex w-max animate-marquee items-center gap-6 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
        aria-label="Marcas patrocinadoras do Além do Espelho"
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
