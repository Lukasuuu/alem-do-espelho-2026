import { useEffect, useRef, useState } from "react";
import LocalImage from "./LocalImage";
import { type Patrocinador, FIO_TOKENS, type FioTokenKey } from "@/lib/patrocinadores";

/** Largura da faixa da foto (px) — uniforme nos 3 graus (D1).
 *  Hierarquia visual passa a vir do tamanho da foto INTERIOR (FOTO_INNER_POR_GRAU),
 *  não da largura da faixa. Em mobile (<md) a wrapper volta a empilhar com a largura
 *  por grau (variável antiga fotoWidthRem) — não toca no comportamento actual. */
const LARGURA_FAIXA_PX = 130;

/** Altura da faixa do logo (px) por grau: fio 1=64, fio 2=52, fio 3=40 */
const ALTURA_LOGO_POR_GRAU = { 1: 64, 2: 52, 3: 40 } as const;

/** Largura base da foto (fio 3) em rem. Fio 2 = 1.25x, Fio 1 = 1.5x.
 *  Mantida APENAS para o cálculo em mobile (<md). */
const FOTO_BASE_REM = 7.5; // 120px a 16px base

/** Tamanho da foto dentro da faixa uniforme (px) — hierarquia por grau (D1).
 *  Ratio 4:5 mantém-se (altura = 1.25 × largura). */
const FOTO_INNER_POR_GRAU = { 1: 110, 2: 96, 3: 84 } as const;

/** Tamanho base do nome (fio 3) em rem. */
const NOME_BASE_REM = 1.125; // 18px

type Props = {
  patrocinador: Patrocinador;
  /**
   * claro = página clara (vidro-cartao, texto escuro);
   * escuro = dentro de modal de patrocínio (vidro sobre vinho, texto creme).
   */
  tom?: "claro" | "escuro";
  /** Se true, aplica o estado de destaque do carrossel (hover individual) */
  emDestaque?: boolean;
  /** Callback quando o rato entra no cartão (para carrossel) */
  onMouseEnter?: () => void;
  /** Callback quando o rato sai do cartão (para carrossel) */
  onMouseLeave?: () => void;
};

/**
 * Cartão HORIZONTAL de patrocinadora (CORREÇÃO nº2):
 *
 *   desktop → [foto 4:5, ~120-180px] [coluna de conteúdo, min-width 200-260px]
 *   mobile  → empilhado, foto em cima
 *
 * Coluna de conteúdo, por ordem:
 *   1. faixa do logo (altura por grau, object-fit contain, ao lado do nome)
 *   2. nome (text-wrap: balance, sem hyphens)
 *   3. título profissional (text-wrap: pretty, ≤2 linhas)
 *   4. descrição curta (graus 1-2, só quando aprovada)
 *   5. história curta (2–3 linhas) — só quando aprovada
 *   6. frase em destaque — só quando aprovada
 *
 * Largura do cartão é responsabilidade do pai (grid da página ou modal).
 */
