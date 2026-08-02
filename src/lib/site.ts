/**
 * Fonte única de verdade do conteúdo do evento.
 * Alterar aqui reflete em toda a landing page.
 */

export const site = {
  nome: "Além do Espelho 2026",
  subtitulo: "Além de Mim",
  edicao: "2ª Edição",
  tagline: "Transformando mulheres em Portugal, impactando vidas em Angola.",
  // Domínio canónico — sobrescrito por NEXT_PUBLIC_SITE_URL quando definido.
  // (alemdoespelho2026.com é domínio secundário; o canónico fica sempre no principal.)
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://essenceofbeautysalon.com",
  data: {
    // 17 de outubro de 2026 — hora local de Braga (WEST, UTC+1)
    iso: "2026-10-17T09:00:00+01:00",
    extenso: "17 de outubro de 2026",
    curta: "17 OUT 2026",
    dia: "17",
    mes: "Outubro",
    ano: "2026",
  },
  listaEspera: {
    // Fecho da lista — segunda-feira, 3 de agosto de 2026, 10:00 (Lisboa, WEST)
    fecha: "2026-08-03T10:00:00+01:00",
    fechaExtenso: "segunda-feira, 3 de agosto, às 10:00",
    fechaCurta: "3 AGO · 10:00",
  },
  local: {
    nome: "INNSiDE by Meliá",
    cidade: "Braga",
    pais: "Portugal",
    completo: "INNSiDE by Meliá — Braga, Portugal",
  },
  anfitria: {
    nome: "Vitória Gomes",
    papel: "Empresária, escritora e ativista social feminina",
    empresa: "CEO e fundadora do Essence of Beauty",
  },
  contacto: {
    email: "essenceofbeauty.pt@gmail.com",
    whatsapp: {
      // Mesmo número usado no footer — nunca criar um contacto novo.
      numero: "351939009874",
      /** Mensagem pré-preenchida do fluxo "Quero Patrocinar". */
      mensagemSponsor: `Olá Vitória!\nCliquei em "Quero Patrocinar" na landing page e gostaria de saber mais informações sobre as oportunidades de patrocínio.\nObrigado.`,
    },
  },
  vagas: 100,
} as const;

/** Constrói um link wa.me com mensagem pré-preenchida. */
export function linkWhatsApp(numero: string, mensagem: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/** Códigos de país no formulário — ordenados pela realidade do público do evento. */
export const paises = [
  { code: "PT", dial: "+351", nome: "Portugal", flag: "🇵🇹" },
  { code: "BR", dial: "+55", nome: "Brasil", flag: "🇧🇷" },
  { code: "AO", dial: "+244", nome: "Angola", flag: "🇦🇴" },
  { code: "ES", dial: "+34", nome: "Espanha", flag: "🇪🇸" },
  { code: "FR", dial: "+33", nome: "França", flag: "🇫🇷" },
  { code: "GB", dial: "+44", nome: "Reino Unido", flag: "🇬🇧" },
  { code: "CH", dial: "+41", nome: "Suíça", flag: "🇨🇭" },
  { code: "LU", dial: "+352", nome: "Luxemburgo", flag: "🇱🇺" },
  { code: "DE", dial: "+49", nome: "Alemanha", flag: "🇩🇪" },
  { code: "CV", dial: "+238", nome: "Cabo Verde", flag: "🇨🇻" },
] as const;

export type PaisCode = (typeof paises)[number]["code"];

/** O que a participante vai viver — extraído do dossiê do projeto. */
export const experiencia = [
  {
    titulo: "Palestras que mexem por dentro",
    texto:
      "Mulheres que já atravessaram o que tu atravessas, a contar como saíram do outro lado.",
  },
  {
    titulo: "Dinâmicas de desenvolvimento pessoal",
    texto:
      "Trabalho real sobre identidade e autoestima — não é uma plateia, é uma sala que participa.",
  },
  {
    titulo: "Networking com propósito",
    texto:
      "Empresárias, profissionais, mães e mulheres em reinvenção. Cem histórias na mesma sala.",
  },
  {
    titulo: "Experiências ao vivo",
    texto: "Música, dança e arte visual.",
  },
] as const;
