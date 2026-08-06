"use client";

import { forwardRef } from "react";

type Props = {
  children: React.ReactNode;
  /** full = padding generoso + dots nos cantos; compact = reduzido, sem dots. */
  variante?: "full" | "compact";
  className?: string;
};

/**
 * Moldura ornamental SVG à volta do conteúdo.
 *
 * - `full`: padding generoso, 4 dots de canto (causa-pessego), stroke animado.
 * - `compact`: padding reduzido, sem dots, stroke imediato (modais).
 * - Desktop: stroke animado via `strokeDashoffset` + dots fade-in pós-stroke.
 * - Mobile: sem dots, sem animação de stroke (apenas borda estática).
 * - `aria-hidden` — puramente decorativa.
 * - `vector-effect="non-scaling-stroke"` mantém espessura uniforme 2px
 *   independentemente do tamanho real do container.
 */
const MolduraEspelho = forwardRef<HTMLDivElement, Props>(
  function MolduraEspelho({ children, variante = "full", className = "" }, ref) {
    const compacto = variante === "compact";

    return (
      <div ref={ref} className={`relative ${className}`}>
        {/* ── SVG ornamental — desktop only ── */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
          fill="none"
        >
          <rect
            x="1"
            y="1"
            width="398"
            height="298"
            rx="3"
            stroke="var(--color-causa-tinta-suave)"
            strokeOpacity="0.8"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            pathLength="1"
            strokeDasharray="1"
            className="causa-moldura-stroke"
          />
        </svg>

        {/* ── Pontos de canto — desktop, full only ── */}
        {!compacto && (
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
            <span className="causa-dot absolute left-[7px] top-[7px] h-[3px] w-[3px] rounded-full bg-causa-pessego opacity-0" />
            <span className="causa-dot absolute right-[7px] top-[7px] h-[3px] w-[3px] rounded-full bg-causa-pessego opacity-0" />
            <span className="causa-dot absolute bottom-[7px] left-[7px] h-[3px] w-[3px] rounded-full bg-causa-pessego opacity-0" />
            <span className="causa-dot absolute bottom-[7px] right-[7px] h-[3px] w-[3px] rounded-full bg-causa-pessego opacity-0" />
          </div>
        )}

        {children}
      </div>
    );
  }
);

export default MolduraEspelho;
