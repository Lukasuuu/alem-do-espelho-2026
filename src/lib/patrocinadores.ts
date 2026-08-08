/**
 * Vitrine de patrocinadoras — fonte única dos registos.
 *
 * Duas categorias, NUNCA misturadas no mesmo grid:
 *  - patrocinador    → grupo "Patrocinadores"
 *  - apoio_tecnico   → grupo "Apoio técnico"
 *
 * Títulos: usam o título do logo/identidade pública de cada uma.
 * Histórias e citações são PLACEHOLDER — aguardam aprovação escrita
 * das patrocinadoras antes de serem publicadas. Enquanto estiverem vazios,
 * o componente não as renderiza (nada de texto falso em produção).
 */

export type CategoriaPatrocinador = "patrocinador" | "apoio_tecnico";

export type Patrocinador = {
  id: string;
  nome: string;
  /** Título profissional — vem do logo/identidade pública da marca. */
  titulo: string;
  categoria: CategoriaPatrocinador;
  foto: { src: string; alt: string; width: number; height: number };
  logo: {
    src: string;
    alt: string;
    width: number;
    height: number;
    /** Hex do fundo do tile — deve combinar com o background baked-in do logo. */
    fundoHex: string;
  };
  /** História curta (2-3 linhas) — PLACEHOLDER, não publicar sem aprovação. */
  historia: string;
  /** Citação em destaque — PLACEHOLDER, não publicar sem aprovação. */
  citacao: string;
};

export const patrocinadores: Patrocinador[] = [
  {
    id: "ligia-santos",
    nome: "Lígia Santos",
    titulo: "Contabilista & Educadora Financeira",
    categoria: "patrocinador",
    foto: {
      src: "/patrocinadoras/ligia-santos-4x5.webp",
      alt: "Retrato de Lígia Santos, contabilista e educadora financeira",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadoras/logo-ligia-santos.webp",
      alt: "Logótipo de Lígia Santos — Esmero nas Finanças",
      width: 359,
      height: 120,
      // Fundo baked-in do logo (warm creme, amostrado do asset)
      fundoHex: "#E4D9C9",
    },
    // AGUARDA APROVAÇÃO — não publicar sem confirmação escrita da Lígia.
    historia: "",
    citacao: "",
  },
  {
    id: "lucas-gabriel",
    nome: "Lucas Gabriel",
    titulo: "Engenheiro de Prompt & Desenvolvedor Full Stack IA",
    categoria: "apoio_tecnico",
    foto: {
      src: "/patrocinadoras/lucas-gabriel-4x5.webp",
      alt: "Retrato de Lucas Gabriel, engenheiro de prompt e desenvolvedor full stack IA",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadoras/logo-chama-mark.webp",
      alt: "Logótipo Chama",
      width: 240,
      height: 240,
      // Fundo baked-in do logo (navy escuro, amostrado do asset)
      fundoHex: "#0D1A2C",
    },
    historia: "",
    citacao: "",
  },
];
