/**
 * Fonte única de verdade do conteúdo do evento.
 * Alterar aqui reflete em toda a landing page.
 */

import { FIM_CAMPANHA_ISO, SALON_WHATSAPP } from "@/lib/campanha";

/**
 * Corte histórico da landing (release manager): 3 de agosto de 2026.
 * Já aconteceu — a partir daí a rota serve a versão do evento.
 * Fonte única: src/lib/cutover.ts usa este valor.
 * NOTA: a lista de espera NÃO fecha nesta data. Fecha no fim da campanha
 * (site.listaEspera.fecha = FIM_CAMPANHA_ISO, 10 de agosto).
 */
export const CORTE_ESPERA_ISO = "2026-08-03T10:00:00+01:00";

export const site = {
  nome: "Além do Espelho 2026",
  subtitulo: "Além de Mim",
  edicao: "2ª Edição",
  tagline: "Transformamos mulheres em Portugal e impactamos vidas em Angola.",
  // Domínio canónico, sobrescrito por NEXT_PUBLIC_SITE_URL quando definido.
  // (alemdoespelho2026.com é domínio secundário; o canónico fica sempre no principal.)
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://essenceofbeautysalon.com",
  data: {
    // 17 de outubro de 2026, hora local de Braga (WEST, UTC+1)
    iso: "2026-10-17T09:00:00+01:00",
    extenso: "17 de outubro de 2026",
    curta: "17 OUT 2026",
    dia: "17",
    mes: "Outubro",
    ano: "2026",
  },
  listaEspera: {
    // Fecho da lista = fim da campanha Ecobag Bónus (FIM_CAMPANHA_ISO),
    // segunda-feira, 10 de agosto de 2026, 10:00 (Lisboa, WEST).
    // Desacoplado do corte histórico da rota (CORTE_ESPERA_ISO, 03/08).
    fecha: FIM_CAMPANHA_ISO,
    fechaExtenso: "segunda-feira, 10 de agosto, às 10:00",
    fechaCurta: "10 AGO · 10:00",
  },
  local: {
    nome: "INNSiDE by Meliá",
    cidade: "Braga",
    pais: "Portugal",
    completo: "INNSiDE by Meliá, Braga, Portugal",
  },
  anfitria: {
    nome: "Vitória Gomes",
    papel: "Empresária, escritora e ativista social feminina",
    empresa: "CEO e fundadora do Essence of Beauty",
  },
  contacto: {
    email: "essenceofbeauty.pt@gmail.com",
    whatsapp: {
      /**
       * Número ÚNICO de WhatsApp do projeto — o do salão (351 928 400 069).
       * Fonte única em campanha.ts (SALON_WHATSAPP); aqui é só um re-export.
       * Já divergiu uma vez (havia 2 números) — nunca mais.
       */
      numero: SALON_WHATSAPP,
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

/** Códigos de país no formulário, ordenados pela realidade do público do evento. */
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

/** O que a participante vai viver, extraído do dossiê do projeto. */
export const experiencia = [
  {
    titulo: "Palestras que despertam",
    texto:
      "Histórias reais de mulheres que enfrentaram os seus medos, venceram as suas batalhas e hoje inspiram outras a acreditar que também é possível recomeçar.",
  },
  {
    titulo: "Dinâmicas de desenvolvimento pessoal",
    texto:
      "Experiências práticas que te ajudam a fortalecer a autoestima, resgatar a tua identidade e olhar para ti com mais amor, coragem e verdade.",
  },
  {
    titulo: "Uma sala cheia de mulheres que se apoiam",
    texto:
      "Empresárias, profissionais, mães e mulheres em processo de reinvenção. Cada uma com a sua história, todas com o mesmo desejo de recomeçar.",
  },
  {
    titulo: "Experiências que tocam a alma",
    texto:
      "Momentos de música, dança e arte visual criados para despertar a tua verdadeira beleza.",
  },
] as const;
