"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { site } from "@/lib/site";
import type { TotaisVaquinha } from "@/lib/vaquinha";
import CartaoVaquinha from "./CartaoVaquinha";
import Countdown from "./Countdown";

type Props = {
  abrirModal: () => void;
  /** Decidido no servidor: o evento já começou (ou o override de teste forçou). */
  vaquinhaAberta: boolean;
  /** Totais do primeiro render do cartão, lidos no servidor. */
  totaisVaquinha: TotaisVaquinha | null;
  /** Abre a folha da vaquinha com o valor escolhido no cartão (V4). */
  onContribuir: (valorCents: number) => void;
};

export default function Hero({ abrirModal, vaquinhaAberta, totaisVaquinha, onContribuir }: Props) {
  // Estado inicial vindo do SERVIDOR (sem mismatch de hidratação); depois da
  // montagem pode virar por conta própria quando o cronómetro chega a zero.
  const [vaquinha, setVaquinha] = useState(vaquinhaAberta);

  const surgir = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.9,
      delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  });

  return (
    <section
      id="topo"
      className="relative overflow-hidden bg-musgo pt-28 pb-20 sm:pt-32 sm:pb-24 lg:pt-36 lg:pb-28"
    >
      {/* Atmosfera: glow verde musgo e rosa */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/4 right-[-10%] h-[70rem] w-[70rem] rounded-full bg-[radial-gradient(circle,rgba(242,205,186,0.25),rgba(196,126,138,0.12)_38%,transparent_66%)] blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-15%] h-[55rem] w-[55rem] rounded-full bg-[radial-gradient(circle,rgba(101,115,101,0.30),transparent_62%)] blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* ── Coluna esquerda: conteúdo textual ── */}
        <div className="order-2 lg:order-1">
          <motion.div {...surgir(0.05)} className="flex items-center gap-4">
            <span className="eyebrow text-dourado-claro/80">{site.edicao}</span>
            <span className="h-px w-12 bg-creme/20" aria-hidden />
            <span className="eyebrow text-creme/40">Inscrições abertas</span>
          </motion.div>

          <motion.h1 {...surgir(0.15)} className="display mt-7 tracking-[-0.01em] text-creme">
            <span className="block text-[2.875rem] leading-[1.04] sm:text-[4rem] lg:text-[4.25rem]">
              O Além do Espelho
            </span>
            <span className="mt-2 block text-[2.875rem] leading-[1.04] sm:text-[4rem] lg:text-[4.25rem]">
              está de volta.
            </span>
            <span className="mt-2 block">
              <Image
                src="/brand/alemdemim.webp"
                alt="Além de Mim!"
                width={1080}
                height={260}
                priority
                sizes="(max-width: 640px) 70vw, (max-width: 1024px) 50vw, 28rem"
                className="h-[2.875rem] w-auto sm:h-[4rem] lg:h-[4.25rem]"
              />
            </span>
          </motion.h1>

          <motion.p
            {...surgir(0.28)}
            className="mt-8 max-w-md text-[1.0625rem] leading-relaxed text-creme/65"
          >
            A segunda edição do Além do Espelho acontece a{" "}
            <strong className="font-medium text-creme">{site.data.extenso}</strong>, no{" "}
            {site.local.nome}, em {site.local.cidade}. As inscrições estão abertas — são 100
            lugares, garantidos por ordem de pagamento.
          </motion.p>

          {/* Cronómetro → cartão da vaquinha. O estado inicial decide-se no
              SERVIDOR (page.tsx), para servidor e cliente renderizarem o mesmo
              HTML; com a página aberta, o onEncerrado do cronómetro faz a troca
              ao vivo, sem reload (fade + leve subida, ~400 ms).

              min-h reserva a altura do CRONÓMETRO, para a troca ao vivo não
              colapsar o bloco. Não se reserva a altura do cartão: ~600 px de
              buraco no hero durante três dias seria pior do que o CTA descer
              uma vez quando o cartão entra. */}
          <motion.div {...surgir(0.4)} className="mt-8 min-h-[7.5rem]">
            <AnimatePresence mode="wait" initial={false}>
              {vaquinha ? (
                <motion.div
                  key="vaquinha"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <CartaoVaquinha totaisIniciais={totaisVaquinha} onContribuir={onContribuir} />
                </motion.div>
              ) : (
                <motion.div
                  key="cronometro"
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Countdown
                    tom="claro"
                    alvo={site.data.iso}
                    rotulo="Faltam"
                    suporte={`${site.vagas} lugares · inscrição 40€`}
                    mensagemEncerrado="O dia chegou — vemo-nos lá!"
                    onEncerrado={() => setVaquinha(true)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div {...surgir(0.5)} className="mt-11">
            <button
              onClick={abrirModal}
              className="group inline-flex items-center gap-3 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(196,126,138,0.7)]"
            >
              Quero garantir o meu lugar
              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>

        {/* ── Coluna direita: fotoprincipal com moldura de vidro ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 lg:order-2"
        >
          <div className="espelho relative mx-auto max-w-[26rem] rounded-sm p-3 sm:p-4 lg:max-w-none">
            <Image
              src="/brand/fotoprincipal.webp"
              alt={`Vitória Gomes sentada num campo de flores ao pôr do sol — ${site.nome} · ${site.data.extenso}`}
              width={1078}
              height={1217}
              priority
              sizes="(max-width: 1024px) 90vw, 44vw"
              className="w-full rounded-sm"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
