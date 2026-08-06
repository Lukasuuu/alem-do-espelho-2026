"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Gift } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import WaitlistForm from "./WaitlistForm";
import Countdown from "./Countdown";
import { site } from "@/lib/site";
import { FIM_CAMPANHA_ISO } from "@/lib/campanha";

/** Fecho da lista de espera por extenso (ex.: "segunda-feira, 10 de agosto"). */
const FECHO_LISTA_EXTENSO = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date(FIM_CAMPANHA_ISO));

type Props = {
  aberto: boolean;
  fechar: () => void;
};

/** Elementos focáveis dentro do painel, para o foco circular (trap). */
function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(
    raiz.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export default function WaitlistModal({ aberto, fechar }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const abridorRef = useRef<HTMLElement | null>(null);
  const [montado, setMontado] = useState(false);

  // createPortal ao <body>, só depois de o cliente montar.
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberto) return;

    // Quem abriu, devolve-se o foco ao fechar.
    abridorRef.current = document.activeElement as HTMLElement;

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

    // Foco no primeiro campo ao abrir.
    const t = window.setTimeout(() => {
      const campo = painelRef.current?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled])"
      );
      (campo ?? painelRef.current?.querySelector<HTMLElement>("button:not([disabled])"))?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", aoTecla);
      window.clearTimeout(t);
      document.body.style.overflow = "";
      document.body.style.paddingRight = paddingAnterior;
      abridorRef.current?.focus();
    };
  }, [aberto, fechar]);

  function aoClicarFora(e: React.MouseEvent) {
    if (e.target === overlayRef.current) fechar();
  }

  const dialogo = (
    <AnimatePresence>
      {aberto && (
        <motion.div
          ref={overlayRef}
          className="modal-overlay modal-overlay-top"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={aoClicarFora}
          role="dialog"
          aria-modal="true"
          aria-labelledby="waitlist-titulo"
        >
          <motion.div
            ref={painelRef}
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

              {/* Botão fechar, alvo de toque ≥ 44×44 */}
              <button
                onClick={fechar}
                className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-creme/20 text-creme/50 transition-colors hover:border-creme/40 hover:text-creme/80"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Duas colunas em desktop, uma em mobile */}
              <div className="relative grid gap-12 lg:grid-cols-2">
                {/* ── Coluna esquerda: copy + contador ── */}
                <div className="flex flex-col items-start px-6 pt-16 pb-8 sm:px-9 lg:py-14">
                  <span className="eyebrow text-dourado-claro/70">Lista de espera</span>

                  <h2
                    id="waitlist-titulo"
                    className="display mt-4 text-[1.75rem] leading-[1.05] text-creme sm:text-[2.25rem]"
                  >
                    A coragem começa quando decides
                    <span className="mt-1 block italic text-blush">dar o primeiro passo.</span>
                  </h2>

                  <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-creme/65">
                    Na primeira edição, os lugares esgotaram. Desta vez, quem está na lista é
                    avisada primeiro e escolhe o seu lugar antes de abrirmos ao público.
                  </p>

                  {/* Benefícios */}
                  <ul className="mt-7 space-y-3">
                    {[
                      "Aviso por email e telemóvel antes da abertura oficial",
                      "Prioridade na escolha do teu lugar",
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

                  {/* Data do evento e contagem */}
                  <div className="mt-8">
                    <span className="eyebrow text-creme/35">
                      {site.data.extenso} · {site.local.nome}, {site.local.cidade}
                    </span>
                    <div className="mt-3">
                      <Countdown
                        tom="claro"
                        alvo={FIM_CAMPANHA_ISO}
                        suporte={`Inscrições abertas até ${FECHO_LISTA_EXTENSO}.`}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Coluna direita: formulário ── */}
                <div className="px-6 pb-8 sm:px-9 lg:py-14 lg:pl-0">
                  <WaitlistForm />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return montado ? createPortal(dialogo, document.body) : null;
}
