"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Modal from "./Modal";
import Countdown from "./Countdown";
import MolduraEspelho from "./MolduraEspelho";
import { FIM_CAMPANHA_ISO, LIMITE_BONUS, TEXTO_BONUS } from "@/lib/campanha";
import { useCampaignCountdown } from "@/hooks/useCampaignCountdown";

type Props = {
  aberto: boolean;
  fechar: () => void;
  /** Número atual de inscritas na campanha (polling vive no pai). */
  inscritos: number | null;
  /** A campanha encerrou (prazo esgotado ou 50 vagas preenchidas)? */
  encerrado: boolean;
  /** Callback quando a campanha encerra enquanto a modal está aberta. */
  onEncerrado: () => void;
  /** O visitante clicou "Quero fazer parte" — fecha e abre inscrição. */
  onQueroFazerParte: () => void;
  /** O visitante clicou "Pular" — fecha sem avançar para inscrição. */
  onPular: () => void;
};

/**
 * Modal da campanha "Ecobag Bónus", apresentada ANTES da inscrição.
 *
 * Auto-abre ~3 s após a página carregar (controlled by EventoPage).
 * Design FASE6: MolduraEspelho compact, counter tipográfico (não barra),
 * botão "pular" ao lado do CTA, copy para inscrição paga.
 */
export default function EcobagModal({
  aberto,
  fechar,
  inscritos,
  encerrado,
  onEncerrado,
  onQueroFazerParte,
  onPular,
}: Props) {
  const reduzido = useReducedMotion();
  const campanha = useCampaignCountdown();
  const animation = reduzido ? false : { opacity: 0, y: 14 };
  const exitAnim = reduzido ? undefined : { opacity: 0, y: -8 };

  return (
    <Modal
      aberto={aberto}
      fechar={fechar}
      titulo={encerrado ? "Campanha encerrada" : "Ecobag Além do Espelho"}
      eyebrow={encerrado ? undefined : "Bónus solidário"}
      tom="vinho"
      larguraMax="52rem"
      focoInicial="[data-foco-principal]"
    >
      <div className="mt-7">
        <AnimatePresence mode="wait" initial={false}>
          {encerrado ? (
            /* ── Estado encerrado ── */
            <motion.div
              key="encerrado"
              initial={animation}
              animate={{ opacity: 1, y: 0 }}
              exit={exitAnim}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-creme/65">
                As {LIMITE_BONUS} ecobags bónus foram atribuídas. Ainda podes
                inscrever-te e garantir o teu lugar no Além do Espelho 2026 — o
                bónus da ecobag já não está disponível, mas a tua inscrição
                continua a contar.
              </p>
              <button
                data-foco-principal
                onClick={onQueroFazerParte}
                className="mt-8 inline-flex items-center gap-3 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(196,126,138,0.7)]"
              >
                Inscrever-me
              </button>
            </motion.div>
          ) : (
            /* ── Estado ativo: campanha a decorrer ── */
            <motion.div
              key="ativo"
              initial={animation}
              animate={{ opacity: 1, y: 0 }}
              exit={exitAnim}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="grid items-start gap-8 lg:grid-cols-[1fr_0.9fr] lg:gap-10">
                {/* ── Coluna esquerda: counter + countdown + CTA ── */}
                <div>
                  <p className="text-[0.9375rem] leading-relaxed text-creme/70">
                    As primeiras{" "}
                    <strong className="font-medium text-creme">
                      {LIMITE_BONUS} participantes
                    </strong>{" "}
                    inscritas recebem uma ecobag exclusiva com{" "}
                    {TEXTO_BONUS.toLowerCase()}.
                  </p>

                  {/* Counter tipográfico — MolduraEspelho compact */}
                  <MolduraEspelho variante="compact" className="mt-6 inline-block">
                    <div className="rounded-sm border border-creme/10 bg-creme/[0.04] px-6 py-4 text-center">
                      <span className="display block text-[3rem] tabular-nums leading-none text-dourado-claro">
                        {inscritos !== null ? inscritos : "–"}
                      </span>
                      <span className="mt-1 block text-[0.8125rem] text-creme/45">
                        de {LIMITE_BONUS} ecobags
                      </span>
                    </div>
                  </MolduraEspelho>

                  {/* Countdown compacto */}
                  <div className="mt-6">
                    <Countdown
                      tom="claro"
                      alvo={FIM_CAMPANHA_ISO}
                      rotulo="A campanha termina em"
                      mensagemEncerrado="A campanha terminou."
                      onEncerrado={onEncerrado}
                      dias={campanha.dias}
                      horas={campanha.horas}
                      minutos={campanha.minutos}
                      segundos={campanha.segundos}
                      encerrado={campanha.encerrado}
                    />
                  </div>

                  {/* Caixa de solidariedade */}
                  <div className="mt-6 rounded-sm border border-creme/10 bg-creme/[0.03] px-5 py-4">
                    <p className="text-[0.875rem] leading-relaxed text-creme/60">
                      <span className="mr-1.5" aria-hidden>
                        ❤️
                      </span>
                      Cada ecobag é preenchida com produtos de solidariedade que
                      serão enviados a mulheres em situação de vulnerabilidade em
                      Angola. Ao inscrever-te, transformas vidas em dois
                      continentes.
                    </p>
                  </div>

                  {/* CTA + Pular */}
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button
                      data-foco-principal
                      onClick={onQueroFazerParte}
                      className="inline-flex items-center gap-3 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(196,126,138,0.7)]"
                    >
                      Quero fazer parte
                    </button>
                    <button
                      onClick={onPular}
                      className="text-[0.875rem] text-creme/40 underline-offset-2 transition-colors hover:text-creme/70 hover:underline"
                    >
                      Pular
                    </button>
                  </div>
                </div>

                {/* ── Coluna direita: foto da ecobag com moldura Angola ── */}
                <div className="mx-auto max-w-[22rem] lg:mx-0 lg:max-w-none">
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
                        sizes="(max-width: 1024px) 90vw, 360px"
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
    </Modal>
  );
}