export default function CartaoPatrocinadora({
  patrocinador,
  tom = "claro",
  emDestaque = false,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const claro = tom === "claro";
  const { foto, logo, nome, titulo, descricao, historia, citacao, destaque, ocultarTitulo, ocultarNome } = patrocinador;

  // Hover state para foto — will-change só durante interação
  const fotoRef = useRef<HTMLDivElement>(null);
  const [hoverFoto, setHoverFoto] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Detecção de md+ via matchMedia — D1: faixa uniforme da foto (130px) só em desktop.
  // Pure JS, sem globals.css, sem duplicar LocalImage, sem depender de Tailwind !important.
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPrefersReducedMotion(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    }
  }, []);

  // Estado de destaque combinado: hover interno OU destaque do carrossel
  const estaEmDestaque = hoverFoto || emDestaque;

  // Mapear destaque (1|2|3) para chave de token funcional
  const fioKey = `fio-${destaque}` as FioTokenKey;
  const fio = FIO_TOKENS[fioKey];

  // Largura da foto: base * multiplicador por destaque (D1 — mobile only).
  // Em desktop (≥md) a wrapper passa a LARGURA_FAIXA_PX (130px) e a foto interior
  // fica centrada com FOTO_INNER_POR_GRAU[destaque] (110/96/84px).
  const multiplicadorFoto = destaque === 1 ? 1.5 : destaque === 2 ? 1.25 : 1;
  const fotoWidthRemMobile = FOTO_BASE_REM * multiplicadorFoto;
  const fotoInnerPx = FOTO_INNER_POR_GRAU[destaque];
  const fotoInnerHeightPx = fotoInnerPx * 1.25; // ratio 4:5
  // Variável legada preservada para o ramo mobile (style condicional abaixo).
  const fotoWidthRem = fotoWidthRemMobile;

  // Tamanho do nome: base * multiplicador por destaque
  const multiplicadorNome = destaque === 1 ? (1.5 / 1.125) : destaque === 2 ? (1.25 / 1.125) : 1;
  const nomeSizeRem = NOME_BASE_REM * multiplicadorNome;

  // Altura da faixa do logo por grau.
  // Grau 1 (Lígia) é responsiva — ver globals.css `.caixa-logo-grau-1`.
  // Outros graus são fixos na tabela (ALTURA_LOGO_POR_GRAU).
  const isGrau1 = destaque === 1;
  const alturaLogo = ALTURA_LOGO_POR_GRAU[destaque];

  // Layout do row do logo+nome: grau 1 muda de linha abaixo do xl porque o
  // logo é demasiado largo (5,41:1) para a coluna <1280.
  const classeRowLogoNome = isGrau1
    ? "flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-3 min-w-0"
    : "flex items-center gap-3 min-w-0";

  // Caixas: grau 1 recebe width/height via CSS com media query (343/56 → 346/64);
  // outros graus calculam pela proporção natural do asset × altura.
  const estiloCaixaLogo = isGrau1
    ? { backgroundColor: logo.fundoHex, maxWidth: "100%" }
    : {
        backgroundColor: logo.fundoHex,
        width: `${(logo.width / logo.height) * alturaLogo}px`,
        maxWidth: "100%",
        height: alturaLogo,
      };
  const classeCaixaLogo = isGrau1 ? "caixa-logo-grau-1" : "";

  const estiloFio = {
    borderWidth: fio.espessura,
    borderImage: `${fio.gradiente} 1`,
    boxShadow: fio.glow,
    opacity: fio.opacidade,
    // Transição do fio para hover (luminosidade +15%)
    transition: "opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 280ms cubic-bezier(0.22, 1, 0.36, 1)",
  } as React.CSSProperties;

  // Estilo hover/destaque do fio — +15% luminosidade (opacity)
  const estiloFioHover = estaEmDestaque
    ? {
        opacity: Math.min(1, fio.opacidade * 1.15),
        boxShadow: fio.glow !== "none"
          ? fio.glow.replace(/rgba?\([^)]+\)/, (m) => m.replace(/[\d.]+\)$/, (n) => `${Math.min(1, parseFloat(n) * 1.15)})`))
          : "none",
      }
    : {};

  // Filtros hover/destaque da foto
  const fotoStyle: React.CSSProperties = {
    filter: estaEmDestaque && !prefersReducedMotion
      ? "saturate(1.06) brightness(1.04) contrast(1.04)"
      : "saturate(0.92) brightness(0.97) contrast(1)",
    transform: estaEmDestaque && !prefersReducedMotion ? "scale(1.02)" : "none",
    transition: prefersReducedMotion
      ? "filter 280ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "filter 280ms cubic-bezier(0.22, 1, 0.36, 1), transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: estaEmDestaque ? "transform, filter" : "auto",
  };

  return (
    <article
      data-cartao-patrocinador
      className={`w-full min-w-0 p-6 text-left sm:p-7 ${
        claro
          ? "vidro-cartao rounded-2xl"
          : "rounded-2xl border border-creme/20 bg-creme/5 backdrop-blur-sm"
      }`}
    >
      <div className="flex flex-col md:flex-row md:gap-6 min-w-0">
        {/* ── Foto (D1): em desktop ≥md, a wrapper passa a faixa uniforme de
              130px (LARGURA_FAIXA_PX) e a foto interior fica CENTRADA com
              tamanho por grau (110/96/84px). Em mobile (<md) mantém o cálculo
              antigo por grau + aspect-ratio 4:5 (empilhado). ── */}
        <div
          ref={fotoRef}
          aria-hidden="true"
          className="grupo-foto relative mx-auto w-full shrink-0 overflow-hidden rounded-sm bg-creme-profundo md:mx-0 md:max-w-none"
          style={{
            aspectRatio: isDesktop ? "auto" : "4 / 5",
            width: isDesktop ? `${LARGURA_FAIXA_PX}px` : `${fotoWidthRem}rem`,
            maxWidth: isDesktop ? `${LARGURA_FAIXA_PX}px` : `${fotoWidthRem}rem`,
            height: isDesktop ? `${LARGURA_FAIXA_PX * 1.25}px` : "auto", // ratio 4:5 da faixa
            ...estiloFio,
            ...estiloFioHover,
          }}
          onMouseEnter={(e) => { setHoverFoto(true); onMouseEnter?.(); }}
          onMouseLeave={(e) => { setHoverFoto(false); onMouseLeave?.(); }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              style={{
                width: `${fotoInnerPx}px`,
                height: `${fotoInnerHeightPx}px`,
                position: "relative",
              }}
            >
              <LocalImage
                src={foto.src}
                alt={foto.alt}
                width={foto.width}
                height={foto.height}
                className={`foto-patrocinador absolute inset-0 h-full w-full object-cover object-top ${
                  claro ? "" : "opacity-90"
                }`}
                style={fotoStyle}
              />
            </div>
          </div>
        </div>

        {/* ── Coluna de conteúdo ── */}
        <div
          className="mt-5 min-w-0 flex-1 md:mt-0"
        >
          {/* 1. Faixa do logo (altura por grau, contain) ao lado do nome.
                Grau 1 (Lígia): row muda para coluna abaixo do xl porque o
                logo 5,41:1 não cabe ao lado do nome em <1280. Ver
                globals.css `.caixa-logo-grau-1` para width/height responsivos. */}
          <div className={classeRowLogoNome}>
            <span
              aria-hidden
              className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-black/5 ${classeCaixaLogo}`}
              style={estiloCaixaLogo}
              data-caixa-logo
              {...(isGrau1 ? { "data-grau-1": "true" } : {})}
            >
              <LocalImage
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                className="h-full w-auto object-contain"
                style={{ width: "auto", height: "100%" }}
              />
            </span>
            {/* 2. Nome, ao lado do logo (tamanho por destaque).
                basis-auto + flex-1 com max-w explícito previne o nome de
                esticar até à largura da coluna. O limite cabe em ~3× o nome
                do próprio texto sem cortar.
                Se `ocultarNome`, o nome é só o `alt` do logo (acessível).
                Decisão de duplicação visual: ver campo `ocultarNome` em
                patrocinadores.ts. */}
            {!ocultarNome && (
              <span
                className={`display block min-w-0 flex-1 leading-tight [text-wrap:balance] [overflow-wrap:normal] [hyphens:none] ${
                  claro ? "text-vinho" : "text-creme"
                }`}
                style={{ fontSize: `${nomeSizeRem}rem`, maxWidth: "30ch" }}
              >
                {nome}
              </span>
            )}
          </div>

          {/* 3. Título profissional (text-wrap: pretty, ≤2 linhas) — oculto se redundante com a descrição */}
          {!ocultarTitulo && (
            <p
              className={`mt-1.5 text-[0.8125rem] leading-snug [text-wrap:pretty] [overflow-wrap:normal] [hyphens:none] ${
                claro ? "text-carvao/60" : "text-creme/60"
              }`}
            >
              {titulo}
            </p>
          )}

          {/* 4. Descrição curta — só quando aprovada (graus 1-2) */}
          {descricao && (
            <p
              className={`mt-3 text-[0.9375rem] leading-relaxed [text-wrap:pretty] [overflow-wrap:normal] text-center max-w-[34ch] mx-auto ${
                claro ? "text-carvao/75" : "text-creme/75"
              }`}
            >
              {descricao}
            </p>
          )}

          {/* 5. História curta — só quando aprovada (placeholder vazio não renderiza) */}
          {historia && (
            <p
              className={`mt-3 text-[0.9375rem] leading-relaxed ${
                claro ? "text-carvao/75" : "text-creme/75"
              }`}
            >
              {historia}
            </p>
          )}

          {/* 6. Frase em destaque — só quando aprovada */}
          {citacao && (
            <blockquote
              className={`mt-4 border-l-2 border-dourado/50 pl-4 text-[0.9375rem] italic leading-relaxed ${
                claro ? "text-vinho/85" : "text-blush/90"
              }`}
            >
              “{citacao}”
            </blockquote>
          )}
        </div>
      </div>
    </article>
  );
}
