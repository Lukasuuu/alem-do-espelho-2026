import LocalImage from "./LocalImage";
import type { Patrocinador } from "@/lib/patrocinadores";

/**
 * Azulejo de marca (REESCRITA) — logo com fundo próprio dentro de um contentor
 * de altura fixa, cantos arredondados e padding interno uniforme.
 *
 * ⚠️ FUNDO DELIBERADO: os logos têm fundo baked-in e incompatível entre si
 * (Chama navy #0D1A2C, Lígia creme #E4D9C9). Remover o fundo eliminaria parte
 * do desenho (testado: -10,4% no Chama) e opacity/grayscale produziriam blocos
 * cinzentos sobre fundos opacos. Por isso o fundo de cada logo fica VISÍVEL.
 *
 * Quando existirem versões com fundo transparente, trocar os ficheiros em
 * /public/patrocinadoras e remover este azulejo (o <img> passa a ficar direto
 * na faixa).
 */
const ALTURA_AZULEJO = 72;
const PADDING_H = 16; // px-4 — padding interno uniforme

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
      className={`flex items-center justify-center overflow-hidden rounded-lg px-4 ${
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
