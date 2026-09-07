import LocalImage from "./LocalImage";
import type { PatrocinadorComLogo } from "@/lib/patrocinadores";

/**
 * Azulejo de marca — tile QUADRADO e TRANSPARENTE, logo com object-fit: contain
 * e padding interno consistente.
 *
 * REFINAMENTO (Bloco I-r2): os tiles deixaram de ter fundo CSS. Os logos OURO
 * novos são cards pré-renderizados 600×600 (fundo de marca, cantos ~11% e borda
 * JÁ embutidos no .webp — `estilo: "card"`); os legados renderizam-se "como
 * vêm" (o rectangle do asset é o próprio asset). Uniformizar o tratamento:
 * nenhum logo leva caixa CSS — o dim/desfoque do efeito `.marquee-foco`
 * (globals.css) aplica-se por igual ao conteúdo, sem diferença de cor sob o
 * efeito. Sem upscale: contain mantém a proporção sem esticar.
 *
 * Dois modos:
 *  - MARQUEE (caixa fixa): `largura` definido → caixa quadrada (BOX_W = BOX_H),
 *    padding interno uniforme, logo centrado com maxWidth/maxHeight 100%.
 *  - ESTÁTICO (`flexivel`): encolhe até ao pai, sem esticar o logo.
 *
 * As micro-interações de isolamento de foco (opacity + escala no hover/tap)
 * são aplicadas por CSS contextual em .marquee-foco (globals.css) — fora do
 * marquee o tile fica neutro.
 */
type Props = {
  // Logo obrigatório — a faixa só renderiza quem tem logo (patrocinadoresNaFaixa).
  logo: PatrocinadorComLogo["logo"];
  /**
   * Lado do tile quadrado em px. Default 128 (desktop).
   */
  altura?: number;
  /**
   * Lado FIXO do tile em px — modo marquee. Quando presente, o logo é
   * normalizado para dentro da caixa (contain + padding) e não leva padding extra.
   */
  largura?: number;
  /**
   * alt="" nas cópias duplicadas do marquee — não repetir a mesma marca no
   * leitor de ecrã. O contentor duplicado leva também aria-hidden (ver componente).
   */
  altOculto?: boolean;
  /**
   * true na fila estática: o azulejo encolhe até ao pai (mobile) sem esticar
   * o logo. No marquee é false → shrink-0, para o track nunca comprimir.
   */
  flexivel?: boolean;
};

/** Padding interno uniforme do tile (px) — respiro igual para todos os logos. */
const PAD_TILE = 10;

export default function AzulejoLogo({
  logo,
  altura = 128,
  largura,
  altOculto = false,
  flexivel = false,
}: Props) {
  const modoFixo = typeof largura === "number" && !flexivel;

  return (
    <span
      className={`azulejo-logo flex items-center justify-center overflow-hidden ${
        flexivel ? "max-w-full px-4" : "shrink-0"
      }`}
      style={{
        width: modoFixo ? largura : undefined,
        height: altura,
        // Respiro interno UNIFORME no modo marquee: todos os logos ficam à mesma
        // distância das bordas do tile, independentemente do asset.
        padding: modoFixo ? PAD_TILE : undefined,
        // Sem backgroundColor por logo — o card traz fundo embutido e o legado
        // renderiza-se "como vem" (uniforme sob o dim/desfoque do efeito).
      }}
    >
      <LocalImage
        src={logo.src}
        alt={altOculto ? "" : logo.alt}
        width={logo.width}
        height={logo.height}
        className="w-auto object-contain"
        style={
          modoFixo
            ? {
                // Tile fixo: o logo encaixa inteiro (aspect preservado), centrado
                // dentro do padding uniforme — object-contain sem distorção.
                maxWidth: "100%",
                maxHeight: "100%",
              }
            : {
                // Modo flexível: altura DEFINIDA + width auto → a largura deriva
                // da proporção intrínseca (atributos width/height). maxWidth: 100%
                // só limita quando o azulejo encolhe (mobile).
                height: altura,
                maxWidth: "100%",
              }
        }
      />
    </span>
  );
}