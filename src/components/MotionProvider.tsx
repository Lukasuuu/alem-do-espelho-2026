"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Centraliza a política de movimento da aplicação.
 *
 * `reducedMotion="user"` faz o Framer Motion respeitar
 * prefers-reduced-motion automaticamente: as transformações (x, y, scale,
 * rotate) são ignoradas e apenas a opacidade anima. Como a decisão é tomada
 * no cliente após a hidratação, o HTML do servidor mantém-se estável, que é
 * precisamente o que evita o mismatch.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
