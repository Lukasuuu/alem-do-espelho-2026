"use client";

import { useEffect, useRef, useState } from "react";
import AzulejoLogo from "./AzulejoLogo";
import { patrocinadores } from "@/lib/patrocinadores";

/**
 * Faixa de logos em marquee — movimento infinito SUAVIZADO.
 *
 * RESPONSIVIDADE: adapta-se automaticamente a todas as resoluções
 * (1920/1440/1280/1024/834/768/430/390/320px) ajustando:
 *  - Altura dos logos (56px mobile → 72px desktop)
 *  - Gap entre logos (16px mobile → 24px desktop)
 *  - Número de cópias (calculado dinamicamente pela largura do container)
 *
 * O movimento é gerado pela Web Animations API (track.animate): translateX
 * (0 → -50%) linear sobre o bloco duplicado. O :hover NÃO trava de forma
 * brusca: o JS desacelera a playbackRate até 0 (travão de veludo).
 *
 * A11y/WCAG:
 *  - cópias duplicadas com aria-hidden="true" e alt="" (só a 1ª leitura conta);
 *  - prefers-reduced-motion → fila estática centrada, sem animação;
 *  - máscara de fade nas extremidades.
 *
 * HYDRATION: usa useState para montar só no client, evitando mismatch.
 */

/** Altura base do azulejo (ajustada por media query via JS). */
const ALTURA_BASE = 72;
/** Gap base entre logos. */
const GAP_BASE = 24;
/** Padding horizontal de cada tile. */
const PADDING_H = 16;
/** Teto defensivo de cópias para não explodir o DOM. */
const MAX_COPIAS = 16;
/** Duração de meia-volta (ms). */
const DURACAO_MS = 25000;
/** Passo de aproximação da velocidade — 0.08 ≈ trava em ~0.5s (60fps). */
const PASSO_VELOCIDADE = 0.08;
/** Tolerância para considerar "chegou". */
const TOLERANCIA = 0.02;
/** Frames por segundo do intervalo de suavização. */
const FPS = 16;

/**
 * Calcula o número PAR de cópias necessário para preencher ≥2x a largura
 * do container (cada metade = uma "volta" do marquee).
 */
function calcularCopias(containerWidth: number, altura: number, gap: number): number {
  const bloco = patrocinadores.reduce(
    (soma, p, i) => {
      const tileW = Math.ceil((p.logo.width / p.logo.height) * altura) + PADDING_H * 2;
      return soma + tileW + (i < patrocinadores.length - 1 ? gap : 0);
    },
    0
  );
  if (bloco === 0) return 2;
  const minCopias = Math.ceil((containerWidth * 2) / bloco);
  // Arredondar para PAR e limitar.
  const copias = Math.max(2, Math.min(minCopias + (minCopias % 2 === 0 ? 0 : 1), MAX_COPIAS));
  return copias;
}

/**
 * Detecta a altura adequada do tile baseado na largura da viewport.
 *  - ≤480px  → 48px (mobile pequeno)
 *  - ≤768px  → 56px (mobile/tablet)
 *  - ≤1024px → 64px (tablet/grande)
 *  - >1024px → 72px (desktop)
 */
function alturaParaViewport(width: number): number {
  if (width <= 480) return 48;
  if (width <= 768) return 56;
  if (width <= 1024) return 64;
  return ALTURA_BASE;
}

/**
 * Detecta o gap adequado baseado na largura da viewport.
 */
function gapParaViewport(width: number): number {
  if (width <= 480) return 12;
  if (width <= 768) return 16;
  return GAP_BASE;
}

export default function MarqueeLogos() {
  // Estado para evitar hydration mismatch — só renderiza o marquee após montar no client.
  const [montado, setMontado] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Dimensões responsivas (atualizadas via resize observer).
  const [altura, setAltura] = useState(ALTURA_BASE);
  const [gap, setGap] = useState(GAP_BASE);
  const [copias, setCopias] = useState(4);

  // Detectar prefers-reduced-motion no client.
  const [reduzido, setReduzido] = useState(false);

  // 1) Marcar como montado (resolve hydration) + preferência de movimento.
  useEffect(() => {
    setMontado(true);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzido(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduzido(e.matches);
    mq.addEventListener("change", handler);

    return () => mq.removeEventListener("change", handler);
  }, []);

  // 2) Medir o container SÓ depois de montado (o marquee só existe então).
  useEffect(() => {
    if (!montado) return;
    const container = containerRef.current;
    if (!container) return;

    const atualizarDimensoes = () => {
      const w = window.innerWidth;
      const novaAltura = alturaParaViewport(w);
      const novoGap = gapParaViewport(w);
      setAltura(novaAltura);
      setGap(novoGap);
      setCopias(calcularCopias(container.offsetWidth, novaAltura, novoGap));
    };

    atualizarDimensoes();

    const ro = new ResizeObserver(atualizarDimensoes);
    ro.observe(container);

    return () => ro.disconnect();
  }, [montado]);

  // Animação WAAPI + travão de veludo (só client, só se motion ok).
  useEffect(() => {
    if (!montado || reduzido) return;
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const animacao = track.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
      { duration: DURACAO_MS, iterations: Infinity, easing: "linear" }
    );

    let velocidade = 1;
    let temporizador: ReturnType<typeof setInterval> | undefined;

    function suavizarVelocidade(alvo: number) {
      if (temporizador) clearInterval(temporizador);
      temporizador = setInterval(() => {
        if (Math.abs(velocidade - alvo) < TOLERANCIA) {
          velocidade = alvo;
          animacao.playbackRate = alvo;
          if (temporizador) clearInterval(temporizador);
          return;
        }
        velocidade += (alvo - velocidade) * PASSO_VELOCIDADE;
        animacao.playbackRate = velocidade;
      }, FPS);
    }

    const aoEntrar = () => suavizarVelocidade(0);
    const aoSair = () => suavizarVelocidade(1);

    container.addEventListener("mouseenter", aoEntrar);
    container.addEventListener("mouseleave", aoSair);

    return () => {
      container.removeEventListener("mouseenter", aoEntrar);
      container.removeEventListener("mouseleave", aoSair);
      if (temporizador) clearInterval(temporizador);
      animacao.cancel();
    };
  }, [montado, reduzido, copias]);

  // ── Fallback antes de montar no client (evita hydration flash) ──
  if (!montado) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-6">
        {patrocinadores.map((p) => (
          <AzulejoLogo key={p.id} logo={p.logo} flexivel />
        ))}
      </div>
    );
  }

  // ── prefers-reduced-motion: fila estática centrada (WCAG) ──
  if (reduzido) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-6">
        {patrocinadores.map((p) => (
          <AzulejoLogo key={p.id} logo={p.logo} flexivel />
        ))}
      </div>
    );
  }

  // ── Marquee responsivo ──
  return (
    <div
      ref={containerRef}
      className="marquee-foco relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      style={{ paddingBlock: 8 }}
    >
      <div
        ref={trackRef}
        className="flex w-max items-center"
        style={{ gap }}
        aria-label="Marcas patrocinadores do Além do Espelho"
      >
        {Array.from({ length: copias }).map((_, copia) => (
          <div
            key={copia}
            className="flex items-center"
            style={{ gap }}
            aria-hidden={copia !== 0 || undefined}
          >
            {patrocinadores.map((p) => (
              <AzulejoLogo
                key={`${copia}-${p.id}`}
                logo={p.logo}
                altOculto={copia !== 0}
                altura={altura}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
