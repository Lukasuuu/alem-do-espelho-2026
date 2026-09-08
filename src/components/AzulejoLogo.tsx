import LocalImage from "./LocalImage";
import type { Patrocinador } from "@/lib/patrocinadores";

/**
 * Azulejo de marca — card de logo pré-renderizado 1024×1024 dentro de uma
 * caixa de encaixe.
 *
 * ⚠️ SEM SOBREPOSIÇÃO (correção pós-r3): os assets são cards com fundo de
 * marca, cantos (~11%) e borda JÁ EMBUTIDOS no ficheiro .webp. O contentor
 * NÃO aplica background-color, padding, border-radius nem border — só
 * object-contain centrado, tal-e-qual.
 *
 * Dois modos:
 *  - MARQUEE (caixa fixa): `largura` definido → caixa quadrada 96×96, logo
 *    centrado com maxWidth/maxHeight 100% (object-contain). A largura
 *    uniforme faz o ciclo do marquee ser periódico e sem costura.
 *  - ESTÁTICO (`flexivel`): encolhe até ao pai, sem esticar o logo.
 *
 * As micro-interações de isolamento de foco (opacity/blur + escala no hover)
 * são aplicadas por CSS contextual em .marquee-foco (globals.css) — fora do
 * marquee o tile fica neutro.
 */
type Props = {
  logo: NonNullable<Patrocinador["logo"]>;
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
   * Classe CSS que define a caixa (ex.: .caixa-logo-marquee 16:9 com clamp
   * responsivo). Quando presente, NENHUM width/height inline é escrito —
   * o CSS manda (aspect-ratio + clamp); a imagem encaixa com contain.
   */
  classe?: string;
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
  classe,
  altOculto = false,
  flexivel = false,
}: Props) {
  const modoClasse = typeof classe === "string" && classe !== "";
  const modoFixo = typeof largura === "number" && !flexivel && !modoClasse;

  return (
    <span
      className={`azulejo-logo flex items-center justify-center overflow-hidden ${
        flexivel ? "max-w-full" : "shrink-0"
      } ${modoClasse ? classe : ""}`}
      style={
        modoClasse
          ? undefined
          : {
              width: modoFixo ? largura : undefined,
              height: altura,
            }
      }
    >
      <LocalImage
        src={logo.src}
        alt={altOculto ? "" : logo.alt}
        width={logo.width}
        height={logo.height}
        className="w-auto object-contain"
        style={
          modoClasse
            ? {
                // Caixa via CSS: a imagem encaixa inteira, centrada, sem
                // distorção (o aspect-ratio da caixa vem do CSS).
                maxWidth: "100%",
                maxHeight: "100%",
              }
            : modoFixo
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
