import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import LocalImage from "./LocalImage";
import { type Patrocinador, TIER_TOKENS, type TierTokenKey } from "@/lib/patrocinadores";

/**
 * Cartão HORIZONTAL de patrocinadora — layout de PRODUÇÃO (card horizontal:
 * foto à esquerda com fio metálico · logo · nome · cargo · texto) com os
 * 3 deltas da correção pós-r3, e só eles:
 *
 *   Delta 1 — Foto maior: largura clamp(96px, 22vw, 150px), aspect-ratio 4:5
 *             fixo, object-fit cover, fio do tier mantido.
 *   Delta 2 — Logo em caixa 16:9 (assets cards 1600×900): .caixa-logo-16x9
 *             (globals.css) com object-contain e SEM background/padding/
 *             radius/borda por cima do asset — fundo, cantos e borda já
 *             embutidos no ficheiro.
 *   Delta 3 — Texto oculto por defeito, revelado só ao clique no toggle
 *             (gatilho circular + acordeão .acordao-bio, mecanismo já
 *             implementado na r3 — estado inicial fechado e toggle de volta).
 *
 * Layout do cartão:
 *   desktop → [foto 4:5, clamp 96–150px] [coluna de conteúdo, min-width 0]
 *   mobile  → empilhado, foto em cima
 *
 * Coluna de conteúdo, por ordem:
 *   1. faixa do logo (16:9, contain, ao lado do nome) — só pessoa com foto
 *      E logo; a marca (tipo "marca", ex.: Novex) mostra o logo no slot da
 *      foto e não repete; patrocinador sem logo salta o slot.
 *   2. nome (text-wrap: balance, sem hyphens)
 *   3. título profissional (text-wrap: pretty, ≤2 linhas)
 *   4. tagline — só quando preenchida
 *   5. toggle MISSÃO + acordeão (historia || descricao, citação se existir)
 *
 * Largura do cartão é responsabilidade do pai (lista da modal).
 */

/** Delta 1 — largura da foto (clamp pedido pelo Lucas). */
const FOTO_LARGURA = "clamp(96px, 22vw, 150px)";

/** Tamanho base do nome (fio 3) em rem — igual à produção. */
const NOME_BASE_REM = 1.125; // 18px

type Props = {
  patrocinador: Patrocinador;
  /**
   * claro = página clara (vidro-cartao, texto escuro);
   * escuro = dentro de modal de patrocínio (vidro sobre vinho, texto creme).
   */
  tom?: "claro" | "escuro";
};

