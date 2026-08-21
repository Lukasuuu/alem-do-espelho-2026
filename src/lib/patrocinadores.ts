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
 *
 * Campo `descricao` (opcional): 1–2 linhas, ~90–140 caracteres, para
 * preencher o espaço vertical ao lado da foto nos graus 1 e 2.
 * Só renderiza quando preenchido E aprovado pela Vitória.
 *
 * HIERARQUIA VISUAL (Lucas, 16/08): o campo `destaque` define o peso
 * visual do cartão — 1 = mais destaque, 3 = base. É indicativo interno,
 * NUNCA exposto em texto, alt, aria ou nome de classe CSS. O mapeamento
 * metal→cor vive só aqui, num comentário, e não deve ser exposto.
 *
 *   destaque: 1 → fio 1  (#C9A227 → #E8C766)  — dourado quente
 *   destaque: 2 → fio 2  (#A8AAAD → #D4D6D9)  — prata frio
 *   destaque: 3 → fio 3  (#9C6B4A → #C08A63)  — bronze acobreado
 */

/** Tokens visuais do fio decorativo por grau de destaque.
 *  Chaves nomeadas por função (fio-1, fio-2, fio-3), NÃO por metal.
 *  O mapeamento metal→cor é apenas documentação no comentário acima.
 */
export const FIO_TOKENS = {
  "fio-1": {
    // dourado quente
    gradiente: "linear-gradient(135deg, #C9A227 0%, #E8C766 100%)",
    espessura: 2,
    opacidade: 1,
    glow: "0 0 8px 2px rgba(201, 162, 39, 0.35)",
  },
  "fio-2": {
    // prata frio — realce especular a 45% dá o brilho metálico
    gradiente: "linear-gradient(135deg, #8E9194 0%, #E8EAEC 45%, #B9BCBF 100%)",
    espessura: 2,
    opacidade: 1,
    glow: "0 0 10px 2px rgba(212, 214, 217, 0.45)",
  },
  "fio-3": {
    // bronze acobreado — mesmo princípio, um tom abaixo do prata
    gradiente: "linear-gradient(135deg, #8A5A3B 0%, #D9A277 45%, #A06D4B 100%)",
    espessura: 1.5,
    opacidade: 0.9,
    glow: "0 0 8px 1px rgba(192, 138, 99, 0.30)",
  },
} as const;

export type FioTokenKey = keyof typeof FIO_TOKENS;

export type Patrocinador = {
  id: string;
  nome: string;
  /** Título profissional — vem do logo/identidade pública da marca. */
  titulo: string;
  /** Descrição curta (1-2 linhas) — só graus 1 e 2. Aguarda aprovação da Vitória. */
  descricao?: string;
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
  /** Se true, esconde o título profissional (útil quando a descrição o torna redundante). */
  ocultarTitulo?: boolean;
  /** Se true, esconde o nome em texto ao lado do logo. Usar quando o nome
   *  JÁ está desenhado dentro do logo (ex: a Lígia) — evita duplicação
   *  visual. NÃO derivar de ocultarTitulo: são independentes. Um logo pode
   *  conter o nome mas não o título, ou o contrário. */
  ocultarNome?: boolean;
  /**
   * Grau de destaque visual (1 = maior). Indicativo interno — NUNCA
   * exposto em texto, alt, aria ou nome de classe.
   * 1 = fio 1 (dourado), 2 = fio 2 (prata), 3 = fio 3 (bronze).
   */
  destaque: 1 | 2 | 3;
  /**
   * Se true, o patrocinador aparece na vitrine da Modal A.
   * Se false, o registo permanece no ficheiro mas NÃO é renderizado.
   * OCULTO até chegarem foto, logo e título confirmados. Ver CLAUDE.md.
   */
  visivel: boolean;
};

/**
 * Retorna apenas os patrocinadores com visivel === true.
 * Único ponto de filtro — nunca usar .filter() espalhado por componentes.
 */
export function patrocinadoresVisiveis(): Patrocinador[] {
  return patrocinadores.filter((p) => p.visivel);
}

export const patrocinadores: Patrocinador[] = [
  {
    id: "ligia-santos",
    nome: "Lígia Santos",
    titulo: "Contabilista & Educadora Financeira",
    descricao: "Ajudando mulheres a olhar para as suas finanças sem medo, com clareza e método.",
    foto: {
      src: "/patrocinadores/ligia-santos-4x5.webp",
      alt: "Retrato de Lígia Santos, contabilista e educadora financeira",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-ligia-santos.webp",
      alt: "Logótipo Lígia Santos",
      // Faixa do logo: altura 64px (≥1280) ou 56px (<1280), object-fit contain,
      // proporção real do asset (5,41:1).
      width: 1081,
      height: 200,
      // Fundo baked-in do logo (warm creme, amostrado do asset)
      fundoHex: "#EDE6D8",
    },
    // AGUARDA APROVAÇÃO — não publicar sem confirmação escrita da Lígia.
    historia: "",
    citacao: "",
    // Grau 1: nome já está desenhado dentro da própria imagem do logo
    // (wordmark "Lígia Santos"). Para evitar duplicação visual, escondemos
    // o <span>{nome}</span> que o CartaoPatrocinadora renderiza ao lado.
    // O título profissional mantém-se visível (não está no logo).
    ocultarTitulo: false,
    ocultarNome: true,
    destaque: 1,
    visivel: true,
  },
  {
    id: "tereza-moura",
    nome: "Tereza Moura",
    titulo: "Especialista em Realização Pessoal Feminina",
    descricao: "Ajudando mulheres a olhar para si e a construir a vida que desejam viver. Experiência voltada pra si.",
    foto: {
      src: "/patrocinadores/tereza-moura-4x5.webp",
      alt: "Retrato de Tereza Moura, especialista em realização pessoal feminina",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-tereza-moura.webp",
      alt: "Logótipo de Tereza Moura",
      width: 584,
      height: 200,
      fundoHex: "#000000",
    },
    // AGUARDA APROVAÇÃO — descricao aprovada pelo Lucas; falta aprovar história/citação.
    historia: "",
    citacao: "",
    destaque: 2,
    visivel: true,
  },
  {
    id: "vanessa-rosa",
    nome: "Vanessa Rosa",
    titulo: "Vanessa Rosa Sabores",
    descricao: "Delicadeza em forma de sabor. Arte comestível para momentos especiais. Mais que bolo, experiências doces.",
    foto: {
      src: "/patrocinadores/vanessa-rosa-4x5.webp",
      alt: "Retrato de Vanessa Rosa, Vanessa Rosa Sabores",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-vanessa-rosa.webp",
      alt: "Logótipo Vanessa Rosa Sabores",
      width: 307,
      height: 200,
      // Fundo baked-in do logo (rosa claro, amostrado do asset)
      fundoHex: "#E6CFDD",
    },
    // AGUARDA APROVAÇÃO — descricao aprovada pelo Lucas; falta aprovar história/citação.
    historia: "",
    citacao: "",
    destaque: 2,
    visivel: true,
  },
  {
    id: "andreia-ferreira",
    nome: "Andreia Ferreira",
    titulo: "Consultora Imobiliária",
    descricao: "Acompanha-te na procura da tua nova casa, do primeiro contacto às chaves na mão.",
    foto: {
      src: "/patrocinadores/andreia-ferreira-4x5.webp",
      alt: "Retrato de Andreia Ferreira, consultora imobiliária",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-andreia-ferreira.webp",
      alt: "Logótipo de Andreia Ferreira, consultora imobiliária zZome Real Estate",
      width: 190,
      height: 200,
      // Fundo baked-in do logo (azul-marinho, amostrado do asset — atualizado
      // 20/08/2026 para a nova versão do logo, com selo zZome Real Estate)
      fundoHex: "#052539",
    },
    // AGUARDA APROVAÇÃO — não publicar sem confirmação escrita da Andreia.
    historia: "",
    citacao: "",
    destaque: 2,
    visivel: true,
  },
  {
    id: "kel-barbearia",
    nome: "Kel Barbearia",
    titulo: "Barbearia desde 2008",
    descricao: "Barbeiro profissional com experiência desde 2008, um verdadeiro conceito em estilos de cabelo para os seus clientes.",
    foto: {
      src: "/patrocinadores/kel-barbearia-4x5.webp",
      alt: "Retrato do barbeiro da Kel Barbearia",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-kel-barbearia.webp",
      alt: "Logótipo Kel Barbearia",
      width: 275,
      height: 200,
      fundoHex: "#FEFEFE",
    },
    // AGUARDA APROVAÇÃO — descricao aprovada pelo Lucas; falta aprovar história/citação.
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
  {
    id: "yeshua",
    nome: "Yeshua",
    titulo: "Centro de Cuidado Integrado",
    descricao: "Estética natural com produtos 100% naturais, do início ao fim. Uma referência em estética natural em Portugal.",
    foto: {
      src: "/patrocinadores/yeshua-4x5.webp",
      alt: "Retrato da representante do Yeshua, Centro de Cuidado Integrado",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-yeshua.webp",
      alt: "Logótipo Yeshua, Centro de Cuidado Integrado",
      width: 702,
      height: 200,
      fundoHex: "#000000",
    },
    // AGUARDA APROVAÇÃO — descricao aprovada pelo Lucas; falta aprovar história/citação.
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
  {
    id: "renata-parreira",
    nome: "Renata Parreira",
    titulo: "Reta Comunicação",
    descricao: "Ajudando marcas a encontrar a própria voz, entre conteúdo, palco e formação.",
    foto: {
      src: "/patrocinadores/renata-parreira-4x5.webp",
      alt: "Retrato de Renata Parreira, Reta Comunicação",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-reta-comunicacao.webp",
      alt: "Logótipo Reta Comunicação",
      width: 372,
      height: 200,
      // Fundo baked-in do logo (branco, amostrado do asset)
      fundoHex: "#FFFFFF",
    },
    // AGUARDA APROVAÇÃO — não publicar sem confirmação escrita da Renata.
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
  {
    id: "leandrinho",
    // id mantido (não há motivo para arriscar renomear); nome alinhado com a
    // marca do logo. Texto do site usa "leandro design" (um "n"); o FICHEIRO do
    // logótipo (logo-leandro-design.webp) ainda mostra "leanndro" (dois "n") —
    // só o Leandro o pode refazer. Não editar a imagem.
    nome: "Leandro",
    titulo: "leandro design",
    descricao: "A identidade por trás da música, dos eventos e marcas. +100 Milhões de visualizações em projetos assinados.",
    foto: {
      src: "/patrocinadores/leandro-design-4x5.webp",
      alt: "Retrato de Leandro, leandro design",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-leandro-design.webp",
      alt: "Logótipo leandro design",
      width: 603,
      height: 200,
      fundoHex: "#000000",
    },
    // AGUARDA APROVAÇÃO — descricao aprovada pelo Lucas; falta aprovar história/citação.
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
  {
    id: "daniella-galiani",
    nome: "Daniella Galiani",
    titulo: "Daniella Galiani Photography",
    descricao: "Fotografando histórias reais e os momentos que ficam para sempre depois de cada festa acabar.",
    foto: {
      src: "/patrocinadores/daniella-galiani-4x5.webp",
      alt: "Retrato de Daniella Galiani",
      width: 640,
      height: 800,
    },
    logo: {
      src: "/patrocinadores/logo-daniella-galiani.webp",
      alt: "Logótipo Daniella Galiani Photography",
      // Proporção real do asset novo (logo refeito com padding uniforme 7%).
      // 292×200 dá ratio 1,46:1 (não 1,55 do ficheiro bruto), respeita a área
      // activa visível — ver C6 no histórico.
      width: 292,
      height: 200,
      // Fundo baked-in do logo (off-white, amostrado do asset)
      fundoHex: "#FCFBFC",
    },
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
  {
    id: "lucas-gabriel",
    nome: "Lucas Gabriel",
    titulo: "Engenheiro de Prompt & Desenvolvedor Full Stack IA",
    descricao: "Criando Landing Pages, Sites e Aplicações que transformam a vida dos clientes, com código e estratégia para tornar sonhos em realidade.",
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
      fundoHex: "#010C1B",
    },
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
];