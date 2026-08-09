import LocalImage from "./LocalImage";
import type { Patrocinador } from "@/lib/patrocinadores";

/**
 * Azulejo de marca — logo com fundo próprio dentro de um contentor de altura
 * fixa, cantos arredondados e padding interno uniforme.
 *
 * ⚠️ FUNDO DELIBERADO: os logos têm fundo baked-in e incompatível entre si
 * (Chama navy #00040c, Lígia creme #EDE6D8). Remover o fundo eliminaria parte
 * do desenho (testado: -10,4% no Chama) e opacity/grayscale produziriam blocos
 * cinzentos sobre fundos opacos. Por isso o fundo de cada logo fica VISÍVEL.
 *
 * As micro-interações de isolamento de foco (opacity/blur/grayscale + escala
 * no hover) são aplicadas por CSS contextual em .marquee-foco (globals.css) —
 * fora do marquee (fila estática em prefers-reduced-motion) o tile fica neutro.
 */
const ALTURA_AZULEJO = 72;

type Props = {
  logo: Patrocinador["logo"];
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

export default function AzulejoLogo({ logo, altOculto = false, flexivel = false }: Props) {
  return (
    <span
      className={`azulejo-logo flex items-center justify-center overflow-hidden rounded-lg px-4 ${
        flexivel ? "max-w-full" : "shrink-0"
      }`}
      style={{ height: ALTURA_AZULEJO, backgroundColor: logo.fundoHex }}
    >
      <LocalImage
        src={logo.src}
        alt={altOculto ? "" : logo.alt}
        width={logo.width}
        height={logo.height}
        className="w-auto object-contain"
        style={{
          // Altura DEFINIDA (72px) + width auto → a largura deriva da proporção
          // intrínseca (atributos width/height). maxWidth: 100% só limita quando
          // o azulejo encolhe (mobile); o object-contain evita distorção/clipping
          // e o letterbox fica invisível porque o fundo do tile = fundo do logo.
          height: ALTURA_AZULEJO,
          maxWidth: "100%",
        }}
      />
    </span>
  );
}