export default function CartaoPatrocinadora({
  patrocinador,
  tom = "claro",
}: Props) {
  const claro = tom === "claro";
  const {
    id,
    foto,
    logo,
    nome,
    titulo,
    descricao,
    historia,
    citacao,
    tagline,
    destaque,
    tipo,
    ocultarTitulo,
    ocultarNome,
  } = patrocinador;

  // Hover state para foto — will-change só durante interação (igual à produção)
  const fotoRef = useRef<HTMLDivElement>(null);
  const [hoverFoto, setHoverFoto] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPrefersReducedMotion(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    }
  }, []);

  // Delta 3 — texto da missão FECHADO por defeito; toggle completo ao clique.
  const [bioAberta, setBioAberta] = useState(false);
  const textoMissao = historia || descricao;

  // Tokens do tier do patrocinador (gradiente do fio + acento sólido).
  const tier = TIER_TOKENS[`tier-${destaque}` as TierTokenKey];
  const acento = claro ? tier.acento : tier.acentoEscuro;

  // Grau de destaque — declarado cedo porque entra em vários cálculos abaixo.
  const isGrau1 = destaque === 1;

  // Tamanho do nome: base * multiplicador por destaque (igual à produção).
  const multiplicadorNome = destaque === 1 ? (1.5 / 1.125) : destaque === 2 ? (1.25 / 1.125) : 1;
  const nomeSizeRem = NOME_BASE_REM * multiplicadorNome;

  // Caixa do logo junto ao nome: só quando há FOTO (pessoa) e há logo — a
  // marca já o mostrou no slot da foto; quem não tem logo salta.
  const caixaLogoJuntoAoNome = foto && logo;
  // Logo no slot da foto — só quando NÃO há foto (marca, ex.: Novex).
  const logoMedia = foto ? undefined : logo;

  const estiloFio = {
    borderWidth: tier.espessura,
    borderImage: `${tier.gradiente} 1`,
    boxShadow: tier.glow,
    opacity: tier.opacidade,
    // Transição do fio para hover (luminosidade +15%)
    transition: "opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 280ms cubic-bezier(0.22, 1, 0.36, 1)",
  } as React.CSSProperties;

  // Estilo hover/destaque do fio — +15% luminosidade (opacity) e do glow.
  // O replace procura o 1º rgba() e amplia o canal alpha +15%; se o glow não
  // tiver rgba (ex. "none"), o replace é no-op e devolve a string intacta.
  const estiloFioHover = hoverFoto
    ? {
        opacity: Math.min(1, tier.opacidade * 1.15),
        boxShadow: tier.glow.replace(/rgba?\([^)]+\)/, (m) => m.replace(/[\d.]+\)$/, (n) => `${Math.min(1, parseFloat(n) * 1.15)})`)),
      }
    : {};

  // Filtros hover da foto (igual à produção)
  const fotoStyle: React.CSSProperties = {
    filter: hoverFoto && !prefersReducedMotion
      ? "saturate(1.06) brightness(1.04) contrast(1.04)"
      : "saturate(0.92) brightness(0.97) contrast(1)",
    transform: hoverFoto && !prefersReducedMotion ? "scale(1.02)" : "none",
    transition: prefersReducedMotion
      ? "filter 280ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "filter 280ms cubic-bezier(0.22, 1, 0.36, 1), transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: hoverFoto ? "transform, filter" : "auto",
  };

  return (
    <article
      data-cartao-patrocinador
      className={`w-full min-w-0 p-6 text-left sm:p-7 ${
        claro
          ? "vidro-cartao rounded-2xl"
          : "rounded-2xl border border-creme/20 bg-creme/5 backdrop-blur-sm"
      }`}
      style={{ "--tier-acento": acento } as React.CSSProperties}
    >
      <div className="flex flex-col md:flex-row md:gap-6 min-w-0">
        {/* ── Media (Delta 1): foto 4:5 com fio do tier; a marca (Novex) usa o
              slot para o logo-card (sem fio — o asset já traz borda). ── */}
        {(foto || logoMedia) && (
          <div
            ref={fotoRef}
            className={`relative mx-auto shrink-0 md:mx-0 md:self-start ${
              foto ? "overflow-hidden rounded-sm" : "flex items-center justify-center overflow-hidden"
            } ${isGrau1 && foto ? "bg-creme-profundo" : ""}`}
            style={
              foto
                ? {
                    // Delta 1: foto maior, aspect-ratio fixo 4:5, sem deformar.
                    width: FOTO_LARGURA,
                    maxWidth: FOTO_LARGURA,
                    aspectRatio: "4 / 5",
                    ...estiloFio,
                    ...estiloFioHover,
                  }
                : {
                    // Marca: card de logo 1:1, object-contain, SEM fio/bg
                    // (fundo, cantos e borda já vêm embutidos no asset).
                    width: FOTO_LARGURA,
                    maxWidth: FOTO_LARGURA,
                    aspectRatio: "1 / 1",
                  }
            }
            onMouseEnter={foto ? (e) => setHoverFoto(true) : undefined}
            onMouseLeave={foto ? (e) => setHoverFoto(false) : undefined}
          >
            {foto ? (
              isGrau1 ? (
                // Grau 1 (ouro): foto interior centrada, deixa a "moldura"
                // creme visível à volta (igual à produção, agora maior).
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative" style={{ width: "85%", height: "85%" }}>
                    <LocalImage
                      src={foto.src}
                      alt={foto.alt}
                      width={foto.width}
                      height={foto.height}
                      className={`absolute inset-0 h-full w-full object-cover object-top ${
                        claro ? "" : "opacity-90"
                      }`}
                      style={fotoStyle}
                    />
                  </div>
                </div>
              ) : (
                // Graus 2 e 3 (prata/bronze): sem moldura — a foto preenche
                // 100% da faixa, só o fio metálico visível (produção).
                <LocalImage
                  src={foto.src}
                  alt={foto.alt}
                  width={foto.width}
                  height={foto.height}
                  className={`absolute inset-0 h-full w-full object-cover object-top ${
                    claro ? "" : "opacity-90"
                  }`}
                  style={fotoStyle}
                />
              )
            ) : (
              // Marca (Novex): logo-card inteiro no slot da foto.
              logoMedia && (
                <LocalImage
                  src={logoMedia.src}
                  alt={logoMedia.alt}
                  width={logoMedia.width}
                  height={logoMedia.height}
                  className="h-full w-full object-contain"
                />
              )
            )}
          </div>
        )}

        {/* ── Coluna de conteúdo ── */}
        <div className="mt-5 min-w-0 flex-1 md:mt-0">
          {/* 1. Faixa do logo (16:9, contain) ao lado do nome — logos cards
                1600×900, slot clamp(150px, 34%, 240px) (ver globals.css
                .caixa-logo-16x9). Só pessoa com foto E logo; sem logo
                o slot salta e o card não parte. */}
          {(caixaLogoJuntoAoNome || !ocultarNome) && (
            <div className="flex items-center gap-3 min-w-0">
              {caixaLogoJuntoAoNome && (
                <span
                  aria-hidden
                  className="caixa-logo-16x9 inline-flex shrink-0 items-center justify-center overflow-hidden"
                  data-caixa-logo
                >
                  <LocalImage
                    src={logo.src}
                    alt={logo.alt}
                    width={logo.width}
                    height={logo.height}
                    className="h-full w-full object-contain"
                  />
                </span>
              )}
              {/* 2. Nome, ao lado do logo (tamanho por destaque). */}
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
          )}

          {/* 3. Título profissional (text-wrap: pretty, ≤2 linhas) — oculto se redundante */}
          {!ocultarTitulo && (
            <p
              className={`mt-1.5 text-[0.8125rem] leading-snug [text-wrap:pretty] [overflow-wrap:normal] [hyphens:none] ${
                claro ? "text-carvao/60" : "text-creme/60"
              }`}
            >
              {titulo}
            </p>
          )}

          {/* 4. Tagline — só quando preenchida (campo opcional dos dados). */}
          {tagline && (
            <p
              className={`mt-2 text-[0.8125rem] font-medium leading-snug ${
                claro ? "text-carvao/80" : "text-creme/80"
              }`}
            >
              {tagline}
            </p>
          )}

          {/* 5. Delta 3 — MISSÃO oculta por defeito, revelada só ao clique
                (gatilho circular ≥44px, aria-expanded, teclado nativo) e volta
                a ocultar ao clicar de novo. Texto = historia || descricao. */}
          {textoMissao && (
            <>
              <button
                type="button"
                aria-expanded={bioAberta}
                aria-controls={`bio-${id}`}
                onClick={() => setBioAberta((v) => !v)}
                className="gatilho-missao mt-4 inline-flex h-11 w-11 items-center justify-center rounded-full"
                aria-label={`Missão de ${nome}`}
              >
                <ChevronDown
                  aria-hidden
                  className={`h-5 w-5 transition-transform duration-300 ${
                    bioAberta ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div id={`bio-${id}`} className="acordao-bio" data-aberto={bioAberta}>
                <div>
                  <div className="pt-3">
                    <p className="eyebrow" style={{ color: acento }}>
                      Missão
                    </p>
                    <p
                      className={`mt-2 text-[0.9375rem] leading-relaxed [text-wrap:pretty] [overflow-wrap:normal] ${
                        claro ? "text-carvao/75" : "text-creme/75"
                      }`}
                    >
                      {textoMissao}
                    </p>
                    {citacao && (
                      <blockquote
                        className={`mt-3 border-l-2 border-dourado/50 pl-4 text-[0.9375rem] italic leading-relaxed ${
                          claro ? "text-vinho/85" : "text-blush/90"
                        }`}
                      >
                        “{citacao}”
                      </blockquote>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}