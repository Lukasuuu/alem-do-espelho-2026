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
 *
 * HYDRATION: usa montado para evitar mismatch entre servidor (useReducedMotion = false)
 * e client (valor real). Server e primeiro render do client produzem HTML idêntico.
 */
export default function Reveal({ children, delay = 0, className, as = "div" }: Props) {
  const Componente = motion[as];

  // Estado para evitar hydration mismatch — só renderiza motion após montar no client.
  const [montado, setMontado] = useState(false);
  const [reduzido, setReduzido] = useState(false);
  const [visivel, setVisivel] = useState(false);

  // 1) Marcar como montado + detetar preferência de movimento.
  useEffect(() => {
    setMontado(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzido(mq.matches);
    setVisivel(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      setReduzido(e.matches);
      if (e.matches) setVisivel(true);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 2) Fail-safe: tornar visível após 1,5s mesmo sem scroll.
  useEffect(() => {
    if (reduzido) return;
    const t = setTimeout(() => setVisivel(true), 1500);
    return () => clearTimeout(t);
  }, [reduzido]);

  // Fallback idêntico server/first-client render — evita hydration flash.
  if (!montado) {
    const Tag = as === "li" ? "li" : as;
    return <Tag className={className}>{children}</Tag>;
  }

  // prefers-reduced-motion: conteúdo estático sem animação.
  if (reduzido) {
    const Tag = as === "li" ? "li" : as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <Componente
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={visivel ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Componente>
  );
}
