/**
 * Vitrine de patrocinadores — fonte única dos registos.
 *
 * Todos os registos são patrocinadores — não há distinção de categoria
 * (Lucas Gabriel é PATROCINADOR, não "apoio técnico"). O cartão é horizontal:
 * [foto 4:5 ~170px] [coluna de conteúdo ~400px], empilhado em mobile.
 *
 * Títulos: usam o título do logo/identidade pública de cada uma.
 * Histórias e citações são PLACEHOLDER — aguardam aprovação escrita
 * dos patrocinadores antes de serem publicadas. Enquanto estiverem vazios,
 * o componente não as renderiza (nada de texto falso em produção).
 */

export type Patrocinador = {
  id: string;
  nome: string;
  /** Título profissional — vem do logo/identidade pública da marca. */
  titulo: string;
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
    foto: {
      src: "/patrocinadores/ligia-santos-4x5.webp",
      alt: "Retrato de Lígia Santos, contabilista e educadora financeira",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-ligia-santos.webp",
      alt: "Logótipo de Lígia Santos — Esmero nas Finanças",
      // Faixa do logo: altura 72px, object-fit contain — proporção real do asset.
      width: 1081,
      height: 200,
      // Fundo baked-in do logo (warm creme, amostrado do asset)
      fundoHex: "#EDE6D8",
    },
    // AGUARDA APROVAÇÃO — não publicar sem confirmação escrita da Lígia.
    historia: "",
    citacao: "",
  },
  {
    id: "lucas-gabriel",
    nome: "Lucas Gabriel",
    titulo: "Engenheiro de Prompt & Desenvolvedor Full Stack IA",
    foto: {
      src: "/patrocinadores/lucas-gabriel-4x5.webp",
      alt: "Retrato de Lucas Gabriel, engenheiro de prompt e desenvolvedor full stack IA",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-chama-mark.webp",
      alt: "Logótipo Chama",
      // Quadrado — 74x74 a 72px de altura, fica ao lado do nome sem ocupar a coluna.
      width: 360,
      height: 360,
      // Fundo baked-in do logo (navy escuro, amostrado do asset)
      fundoHex: "#00040c",
    },
    historia: "",
    citacao: "",
  },
];
