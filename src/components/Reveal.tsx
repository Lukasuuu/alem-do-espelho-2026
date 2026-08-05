"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "header" | "footer";
};

/**
 * Revelação discreta ao entrar no ecrã.
 *
 * - Respeita prefers-reduced-motion: sem movimento, conteúdo aparece já no sítio.
 * - Fail-safe a 1,5 s: se o IntersectionObserver nunca disparar
 *   (ex. SSR sem scroll, browser com problemas), o conteúdo fica visível na mesma.
 */
export default function Reveal({ children, delay = 0, className, as = "div" }: Props) {
  const Componente = motion[as];
  const reduzido = useReducedMotion();
  const [visivel, setVisivel] = useState(reduzido);

  useEffect(() => {
    if (reduzido) return;
    const t = setTimeout(() => setVisivel(true), 1500);
    return () => clearTimeout(t);
  }, [reduzido]);

  return (
    <Componente
      className={className}
      initial={reduzido ? undefined : { opacity: 0, y: 18 }}
      whileInView={visivel ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-80px" }}
      transition={reduzido ? undefined : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Componente>
  );
}
