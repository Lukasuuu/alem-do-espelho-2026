"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Countdown from "./Countdown";
import { site } from "@/lib/site";

type Props = {
  irParaInscricao: () => void;
};

/**
 * Hero da página de pré-inscrição — mesma atmosfera e layout do hero
 * principal, com copy adaptada à lista de espera.
 */
export default function ListaEsperaHero({ irParaInscricao }: Props) {
  const surgir = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
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
        {/* Coluna esquerda — conteúdo */}
        <div className="order-2 lg:order-1">
          <motion.div {...surgir(0.05)} className="flex items-center gap-4">
            <span className="eyebrow text-dourado-claro/80">{site.edicao}</span>
            <span className="h-px w-12 bg-creme/20" aria-hidden />
            <span className="eyebrow text-creme/40">Pré-inscrição aberta</span>
          </motion.div>

          <motion.h1 {...surgir(0.15)} className="display mt-7 text-creme">
            <span className="block text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem]">
              Garanta a sua
            </span>
            <span className="mt-2 block text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem]">
              prioridade para o
            </span>
            <span className="mt-2 block text-[2.75rem] italic leading-[1.02] text-blush sm:text-6xl lg:text-[4.25rem]">
              Além do Espelho 2026.
            </span>
          </motion.h1>

          <motion.p
            {...surgir(0.28)}
            className="mt-8 max-w-md text-[1.0625rem] leading-relaxed text-creme/65"
          >
            A 2ª edição acontece a{" "}
            <strong className="font-medium text-creme">{site.data.extenso}</strong>, no{" "}
            {site.local.nome}, em {site.local.cidade}. São{" "}
            <strong className="font-medium text-creme">{site.vagas} lugares</strong> — quem
            está na lista recebe o aviso primeiro e escolhe antes de abrir ao público.
          </motion.p>

          <motion.div {...surgir(0.4)} className="mt-10">
            <Countdown tom="claro" />
          </motion.div>

          <motion.div {...surgir(0.5)} className="mt-11">
            <button
              onClick={irParaInscricao}
              className="group inline-flex items-center gap-3 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(196,126,138,0.7)]"
            >
              Entrar na Lista de Espera
              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>

        {/* Coluna direita — poster oficial dentro do painel de espelho */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 lg:order-2"
        >
          <div className="espelho relative mx-auto max-w-[26rem] rounded-sm p-3 sm:p-4 lg:max-w-none">
            <Image
              src="/brand/keyart.webp"
              alt={`Cartaz oficial do ${site.nome} — ${site.subtitulo}, ${site.data.extenso}, ${site.local.completo}`}
              width={1200}
              height={1500}
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
