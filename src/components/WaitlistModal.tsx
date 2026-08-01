"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Gift } from "lucide-react";
import { useEffect, useRef } from "react";
import WaitlistForm from "./WaitlistForm";
import Countdown from "./Countdown";
import { site } from "@/lib/site";

type Props = {
  aberto: boolean;
  fechar: () => void;
};

export default function WaitlistModal({ aberto, fechar }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const primeiroFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", aoTecla);
    document.body.style.overflow = "hidden";
    // Foco no botão fechar ao abrir
    setTimeout(() => primeiroFocusRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", aoTecla);
      document.body.style.overflow = "";
    };
  }, [aberto, fechar]);

  function aoClicarFora(e: React.MouseEvent) {
    if (e.target === overlayRef.current) fechar();
  }

  return (
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
          aria-label="Lista de espera"
        >
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative overflow-hidden rounded-sm bg-vinho">
              {/* Glow decorativo */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute -top-1/3 left-1/4 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(242,205,186,0.15),transparent_62%)] blur-3xl" />
                <div className="absolute -bottom-1/3 right-0 h-[25rem] w-[25rem] rounded-full bg-[radial-gradient(circle,rgba(196,126,138,0.20),transparent_62%)] blur-3xl" />
              </div>

              {/* Botão fechar */}
              <button
                ref={primeiroFocusRef}
                onClick={fechar}
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-creme/20 text-creme/50 transition-colors hover:border-creme/40 hover:text-creme/80"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Layout 2 colunas em desktop */}
              <div className="relative grid lg:grid-cols-[1fr_1.1fr]">
                {/* ── Coluna esquerda: copy + contador ── */}
                <div className="flex flex-col justify-center px-6 pt-14 pb-8 sm:px-9 lg:py-14">
                  <span className="eyebrow text-dourado-claro/70">Lista de espera</span>

                  <h2 className="display mt-4 text-[1.75rem] leading-[1.05] text-creme sm:text-[2.25rem]">
                    As inscrições abrem em breve.
                    <span className="mt-1 block italic text-blush">
                      A lista abre agora.
                    </span>
                  </h2>

                  <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-creme/65">
                    Na primeira edição, os lugares esgotaram. Desta vez, quem está na lista
                    recebe o aviso primeiro — e escolhe antes de abrirmos ao público.
                  </p>

                  {/* Benefícios */}
                  <ul className="mt-7 space-y-3">
                    {[
                      "Aviso por email e telemóvel antes da abertura oficial",
                      "Prioridade na escolha do lugar",
                      "Condição especial de lançamento",
                    ].map((texto) => (
                      <li key={texto} className="flex items-start gap-3">
                        <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dourado-claro/50" />
                        <span className="text-[0.875rem] leading-relaxed text-creme/75">
                          {texto}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Data e contador */}
                  <div className="mt-8">
                    <span className="eyebrow text-creme/35">
                      {site.data.extenso} · {site.local.nome}, {site.local.cidade}
                    </span>
                    <div className="mt-3">
                      <Countdown tom="claro" />
                    </div>
                  </div>
                </div>

                {/* ── Separador vertical ── */}
                <div
                  className="hidden w-px bg-gradient-to-b from-transparent via-creme/15 to-transparent lg:block"
                  aria-hidden
                />

                {/* ── Coluna direita: formulário ── */}
                <div className="px-6 pb-8 sm:px-9 lg:py-14 lg:pl-8">
                  <WaitlistForm />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
