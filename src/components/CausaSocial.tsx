"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BadgeCheck, Check, Heart } from "lucide-react";
import Reveal from "./Reveal";
import ModalPontosRecolha from "./ModalPontosRecolha";
import SponsorFlow from "./SponsorFlow";
import VitrinePatrocinadoras from "./VitrinePatrocinadoras";
import Countdown from "./Countdown";
import { useCampaignCountdown } from "@/hooks/useCampaignCountdown";
import { FIM_CAMPANHA_ISO, KIT_ITENS } from "@/lib/campanha";
import { SPONSORS_ATIVOS } from "@/lib/sponsors";

const vantagensInscricao = [
  "Acesso ao evento Além do Espelho 2026",
  "Networking com mulheres empreendedoras",
  "Experiência transformadora e memorável",
] as const;

/** Curva de easing da marca — idêntica à do Hero. */
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Secção "Além de Mim" — causa social solidária.
 *
 * Refatoração premium (ago 2026): integração total com a identidade da
 * landing. Fundo claro (creme → creme profundo) em vez do verde; moldura da
 * ecobag em vidro translúcido com blur + glow dourado e flutuação subtil;
 * cartões em glassmorphism com contorno dourado; título verde-musgo + dourado
 * metálico. O verde fica reservado a acentos (título, texto do selo), nunca
 * ao fundo. Conteúdo e funcionalidade mantidos intactos.
 */
type Props = { faseInscricaoAtiva: boolean };

/**
 * Gate de patrocinadores: faseInscricaoAtiva chega do SERVIDOR (page.tsx →
 * cutover.inscricaoAtiva) e é TRUE apenas quando a inscrição paga está ativa
 * (10/08 10:00 Lisboa; override NEXT_PUBLIC_FASE_OVERRIDE incluído). Enquanto
 * false, o bloco de patrocínio (título, vitrine/marquee, "Quero Patrocinar")
 * não é renderizado — sem relógio no client, sem buracos de layout.
 */
