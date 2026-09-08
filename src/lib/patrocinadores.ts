/**
 * Vitrine de patrocinadores — fonte única dos registos.
 *
 * Todos os registos são patrocinadores — não há distinção de categoria
 * (Lucas Gabriel é PATROCINADOR, não "apoio técnico").
 *
 * CARD (r3, "modelo Paulo Faustino"): stack vertical centrado, fundido no
 * fundo da página (sem caixa). Layout por `tipo`:
 *   - "pessoa" → foto 4:5 à largura do card → NOME → ◆ → cargo itálico →
 *     logo no meio → tagline → chevron → MISSÃO.
 *   - "marca" (logo-só, sem pessoa) → logo grande no lugar da foto → NOME →
 *     ◆ → cargo → tagline → chevron → MISSÃO. Nunca foto e logo no mesmo slot.
 *
 * Títulos: usam o título do logo/identidade pública de cada um. Quando o
 * patrocinador é uma pessoa com marca (Kel Barber/KEL Barbearia, Walcília
 * Ferreira/Yeshua), a marca entra na linha do cargo — decisão do Lucas (r3).
 * Histórias e citações são PLACEHOLDER — aguardam aprovação escrita
 * dos patrocinadores antes de serem publicadas. Enquanto estiverem vazios,
 * o componente não as renderiza (nada de texto falso em produção).
 *
 * HIERARQUIA VISUAL (Lucas, 16/08): o campo `destaque` define o peso
 * visual do cartão — 1 = mais destaque, 3 = base. É indicativo interno,
 * NUNCA exposto em texto, alt, aria ou nome de classe CSS. O mapeamento
 * metal→cor vive só aqui, num comentário, e não deve ser exposto.
 *
 *   destaque: 1 → tier 1  (#C9A227 → #E8C766)  — dourado quente
 *   destaque: 2 → tier 2  (#A8AAAD → #D4D6D9)  — prata frio
 *   destaque: 3 → tier 3  (#9C6B4A → #C08A63)  — bronze acobreado
 */

/**
 * Tokens de acento metálico por grau de destaque (r3).
 * Chaves nomeadas por função (tier-1, tier-2, tier-3), NÃO por metal.
 * O mapeamento metal→cor é apenas documentação no comentário acima.
 *
 * `gradiente` — fio da foto e separadores finos (border-image).
 * `espessura` / `opacidade` — border-width e opacity do fio (herdados dos
 * FIO_TOKENS de produção, card horizontal).
 * `acento` / `acentoEscuro` — cor sólida do acento (nome, ◆, anel do
 * chevron, rótulo MISSÃO) sobre fundo claro (creme) e escuro (modal),
 * respetivamente. Contraste validado (display grande ≥3:1):
 *   tier-1  3,99:1 claro / 6,56:1 escuro
 *   tier-2  4,32:1 claro / 9,64:1 escuro
 *   tier-3  5,13:1 claro / 5,34:1 escuro
 */
export const TIER_TOKENS = {
  "tier-1": {
    // dourado quente
    gradiente: "linear-gradient(135deg, #C9A227 0%, #E8C766 100%)",
    espessura: 2,
    opacidade: 1,
    acento: "#8F7319",
    acentoEscuro: "#C9A227",
    glow: "0 0 8px 2px rgba(201, 162, 39, 0.35)",
  },
  "tier-2": {
    // prata frio — realce especular a 45% dá o brilho metálico
    gradiente: "linear-gradient(135deg, #8E9194 0%, #E8EAEC 45%, #B9BCBF 100%)",
    espessura: 2,
    opacidade: 1,
    acento: "#6E7175",
    acentoEscuro: "#C7CACC",
    glow: "0 0 10px 2px rgba(212, 214, 217, 0.45)",
  },
  "tier-3": {
    // bronze acobreado — mesmo princípio, um tom abaixo do prata
    gradiente: "linear-gradient(135deg, #8A5A3B 0%, #D9A277 45%, #A06D4B 100%)",
    espessura: 1.5,
    opacidade: 0.9,
    acento: "#8A5A3B",
    acentoEscuro: "#C08A63",
    glow: "0 0 8px 1px rgba(192, 138, 99, 0.30)",
  },
} as const;

