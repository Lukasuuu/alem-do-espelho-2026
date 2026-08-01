"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Título do modal — usado como aria-labelledby. */
  titulo: string;
  children: React.ReactNode;
  /** vinho (escuro, para o formulário) ou claro (para leitura de texto legal). */
  tom?: "vinho" | "claro";
  /** Largura máxima do painel. */
  larguraMax?: string;
};

/** Elementos focáveis dentro do painel — para o foco circular (trap). */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(
    raiz.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Shell de modal acessível e reutilizável: portal, trap de foco, ESC, clique
 * fora, aria-modal e trava de scroll com compensação da barra. Os modais
 * legais e o fluxo de patrocínio usam este mesmo componente.
 */
export default function Modal({
  aberto,
  fechar,
  titulo,
  children,
  tom = "vinho",
  larguraMax = "40rem",
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [montado, setMontado] = useState(false);
  const tituloId = useId();

  // createPortal ao <body> — só depois de o cliente montar.
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberto) return;

    const abridor = document.activeElement as HTMLElement;

    // Trava o scroll do fundo compensando a barra (sem salto de layout).
    const larguraScroll = window.innerWidth - document.documentElement.clientWidth;
    const paddingAnterior = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (larguraScroll > 0) document.body.style.paddingRight = `${larguraScroll}px`;

    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fechar();
        return;
      }
      if (e.key === "Tab" && painelRef.current) {
        const lista = focaveis(painelRef.current);
        if (lista.length === 0) return;
        const primeiro = lista[0];
        const ultimo = lista[lista.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };

    document.addEventListener("keydown", aoTecla);

    // Foco no primeiro elemento focável do painel ao abrir.
    const t = window.setTimeout(() => {
      painelRef.current
        ?.querySelector<HTMLElement>("button:not([disabled]), a[href]")
        ?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", aoTecla);
      window.clearTimeout(t);
      document.body.style.overflow = "";
      document.body.style.paddingRight = paddingAnterior;
      abridor?.focus();
    };
  }, [aberto, fechar]);

  function aoClicarFora(e: React.MouseEvent) {
    if (e.target === overlayRef.current) fechar();
  }

  const claro = tom === "claro";

  const dialogo = (
    <AnimatePresence>
      {aberto && (
        <motion.div
          ref={overlayRef}
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={aoClicarFora}
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
        >
          <motion.div
            ref={painelRef}
            className="modal-content"
            style={{ maxWidth: larguraMax }}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`relative overflow-hidden rounded-sm ${
                claro ? "bg-creme" : "bg-vinho"
              }`}
            >
              {/* Glow decorativo (só no tom escuro) */}
              {!claro && (
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <div className="absolute -top-1/3 left-1/4 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(242,205,186,0.15),transparent_62%)] blur-3xl" />
                  <div className="absolute -bottom-1/3 right-0 h-[25rem] w-[25rem] rounded-full bg-[radial-gradient(circle,rgba(196,126,138,0.20),transparent_62%)] blur-3xl" />
                </div>
              )}

              {/* Botão fechar — alvo de toque ≥ 44×44 */}
              <button
                onClick={fechar}
                aria-label="Fechar"
                className={`absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                  claro
                    ? "border-vinho/20 text-vinho/50 hover:border-vinho/40 hover:text-vinho/80"
                    : "border-creme/20 text-creme/50 hover:border-creme/40 hover:text-creme/80"
                }`}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative px-6 py-10 sm:px-9 sm:py-12">
                <h2
                  id={tituloId}
                  className={`display pr-10 text-[1.75rem] leading-[1.05] sm:text-[2rem] ${
                    claro ? "text-vinho" : "text-creme"
                  }`}
                >
                  {titulo}
                </h2>
                <div className={claro ? "text-carvao/75" : "text-creme/70"}>{children}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return montado ? createPortal(dialogo, document.body) : null;
}