export default function CausaSocial({ faseInscricaoAtiva }: Props) {
  const [pontosAberto, setPontosAberto] = useState(false);
  const campanha = useCampaignCountdown();
  const router = useRouter();

  // ── Viragem ao vivo (FIM_CAMPANHA_ISO = 10/08 10:00 Lisboa) ──
  // Quando a contagem chega a zero, ~2 s depois fazemos router.refresh(): o
  // servidor (force-dynamic + revalidate=0) volta a calcular a fase e a secção
  // de patrocinadores liga sem reload forçado. A guarda refreshAgendado garante
  // UMA única chamada por sessão de página — sem loop mesmo que o servidor
  // responda "lista" (o refresh é idempotente e não volta a agendar).
  const refreshAgendado = useRef(false);
  useEffect(() => {
    if (campanha.encerrado && !refreshAgendado.current) {
      refreshAgendado.current = true;
      const t = window.setTimeout(() => router.refresh(), 2000);
      return () => window.clearTimeout(t);
    }
  }, [campanha.encerrado, router]);

  return (
    <>
      <section
        id="alem-de-mim"
        className="relative overflow-hidden bg-gradient-to-b from-creme via-creme-profundo to-creme py-[clamp(64px,10vw,120px)]"
      >
        {/* ── Atmosfera: glows blush e dourado subtis ── */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-[-12%] h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(242,205,186,0.5),transparent_62%)] blur-3xl" />
          <div className="absolute bottom-[-18%] left-[-10%] h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.22),transparent_62%)] blur-3xl" />
        </div>

        {/* ── Curvas orgânicas + traços dourados (decorativos, subtis) ── */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 1440 900"
          fill="none"
        >
          <path
            d="M-60-40 C 200 80, 360 280, 180 520 C 100 620, 20 680, -60 700Z"
            fill="rgb(92 50 62 / 0.05)"
          />
          <path
            d="M1380 720 C 1200 800, 1100 680, 1180 520 C 1260 360, 1400 300, 1500 180Z"
            fill="rgb(242 205 186 / 0.16)"
          />
          <path
            d="M1360-60 C 1440 100, 1480 260, 1400 440 C 1360 520, 1300 560, 1260 580 C 1220 600, 1160 580, 1140 540 C 1100 460, 1120 340, 1180 220 C 1240 100, 1320-20, 1360-60Z"
            fill="rgb(212 175 55 / 0.05)"
          />

          {/* Traços finos dourados — detalhe sutil de fundo */}
          <path
            d="M200-20 C 340 120, 400 340, 300 500"
            stroke="rgb(180 140 50 / 0.14)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M1200 920 C 1100 700, 1180 480, 1340 300"
            stroke="rgb(180 140 50 / 0.12)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M700 950 C 600 780, 520 600, 600 380"
            stroke="rgb(92 50 62 / 0.10)"
            strokeWidth="0.8"
            fill="none"
          />
        </svg>

        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          {/* ── Cronómetro da campanha ── */}
          <Reveal delay={0.05}>
            <div className="mx-auto mb-12 w-full max-w-[34rem] lg:mb-16">
              <div className="vidro-cartao rounded-2xl p-6 sm:p-8">
                <Countdown
                  tom="escuro"
                  alvo={FIM_CAMPANHA_ISO}
                  rotulo="A campanha termina em"
                  suporte="Lista de espera aberta até segunda-feira, 10 de agosto, às 10:00."
                  mensagemEncerrado="A campanha terminou."
                  dias={campanha.dias}
                  horas={campanha.horas}
                  minutos={campanha.minutos}
                  segundos={campanha.segundos}
                  encerrado={campanha.encerrado}
                  gradeMobile
                />
              </div>
            </div>
          </Reveal>

          {/* ── Layout duas colunas: conteúdo à esquerda, ecobag centrada ── */}
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_clamp(300px,36vw,460px)] lg:gap-16">
            {/* ═══ Coluna esquerda ═══ */}
            <div className="order-2 lg:order-1">
              <Reveal>
                <span className="flex items-center gap-4">
                  <span className="eyebrow text-musgo">ALÉM DO ESPELHO 2026</span>
                  <span className="h-px w-12 bg-dourado/50" aria-hidden />
                </span>
              </Reveal>

              <Reveal delay={0.05}>
                <h2 className="display mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08]">
                  <span className="block text-musgo">Muito mais do que</span>
                  <span className="mt-1 block text-ouro-degrade-creme">uma inscrição</span>
                </h2>
              </Reveal>

              <Reveal delay={0.1}>
                <p className="mt-5 max-w-lg text-[clamp(0.9375rem,1.5vw,1.125rem)] leading-relaxed text-carvao/70">
                  Ao inscrever-te no Além do Espelho 2026, garantes o teu
                  lugar num evento que transforma. Mas a inscrição é mais que
                  um bilhete — é um gesto de cuidado solidário.
                </p>
              </Reveal>

              {/* ── Card 1: 40€ de Inscrição ── */}
              <Reveal delay={0.15}>
                <div className="vidro-cartao group mt-10 rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1 hover:border-dourado/45 hover:shadow-[0_30px_70px_-24px_rgb(92_50_62_/_0.32)] sm:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush/40 transition-colors duration-300 group-hover:bg-dourado/15">
                      <Heart className="h-5 w-5 text-rosa transition-colors duration-300 group-hover:text-dourado" />
                    </span>
                    <h3 className="display text-[1.25rem] text-musgo">
                      40€ de Inscrição
                    </h3>
                  </div>

                  <ul className="space-y-3">
                    {vantagensInscricao.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blush/35 transition-colors duration-300 group-hover:bg-dourado/20">
                          <Check className="h-3 w-3 text-rosa transition-colors duration-300 group-hover:text-dourado" />
                        </span>
                        <span className="text-[0.9375rem] leading-snug text-carvao/80">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              {/* ── Card 2: Gesto de Amor ── */}
              <Reveal delay={0.2}>
                <div className="vidro-cartao group mt-6 rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1 hover:border-dourado/45 hover:shadow-[0_30px_70px_-24px_rgb(92_50_62_/_0.32)] sm:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush/40 transition-colors duration-300 group-hover:bg-dourado/15">
                      <Heart className="h-5 w-5 text-rosa transition-colors duration-300 group-hover:text-dourado" />
                    </span>
                    <h3 className="display text-[1.25rem] text-musgo">
                      Gesto de Amor
                    </h3>
                  </div>

                  <p className="mb-4 text-[0.8125rem] uppercase tracking-wider text-carvao/45">
                    Cada kit inclui:
                  </p>

                  <ul className="space-y-2.5">
                    {KIT_ITENS.map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-dourado/70 transition-colors duration-300 group-hover:bg-dourado"
                        />
                        <span className="text-[0.9375rem] text-carvao/75">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => setPontosAberto(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-carvao/15 px-5 py-2.5 text-[0.8125rem] font-medium text-carvao/60 transition-colors duration-300 hover:border-dourado/60 hover:text-dourado"
                  >
                    <Heart className="h-3.5 w-3.5" />
                    Onde entregar o kit
                  </button>
                </div>
              </Reveal>

              {/* ── Selo parceria ONG Atos ── */}
              <Reveal delay={0.25}>
                <div className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-blush/30 px-5 py-2.5">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-dourado" />
                  <span className="text-[0.875rem] text-musgo">
                    Em parceria com: <span className="font-medium">ONG Atos – Angola</span>
                  </span>
                </div>
              </Reveal>
            </div>

            {/* ═══ Coluna direita: ecobag em moldura de vidro, centrada ═══ */}
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
              className="order-1 lg:order-2"
            >
              <div className="relative mx-auto w-full max-w-[20rem] sm:max-w-[22rem] lg:max-w-none">
                {/* Glows atrás do vidro — tornam o blur visível no fundo claro */}
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <div className="absolute -left-10 -top-8 h-40 w-40 rounded-full bg-blush/60 blur-2xl" />
                  <div className="absolute -right-8 bottom-4 h-36 w-36 rounded-full bg-dourado/30 blur-2xl" />
                  <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rosa/20 blur-2xl" />
                </div>

                {/* Moldura de vidro com flutuação subtil */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  className="vidro relative rounded-[1.75rem] p-3 sm:p-4"
                >
                  <div
                    className="relative overflow-hidden rounded-[1.25rem] bg-[#F7F1E8]"
                    style={{ aspectRatio: "973 / 1617" }}
                  >
                    <Image
                      src="/brand/causasocial.webp"
                      alt="Ecobag do Além do Espelho 2026 com silhueta de mulher africana, girafas e produtos de higiene — kit de solidariedade"
                      fill
                      sizes="(max-width: 640px) 80vw, (max-width: 1024px) 42vw, 420px"
                      className="object-cover"
                    />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* ═══ Bloco citação: patrocínio — GATED pela fase de inscrição (server)
              E por SPONSORS_ATIVOS (FIX-2: desligado até a FIX-1 validar as RPCs
              de patrocínio no Supabase). Antes disso a secção termina na ecobag:
              countdown, cards de inscrição/gesto e selo ONG Atos, sem a vitrine. ═══ */}
          {faseInscricaoAtiva && SPONSORS_ATIVOS && (
            <Reveal delay={0.08}>
              <div className="mx-auto mt-20 max-w-2xl text-center">
                <h3 className="display text-[2rem] text-vinho">
                  Junte-se à nossa missão.
                </h3>
                <p className="mt-5 leading-relaxed text-carvao/65">
                  Ao tornar-se patrocinador desta iniciativa, a sua marca passa
                  a fazer parte de um projeto que transforma vidas, gera impacto
                  social e fortalece comunidades em Portugal e em Angola. Cada
                  parceria ajuda-nos a chegar a mais mulheres.
                </p>
                <VitrinePatrocinadoras />
                {/* CTA de patrocínio mantido abaixo da vitrine (fluxo de aquisição) */}
                <SponsorFlow />

                <p className="display mt-[clamp(24px,3.5vw,40px)] text-[clamp(1.75rem,3.5vw,2.5rem)] uppercase leading-[1.05] text-ouro-degrade-creme">
                  Além do Espelho 2026:
                </p>
                <p className="display mt-[clamp(14px,2vw,20px)] text-[clamp(1.25rem,2.5vw,1.5rem)] leading-[1.15] text-vinho">
                  Transformando mulheres em Portugal.
                  <br />
                  Impactando vidas em Angola.
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Modal pontos de recolha ── */}
      <ModalPontosRecolha
        aberto={pontosAberto}
        fechar={() => setPontosAberto(false)}
      />
    </>
  );
}