export type TierTokenKey = keyof typeof TIER_TOKENS;

export type Patrocinador = {
  id: string;
  nome: string;
  /** Título profissional — vem do logo/identidade pública da marca.
   *  Para pessoa com marca, a marca entra aqui na linha do cargo
   *  (ex.: "KEL Barbearia · Barbearia desde 2008") — decisão r3. */
  titulo: string;
  /**
   * Layout do card (r3, "modelo Paulo Faustino"):
   *  - "pessoa": foto no topo, logo no meio do stack.
   *  - "marca": logo grande no topo (sem foto de pessoa), sem repetição.
   * Regra geral do Lucas: tem foto de pessoa → "pessoa"; senão → "marca".
   * Hoje só a Novex é "marca".
   */
  tipo: "pessoa" | "marca";
  /** Descrição curta (1-2 linhas) — fallback do texto revelado quando a
   *  `historia` está vazia (toggle MISSÃO). */
  descricao?: string;
  /** Tagline/tema em negrito curto (ex.: "Jornada de Vendas & Marketing
   *  Simplificado"). OPCIONAL — renderiza a linha só quando preenchida. */
  tagline?: string;
  /** Foto 4:5 — OPCIONAL: Novex (marca) entra sem foto; Gracy tem foto
   *  mas não tem logo. */
  foto?: { src: string; alt: string; width: number; height: number };
  /** Logo — OPCIONAL: a Gracy entra só com foto. */
  logo?: {
    src: string;
    alt: string;
    width: number;
    height: number;
    /**
     * "card" (r2→r3): o asset é um card pré-renderizado 1600×900 (16:9) com fundo
     * de marca, cantos (~11%) e borda JÁ EMBUTIDOS — renderizar tal-e-qual
     * (object-fit contain, SEM background/borda/radius/padding CSS).
     * Todos os 14 logos são hoje cards; o campo distingue o contrato do asset.
     */
    estilo?: "card";
  };
  /** História curta (2-3 linhas) — publicar só com aprovação escrita. */
  historia: string;
  /** Citação em destaque — PLACEHOLDER, não publicar sem aprovação. */
  citacao: string;
  /**
   * Selo visível no cartão (ex.: "Ouro" — Bloco I). Campo mantido nos dados,
   * mas NÃO renderizado desde a ronda showcase (a ordem da grelha basta).
   */
  selo?: string;
  /** Se true, esconde o título profissional (útil quando a descrição o torna redundante). */
  ocultarTitulo?: boolean;
  /** Legado (Bloco I): escondia o nome quando estava desenhado no logo.
   *  Desde a r3 o nome aparece SEMPRE por baixo da foto/logo — o campo
   *  mantém-se no tipo, todos os registos estão a false. */
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
 * A ordem do array (ouro → prata → bronze) define a ordem da grelha —
 * Novex em 1.º.
 */
export function patrocinadoresVisiveis(): Patrocinador[] {
  return patrocinadores.filter((p) => p.visivel);
}

export const patrocinadores: Patrocinador[] = [
  {
    // ── OURO (Bloco I, ordem confirmada pelo Lucas: Novex → Lígia → Luci →
    // Renata → Naty → Gracy → Patrícia; depois prata/bronze como estavam) ──
    id: "novex",
    nome: "Novex",
    titulo: "Cuidados capilares · Embelleze",
    // Único patrocínio "marca" (sem pessoa) — logo grande no lugar da foto.
    tipo: "marca",
    // Sem foto (r3: layout marca — logo no topo, sem coluna de foto).
    logo: {
      src: "/patrocinadores/logo-novex.webp",
      alt: "Logótipo Novex",
      // Card pré-renderizado 1600×900 (16:9) (fundo de marca + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // Texto adaptado pelo Claude (Bloco I) do material enviado pelo Lucas —
    // o original tinha citações truncadas de pesquisa ("[1, 2, 3…]").
    historia:
      "A Novex é a principal marca de cuidados capilares do grupo Embelleze, fundado em 1969 — célebre pelos cremes de tratamento profundo ultraconcentrados (os icónicos potes de 1 kg) e por fórmulas 100% veganas e cruelty-free. Focada na nutrição profunda e na reconstrução dos fios, é hoje uma das marcas brasileiras de cabelo mais conhecidas do mundo.",
    citacao: "",
    // r3: o nome aparece sempre por baixo do logo (modelo Paulo Faustino).
    ocultarNome: false,
    selo: "Ouro",
    destaque: 1,
    visivel: true,
  },
  {
    id: "ligia-santos",
    nome: "Lígia Santos",
    titulo: "Contabilista & Educadora Financeira",
    tipo: "pessoa",
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
      // Card pré-renderizado 1600×900 (16:9) (fundo creme + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // AGUARDA APROVAÇÃO — não publicar sem confirmação escrita da Lígia.
    historia: "",
    citacao: "",
    // r3: o nome aparece sempre por baixo da foto (modelo Paulo Faustino),
    // mesmo estando também desenhado no logo.
    ocultarTitulo: false,
    ocultarNome: false,
    // OURO (Bloco I): selo igual aos restantes ouro — "cada patrocinador
    // OURO com selo 'Ouro'" (pedido do Lucas).
    selo: "Ouro",
    destaque: 1,
    visivel: true,
  },
  {
    // OURO (Bloco I) — foto + logo com o nome desenhado (fundo azul em
    // gradiente; fundoHex = tom médio das bordas amostradas, letterbox invisível).
    id: "luci-maritan",
    nome: "Luci Maritan",
    titulo: "Mentora & Psicanalista",
    tipo: "pessoa",
    foto: {
      src: "/patrocinadores/luci-maritan-foto.webp",
      alt: "Retrato de Luci Maritan, mentora e psicanalista",
      width: 804,
      height: 1200,
    },
    logo: {
      src: "/patrocinadores/logo-luci-maritan.webp",
      alt: "Logótipo Luci Maritan",
      // Card pré-renderizado 1600×900 (16:9) (fundo azul + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // Texto verbatim aprovado pelo Lucas (Bloco I).
    historia:
      "Mentora, psicanalista e palestrante. Ajuda mulheres a resgatar a sua identidade e a transformar resultados, sem culpa e sem perder o que lhes é caro — porque a perceção que a mulher tem de si estabelece o teto da própria vida.",
    citacao: "",
    // r3: o nome aparece sempre por baixo da foto (modelo Paulo Faustino).
    ocultarNome: false,
    selo: "Ouro",
    destaque: 1,
    visivel: true,
  },
  {
    // OURO (Bloco I) — promovida de bronze (destaque 3 → 1). Mesma foto e
    // logo; texto verbatim aprovado pelo Lucas. A `descricao` antiga mantém-se.
    id: "renata-parreira",
    nome: "Renata Parreira",
    titulo: "Reta Comunicação",
    tipo: "pessoa",
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
      // Card pré-renderizado 1600×900 (16:9) (fundo branco + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // Texto verbatim aprovado pelo Lucas (Bloco I).
    historia:
      "Jornalista e mestre em Comunicação Social pela Universidade Católica Portuguesa, fundou há 10 anos a Reta Comunicação. Criadora do método Sua Voz, Sua Marca, ajuda pessoas e empresas a comunicar com clareza, conexão e confiança — porque “não basta ser visto, é preciso ser sentido”.",
    citacao: "",
    selo: "Ouro",
    destaque: 1,
    visivel: true,
  },
  {
    // OURO (Bloco I) — Naty Ribeiro / Editora Florescer. Logo com fundo
    // verde-oliva opaco (fundoHex amostrado do asset, letterbox invisível).
    id: "editora-florescer",
    nome: "Naty Ribeiro",
    titulo: "Editora Florescer",
    tipo: "pessoa",
    foto: {
      src: "/patrocinadores/naty-ribeiro-foto.webp",
      alt: "Retrato de Naty Ribeiro, Editora Florescer",
      width: 799,
      height: 1200,
    },
    logo: {
      src: "/patrocinadores/logo-florescer.webp",
      alt: "Logótipo Editora Florescer",
      // Card pré-renderizado 1600×900 (16:9) (fundo verde-oliva + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // Texto verbatim aprovado pelo Lucas (Bloco I).
    historia:
      "Mentora, terapeuta, escritora e palestrante. Aborda identidade, cura emocional, relacionamentos e propósito, a partir da restauração da identidade em Cristo. À frente da Editora Florescer, acompanha autores e transforma histórias em livros que alcançam vidas.",
    citacao: "",
    selo: "Ouro",
    destaque: 1,
    visivel: true,
  },
  {
    // OURO (Bloco I) — SEM logo: no card (r3) salta o slot do logo no meio
    // do stack; foto → nome → ◆ → cargo → chevron → MISSÃO.
    id: "gracy-azevedo",
    nome: "Gracy Azevedo",
    titulo: "Coach de CrossFit & Criadora de Conteúdo",
    tipo: "pessoa",
    foto: {
      src: "/patrocinadores/gracy-azevedo-foto.webp",
      alt: "Retrato de Gracy Azevedo, coach de CrossFit",
      width: 900,
      height: 1200,
    },
    // Texto verbatim aprovado pelo Lucas (Bloco I).
    historia:
      "Coach de CrossFit, criadora de conteúdo e apaixonada por saúde, movimento e fé. Depois da sua própria transformação, inspira mulheres a cuidar do corpo com intenção e propósito — porque a verdadeira mudança começa de dentro para fora.",
    citacao: "",
    selo: "Ouro",
    destaque: 1,
    visivel: true,
  },
  {
    // OURO (Bloco I) — Patrícia Ribeiro / Fluir. Logo com fundo claro opaco.
    id: "patricia-ribeiro",
    nome: "Patrícia Ribeiro",
    titulo: "Fundadora do Fluir",
    tipo: "pessoa",
    foto: {
      src: "/patrocinadores/patricia-foto.webp",
      alt: "Retrato de Patrícia Ribeiro, fundadora do Fluir",
      width: 801,
      height: 1200,
    },
    logo: {
      src: "/patrocinadores/logo-fluir.webp",
      alt: "Logótipo Fluir",
      // Card pré-renderizado 1600×900 (16:9) (fundo claro + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // Texto verbatim aprovado pelo Lucas (Bloco I).
    historia:
      "Fundadora do Fluir, um projeto dedicado às mulheres: workshops, partilhas e momentos únicos para saírem da rotina e se colocarem como prioridade. Porque às vezes basta uma tarde para deixar fluir.",
    citacao: "",
    selo: "Ouro",
    destaque: 1,
    visivel: true,
  },
  {
    id: "tereza-moura",
    nome: "Tereza Moura",
    titulo: "Especialista em Realização Pessoal Feminina",
    tipo: "pessoa",
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
      // Card pré-renderizado 1600×900 (16:9) (fundo creme + borda embutidos) —
      // versão clara do logótipo (pedido da Tereza, 21/08/2026).
      width: 1600,
      height: 900,
      estilo: "card",
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
    tipo: "pessoa",
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
      // Card pré-renderizado 1600×900 (16:9) (fundo lilás + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
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
    tipo: "pessoa",
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
      // Card pré-renderizado 1600×900 (16:9) (fundo navy + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // AGUARDA APROVAÇÃO — não publicar sem confirmação escrita da Andreia.
    historia: "",
    citacao: "",
    destaque: 2,
    visivel: true,
  },
  {
    id: "kel-barbearia",
    // r3 (decisão do Lucas): o card é de PESSOA — "Kel Barber" — e a marca
    // "KEL Barbearia" entra na linha do cargo (modelo Paulo Faustino).
    nome: "Kel Barber",
    titulo: "KEL Barbearia · Barbearia desde 2008",
    tipo: "pessoa",
    descricao: "Barbeiro profissional com experiência desde 2008, um verdadeiro conceito em estilos de cabelo para os seus clientes.",
    foto: {
      src: "/patrocinadores/kel-barbearia-4x5.webp",
      alt: "Retrato de Kel Barber, da KEL Barbearia",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-kel-barbearia.webp",
      alt: "Logótipo Kel Barbearia",
      // Card pré-renderizado 1600×900 (16:9) (fundo branco + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // AGUARDA APROVAÇÃO — descricao aprovada pelo Lucas; falta aprovar história/citação.
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
  {
    id: "yeshua",
    // r3 (decisão do Lucas): o card é da responsável "Walcília Ferreira" e a
    // marca "Yeshua – Centro de Cuidado Integrado" entra na linha do cargo.
    nome: "Walcília Ferreira",
    titulo: "Yeshua – Centro de Cuidado Integrado",
    tipo: "pessoa",
    descricao: "Estética natural com produtos 100% naturais, do início ao fim. Uma referência em estética natural em Portugal.",
    foto: {
      src: "/patrocinadores/yeshua-4x5.webp",
      alt: "Retrato de Walcília Ferreira, do Yeshua – Centro de Cuidado Integrado",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-yeshua.webp",
      alt: "Logótipo Yeshua, Centro de Cuidado Integrado",
      // Card pré-renderizado 1600×900 (16:9) (fundo preto + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    // AGUARDA APROVAÇÃO — descricao aprovada pelo Lucas; falta aprovar história/citação.
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
  {
    id: "leandrinho",
    // id mantido (não há motivo para arriscar renomear); nome alinhado com a
    // marca do logo. Texto do site usa "leandro design" (um "n"); o FICHEIRO
    // do logótipo (logo-leanndro-design.webp) mostra "leanndro" (dois "n") —
    // grafia da marca. Não editar a imagem.
    nome: "Leandro",
    titulo: "leandro design",
    tipo: "pessoa",
    descricao: "A identidade por trás da música, dos eventos e marcas. +100 Milhões de visualizações em projetos assinados.",
    foto: {
      src: "/patrocinadores/leandro-design-4x5.webp",
      alt: "Retrato de Leandro, leandro design",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-leanndro-design.webp",
      alt: "Logótipo leandro design",
      // Card pré-renderizado 1600×900 (16:9) (fundo preto + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
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
    tipo: "pessoa",
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
      // Card pré-renderizado 1600×900 (16:9) (fundo branco + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
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
    tipo: "pessoa",
    descricao: "Criando Landing Pages, Sites e Aplicações que transformam a vida dos clientes, com código e estratégia para tornar sonhos em realidade.",
    foto: {
      src: "/patrocinadores/lucas-gabriel-4x5.webp",
      alt: "Retrato de Lucas Gabriel, engenheiro de prompt e desenvolvedor full stack IA",
      width: 800,
      height: 1000,
    },
    logo: {
      src: "/patrocinadores/logo-chama-creative.webp",
      alt: "Logótipo Chama Creative Studio",
      // Card pré-renderizado 1600×900 (16:9) (fundo navy + borda embutidos)
      width: 1600,
      height: 900,
      estilo: "card",
    },
    historia: "",
    citacao: "",
    destaque: 3,
    visivel: true,
  },
];