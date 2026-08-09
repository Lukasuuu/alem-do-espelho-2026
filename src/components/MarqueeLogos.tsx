"use client";

import { useEffect, useRef, useState } from "react";
import AzulejoLogo from "./AzulejoLogo";
import { patrocinadores } from "@/lib/patrocinadores";

/**
 * Faixa de logos em marquee — movimento infinito SUAVIZADO.
 *
 * MOVIMENTO: Web Animations API com translateX(0 → -50%) sobre um track de
 * 2×repeticoes blocos idênticos (costura perfeita — -50% cai sempre numa
 * fronteira de bloco). A velocidade é FIXA em px/s (VELOCIDADE_PX_S)
 * — a duração deriva de (scrollWidth / 2) / velocidade, medida após as imagens
 * decodificarem. O :hover NÃO trava de forma brusca: um loop de
 * requestAnimationFrame com decaimento exponencial normalizado por deltaTime
 * aproxima a playbackRate de 0 (travão de veludo ~400ms), usando
 * updatePlaybackRate() em vez de escrever playbackRate directamente.
 *
 * LOGOS NORMALIZADOS: cada marca é uma caixa FIXA (180×72, gap uniforme 56).
 * Largura uniforme ⇒ o período do ciclo é n×(caixa+gap) e o translateX(-50%)
 * fecha a costura sem salto.
 *
 * REPETIÇÕES CALCULADAS: o nº de blocos por metade deriva da largura do
 * contentor (mínimo 2), para a pista NUNCA ficar mais curta que o ecrã — com 2
 * ou com 20 patrocinadores. Sem condicional de contagem mínima: repetir o bloco
 * resolve a pista curta, o marquee é o único caminho de render.
 *
 * PAUSAS:
 *  - pointerenter/pointerleave + pointercancel (toque nunca fica preso);
 *  - focusin/focusout (WCAG — teclado);
 *  - IntersectionObserver + document.visibilitychange (fora de ecrã/tab);
 *  - NÃO há fila estática por prefers-reduced-motion (decisão de produto: o
 *    marquee corre em TODAS as máquinas). WCAG 2.2.2 fica satisfeito pelas
 *    pausas acima (hover/focus/fora de ecrã) — o mecanismo de paragem exigido.
 *
 * A11y/WCAG:
 *  - bloco duplicado com aria-hidden="true" e alt="" (só a 1ª leitura conta);
 *  - rótulo acessível no contentor;
 *  - máscara de fade nas extremidades.
 *
 * HYDRATION: usa useState para montar só no client, evitando mismatch.
 * React 19 dev monta duas vezes — o useEffect tem cleanup completo.
 */

/** Caixa fixa de cada logo (px). */
const BOX_W = 180;
const BOX_H = 72;
/** Gap uniforme entre logos (px). */
const GAP = 56;
/** Velocidade constante do marquee (px/s) — medida no diagnóstico. */
const VELOCIDADE_PX_S = 40;
/** Constante de tempo do travão de veludo (ms) — 3×τ ≈ 99% ≈ 315ms, ~400ms até 2%. */
const TAU_MS = 105;
/** Tolerância para considerar a velocidade "chegou" ao alvo. */
const TOLERANCIA = 0.02;
/**
 * Blocos por metade do track (mínimo). O track total é 2×repeticoes blocos —
 * o translateX(-50%) cai numa fronteira de bloco e a costura fecha exato,
 * para qualquer contagem de patrocinadores.
 */
const MIN_REPETICOES = 2;

