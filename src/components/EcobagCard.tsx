"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Countdown from "./Countdown";
import Reveal from "./Reveal";
import {
  FIM_CAMPANHA_ISO,
  LIMITE_BONUS,
  TEXTO_BONUS,
  CAMPAIGN_POLL_MS,
} from "@/lib/campanha";

type Props = {
  /** Callback quando a campanha encerra (tempo esgotado ou 50 vagas preenchidas). */
  onEncerrado?: () => void;
};

/**
 * Card da campanha "Ecobag Bónus" — aparece entre o Hero e a Experience.
 *
 * Conteúdo:
 *  - Countdown para o fim da campanha
 *  - Foto da ecobag com moldura inspirada na bandeira de Angola
 *  - Counter "X / 50 vagas para o bónus" (polling via API)
 *  - Caixa de solidariedade
 *
 * Auto-encerramento: quando o countdown chega a 0 OU o counter atinge 50,
 * o card faz fade-out e mostra mensagem de encerramento.
 */
export default function EcobagCard({ onEncerrado }: Props) {
  const [inscritos, setInscritos] = useState<number | null>(null);
  const [encerrado, setEncerrado] = useState(false);
  const reduzido = useReducedMotion();

  // ── Polling do counter ──
  const buscarCount = useCallback(async () => {
    try {
      const res = await fetch("/api/campanha/inscritos", {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.ok && typeof data.inscritos === "number") {
        setInscritos(data.inscritos);
        if (data.inscritos >= LIMITE_BONUS) {
          setEncerrado(true);
          onEncerrado?.();
        }
      }
    } catch {
      // Silencioso — tenta novamente no próximo ciclo
    }
  }, [onEncerrado]);

  useEffect(() => {
    buscarCount();
    const id = setInterval(buscarCount, CAMPAIGN_POLL_MS);
    return () => clearInterval(id);
  }, [buscarCount]);

  // ── Countdown encerrou? ──
  const aoCountdownEncerrar = useCallback(() => {
    setEncerrado(true);
    onEncerrado?.();
  }, [onEncerrado]);

  const animation = reduzido
    ? false
    : { opacity: 0, y: 20 };
  const exitAnim = reduzido ? undefined : { opacity: 0, y: -10 };

  return (
    <section className="relative overflow-hidden bg-musgo py-12 sm:py-16">
      {/* Atmosfera */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.12),transparent_65%)] blur-3xl" />
      </div>

      <Reveal>
        <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
          <AnimatePresence mode="wait">
            {encerrado ? (
              /* ── Mensagem de encerramento ── */
              <motion.div
                key="encerrado"
                initial={animation}
                animate={{ opacity: 1, y: 0 }}
                exit={exitAnim}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-sm border border-creme/15 bg-creme/[0.04] px-8 py-12 text-center"
              >
                <p className="eyebrow text-dourado-claro/70">Campanha encerrada</p>
                <p className="display mt-4 text-[1.5rem] leading-[1.15] text-creme sm:text-[1.75rem]">
                  As {LIMITE_BONUS} ecobags bónus foram atribuídas.
                </p>
                <p className="mx-auto mt-4 max-w-md text-[0.9375rem] leading-relaxed text-creme/55">
                  Ainda podes inscrever-te na Lista de Espera e garantir o teu lugar no
                  Além do Espelho 2026 — mas o bónus da ecobag já não está disponível.
                </p>
              </motion.div>
            ) : (
              /* ── Card da campanha ativa ── */
              <motion.div
                key="ativo"
                initial={animation}
                animate={{ opacity: 1, y: 0 }}
                exit={exitAnim}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="eyebrow text-dourado-claro/80">Bónus exclusivo</span>

                <div className="mt-6 grid items-start gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-14">
                  {/* ── Coluna esquerda: texto + countdown ── */}
                  <div>
                    <h2 className="display text-[1.75rem] leading-[1.08] text-creme sm:text-[2.125rem]">
                      Ecobag Além do Espelho
                    </h2>
                    <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-creme/65">
                      As primeiras <strong className="font-medium text-creme">{LIMITE_BONUS} participantes</strong> inscritas
                      na Lista de Espera recebem uma ecobag exclusiva com{" "}
                      {TEXTO_BONUS.toLowerCase()}.
                    </p>

                    {/* Counter */}
                    <div className="mt-6 inline-flex items-baseline gap-2">
                      <span className="display text-[2.5rem] tabular-nums text-dourado-claro">
                        {inscritos !== null ? inscritos : "–"}
                      </span>
                      <span className="text-[1.125rem] text-creme/45">
                        / {LIMITE_BONUS} vagas para o bónus
                      </span>
                    </div>

                    {/* Countdown */}
                    <div className="mt-6">
                      <Countdown
                        tom="claro"
                        alvo={FIM_CAMPANHA_ISO}
                        rotulo="A campanha termina em"
                        mensagemEncerrado="A campanha terminou."
                        onEncerrado={aoCountdownEncerrar}
                      />
                    </div>

                    {/* Caixa de solidariedade */}
                    <div className="mt-7 rounded-sm border border-creme/10 bg-creme/[0.03] px-5 py-4">
                      <p className="text-[0.875rem] leading-relaxed text-creme/60">
                        <span className="mr-1.5" aria-hidden>
                          ❤️
                        </span>
                        Cada ecobag é preenchida com produtos de solidariedade que serão
                        enviados a mulheres em situação de vulnerabilidade em Angola. Ao
                        inscrever-te, transformas vidas em dois continentes.
                      </p>
                    </div>
                  </div>

                  {/* ── Coluna direita: foto da ecobag com moldura Angola ── */}
                  <div className="mx-auto max-w-[24rem] lg:mx-0 lg:max-w-none">
                    <div className="relative p-[5px]">
                      {/* Moldura Angola — 4 barras com cores da bandeira */}
                      <div className="absolute inset-x-0 top-0 h-[5px] rounded-t-sm bg-[#009739]" />
                      <div className="absolute inset-y-0 left-0 w-[5px] rounded-l-sm bg-[#CE1126]" />
                      <div className="absolute inset-x-0 bottom-0 h-[5px] rounded-b-sm bg-black" />
                      <div className="absolute inset-y-0 right-0 w-[5px] rounded-r-sm bg-[#F9D616]" />

                      <div className="overflow-hidden rounded-sm bg-creme/5">
                        <Image
                          src="/brand/ecobag.webp"
                          alt="Ecobag exclusiva do Além do Espelho — preenchida com produtos de solidariedade para Angola"
                          width={1179}
                          height={828}
                          sizes="(max-width: 1024px) 85vw, 380px"
                          className="h-auto w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}
