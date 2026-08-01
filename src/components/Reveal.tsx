"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "header" | "footer";
};

/**
 * Revelação discreta ao entrar no ecrã.
 * Respeita prefers-reduced-motion: sem movimento, o conteúdo aparece já no sítio.
 */
export default function Reveal({ children, delay = 0, className, as = "div" }: Props) {
  const Componente = motion[as];

  return (
    <Componente
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Componente>
  );
}