export default function MarqueeLogos() {
  // Estado para evitar hydration mismatch — só renderiza o marquee após montar no client.
  const [montado, setMontado] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Diagnóstico visível: a animação WAAPI foi criada de verdade (dataset no DOM).
  const [marqueeAtivo, setMarqueeAtivo] = useState(false);

  // Blocos por metade do track — calculados da largura do contentor (efeito 2).
  const [repeticoes, setRepeticoes] = useState(MIN_REPETICOES);

  // 1) Marcar como montado (resolve hydration). Sem ramo reduced-motion:
  //    o marquee corre em todas as máquinas por decisão de produto.
  useEffect(() => {
    setMontado(true);
  }, []);

  // 2) Repetições calculadas — a pista enche sempre o contentor (nunca mais curta
  //    que o ecrã). Recalcula no ResizeObserver do contentor.
  useEffect(() => {
    if (!montado) return;
    const container = containerRef.current;
    if (!container) return;

    const blocoBase = patrocinadores.length * (BOX_W + GAP);
    if (blocoBase <= 0) return;
    const calcular = () => {
      const n = Math.max(MIN_REPETICOES, Math.ceil(container.clientWidth / blocoBase));
      setRepeticoes((anterior) => (anterior === n ? anterior : n));
    };
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(container);
    return () => ro.disconnect();
  }, [montado]);

  // 3) Animação WAAPI + travão de veludo + pausas (só client, só se motion ok).
  //    Depende de `repeticoes`: muda o nº de blocos, a pista re-mede e a animação
  //    recria com a duração certa.
  useEffect(() => {
    if (!montado) return;
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    // Aliases com tipo NÃO-nulo: os closures perdem o estreitamento do guard
    // (declarações de função são hoisted antes da verificação).
    const elContainer: HTMLDivElement = container;
    const elTrack: HTMLDivElement = track;

    let animacao: Animation | null = null;
    let larguraAtual = 0;
    let rafId = 0;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    let destruido = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Velocidade corrente (1 = cheio, 0 = parado) e alvo desejado.
    let velocidade = 1;
    let alvoVelocidade = 1;
    // Pausa DURA (fora de ecrã / tab oculta) — não é o travão suave.
    let pausadoFora = false;
    // Marquee fora da viewport (IntersectionObserver).
    let foraEcrã = false;

    /**
     * Cria (ou recria) a animação com duração derivada da velocidade fixa.
     * Se já existia, preserva a proporção do currentTime (resize).
     */
    function criarAnimacao() {
      const distancia = elTrack.scrollWidth / 2;
      if (distancia <= 0) return;
      const duracao = (distancia / VELOCIDADE_PX_S) * 1000;

      // Proporção do ciclo actual usando a DURAÇÃO ANTIGA (no resize as duas
      // durações diferem — o módulo pela duração nova estaria errado).
      const durSpec = animacao?.effect?.getTiming().duration;
      const durAntiga = typeof durSpec === "number" ? durSpec : 0;
      const proporcao =
        animacao && durAntiga > 0
          ? (Number(animacao.currentTime) % durAntiga) / durAntiga
          : 0;

      animacao?.cancel();
      animacao = elTrack.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
        { duration: duracao, iterations: Infinity, easing: "linear" }
      );
      if (proporcao > 0) animacao.currentTime = proporcao * duracao;
      animacao.updatePlaybackRate(velocidade);
    }

    /**
     * Travão de veludo: requestAnimationFrame com decaimento exponencial
     * normalizado por deltaTime. updatePlaybackRate() preserva o currentTime
     * (a API recomendada em vez de escrever playbackRate).
     */
    function passo(alvo: number) {
      if (rafId) cancelAnimationFrame(rafId);
      let ultimoT = performance.now();
      const tick = (agora: number) => {
        const dt = Math.min(agora - ultimoT, 100); // clamp evita salto após longa pausa
        ultimoT = agora;
        if (Math.abs(velocidade - alvo) < TOLERANCIA) {
          velocidade = alvo;
          animacao?.updatePlaybackRate(alvo);
          return;
        }
        velocidade += (alvo - velocidade) * (1 - Math.exp(-dt / TAU_MS));
        animacao?.updatePlaybackRate(velocidade);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    /**
     * Aplica o estado actual: pausa dura (fora de ecrã) prevalece sobre tudo;
     * caso contrário suaviza a velocidade até ao alvo corrente (travão de veludo).
     */
    function aplicar() {
      if (pausadoFora) {
        if (rafId) cancelAnimationFrame(rafId);
        animacao?.pause();
        return;
      }
      if (rafId) cancelAnimationFrame(rafId);
      animacao?.play();
      passo(alvoVelocidade);
    }

    function definirAlvo(alvo: number) {
      if (alvo === alvoVelocidade) return;
      alvoVelocidade = alvo;
      aplicar();
    }

    // Transição pausa dura → activo: a velocidade snap ao alvo (o travão ficou
    // congelado durante a pausa — não pode retomar a meio).
    function definirPausaFora(valor: boolean) {
      if (pausadoFora === valor) return;
      const saiuDePausa = pausadoFora && !valor;
      pausadoFora = valor;
      if (saiuDePausa) velocidade = alvoVelocidade;
      aplicar();
    }

    // ── Ponteiro (inclui toque via pointerevents) ──
    const aoEntrar = () => definirAlvo(0);
    const aoSair = () => definirAlvo(1);
    // pointercancel: gesto interrompido (toque) — nunca ficar preso.
    const aoCancelar = () => definirAlvo(1);
    // Saída da janela sem cruzar o contentor (blur / pointer deixa a janela).
    const aoSairJanela = () => {
      if (!document.hasFocus()) definirAlvo(1);
    };

    // ── Foco por teclado (WCAG): pausa com focus-within ──
    const aoFoco = () => definirAlvo(0);
    const aoSairFoco = () => definirAlvo(1);

    // ── Pausa fora de ecrã / tab oculta ──
    const aoVisibilidade = () => {
      definirPausaFora(document.hidden || foraEcrã);
    };

    // ── Arranque: esperar as imagens decodificarem (medida estável) ──
    let iniciado = false;
    function iniciar() {
      if (destruido || iniciado) return;
      iniciado = true;
      larguraAtual = elTrack.scrollWidth;
      criarAnimacao();
      setMarqueeAtivo(true); // dataset "ativo" no DOM — diagnóstico visível

      ro = new ResizeObserver(() => {
        const w = elTrack.scrollWidth;
        if (w === larguraAtual) return;
        larguraAtual = w;
        criarAnimacao(); // preserva proporção do currentTime internamente
      });
      ro.observe(elTrack);

      io = new IntersectionObserver(
        (entradas) => {
          foraEcrã = !entradas[0]?.isIntersecting;
          definirPausaFora(document.hidden || foraEcrã);
        },
        { threshold: 0.01 }
      );
      io.observe(elContainer);

      elContainer.addEventListener("pointerenter", aoEntrar);
      elContainer.addEventListener("pointerleave", aoSair);
      elContainer.addEventListener("pointercancel", aoCancelar);
      elContainer.addEventListener("focusin", aoFoco);
      elContainer.addEventListener("focusout", aoSairFoco);
      window.addEventListener("blur", aoSairJanela);
      window.addEventListener("pointerleave", aoSairJanela);
      document.addEventListener("visibilitychange", aoVisibilidade);
    }

    const imagens = Array.from(elTrack.querySelectorAll("img"));
    const prontoImagens = Promise.all(
      imagens.map((img) => {
        try {
          return img.decode().catch(() => undefined);
        } catch {
          return Promise.resolve(undefined);
        }
      })
    );
    // Fallback: nunca adiar o marquee indefinidamente se uma imagem tardar.
    timers.push(setTimeout(iniciar, 2500));
    prontoImagens.then(() => {
      timers.forEach((t) => clearTimeout(t));
      iniciar();
    });

    return () => {
      destruido = true;
      timers.forEach((t) => clearTimeout(t));
      if (rafId) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      elContainer.removeEventListener("pointerenter", aoEntrar);
      elContainer.removeEventListener("pointerleave", aoSair);
      elContainer.removeEventListener("pointercancel", aoCancelar);
      elContainer.removeEventListener("focusin", aoFoco);
      elContainer.removeEventListener("focusout", aoSairFoco);
      window.removeEventListener("blur", aoSairJanela);
      window.removeEventListener("pointerleave", aoSairJanela);
      document.removeEventListener("visibilitychange", aoVisibilidade);
      animacao?.cancel();
    };
  }, [montado, repeticoes]);

  // ── Fallback antes de montar no client (evita hydration flash) ──
  if (!montado) {
    // Dev: aviso visível se ficarmos presos no ramo pré-hidratação (suspeito a).
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
      console.warn("[marquee] ramo pré-hidratação (fila estática) — setMontado(true) ainda não correu");
    }
    return (
      <div
        data-marquee-estado="pre-hidratacao"
        className="flex flex-wrap items-center justify-center gap-6"
      >
        {patrocinadores.map((p) => (
          <AzulejoLogo key={p.id} logo={p.logo} flexivel />
        ))}
      </div>
    );
  }

  // ── Marquee: 2×repeticoes blocos idênticos, costura perfeita ──
  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Marcas patrocinadores do Além do Espelho"
      data-marquee-estado={marqueeAtivo ? "ativo" : "pre-hidratacao"}
      className="marquee-foco relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      style={{ paddingBlock: 8 }}
    >
      <div ref={trackRef} className="flex w-max items-center">
        {/* 2×repeticoes: a 1ª metade desliza e a 2ª entra no lugar — costura em -50%. */}
        {Array.from({ length: repeticoes * 2 }).map((_, bloco) => (
          <div
            key={bloco}
            className="flex items-center"
            style={{ gap: GAP, marginRight: GAP }}
            aria-hidden={bloco !== 0 || undefined}
          >
            {patrocinadores.map((p) => (
              <AzulejoLogo
                key={p.id}
                logo={p.logo}
                largura={BOX_W}
                altura={BOX_H}
                altOculto={bloco !== 0}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
