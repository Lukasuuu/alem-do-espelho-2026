import { ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "loading" | "decoding"> & {
  alt: string;
  /** Largura intrínseca da imagem (px) — evita layout shift. */
  width: number;
  /** Altura intrínseca da imagem (px) — evita layout shift. */
  height: number;
};

/**
 * Imagem servida directamente de /public, sem o optimizador `/_next/image`.
 *
 * Usada quando a imagem vive sob o subdirectório da página
 * (/alem-do-espelho-2026/...) e o optimizador não é fiável nesse cenário,
 * ou quando se pretende o asset original sem re-encode WebP/PNG.
 */
export default function LocalImage({ alt, width, height, ...rest }: Props) {
  return (
    <img
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  );
}
