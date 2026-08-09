import LocalImage from "./LocalImage";
import type { Patrocinador } from "@/lib/patrocinadores";

/**
 * Azulejo de marca — logo com fundo próprio dentro de um contentor, cantos
 * arredondados.
 *
 * ⚠️ FUNDO DELIBERADO: os logos têm fundo baked-in e incompatível entre si
 * (Chama navy #00040c, Lígia creme #EDE6D8). Remover o fundo eliminaria parte
 * do desenho (testado: -10,4% no Chama). Por isso o fundo de cada logo fica
 * VISÍVEL — o letterbox do object-contain funde-se no fundo da caixa.
 *
 * Dois modos:
 *  - MARQUEE (caixa fixa): `largura` definido → caixa 180×72, sem padding,
 *    logo centrado com maxWidth/maxHeight 100% (object-contain). A largura
 *    uniforme faz o ciclo do marquee ser periódico e sem costura.
 *  - ESTÁTICO (`flexivel`): encolhe até ao pai, sem esticar o logo.
 *
 * As micro-interações de isolamento de foco (opacity/blur + escala no hover)
 * são aplicadas por CSS contextual em .marquee-foco (globals.css) — fora do
 * marquee o tile fica neutro.
 */
type Props = {
  logo: Patrocinador["logo"];
  /**
   * Altura da caixa em px. Default 72 (desktop).
   */
  altura?: number;
  /**
   * Largura FIXA da caixa em px — modo marquee (ex.: 180). Quando presente,
   * o logo é normalizado para dentro da caixa e não leva padding.
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

export default function AzulejoLogo({
  logo,
  altura = 72,
  largura,
  altOculto = false,
  flexivel = false,
}: Props) {
  const modoFixo = typeof largura === "number" && !flexivel;

  return (
    <span
      className={`azulejo-logo flex items-center justify-center overflow-hidden rounded-lg ${
        flexivel ? "max-w-full px-4" : "shrink-0"
      }`}
      style={{
        width: modoFixo ? largura : undefined,
        height: altura,
        backgroundColor: logo.fundoHex,
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
                // Caixa fixa: o logo encaixa inteiro (aspect preservado), centrado.
                // maxWidth+maxHeight 100% → object-contain sem distorção; o
                // letterbox é invisível porque o fundo da caixa = fundo do logo.
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
