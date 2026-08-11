/**
 * Constantes partilhadas entre client e server (API routes, Supabase RPC).
 *
 * FIM_CAMPANHA_ISO é o marco de fase: fecho da lista gratuita e abertura da
 * inscrição paga (10/08, 10:00 Lisboa). KIT_ITENS é a fonte única do kit de
 * solidariedade. SALON_WHATSAPP é o número ÚNICO do projeto (o do salão);
 * todas as mensagens pré-preenchidas (lista de espera, inscrição) usam-no
 * via linkWhatsApp() em lib/site.
 */

/** Início da janela de campanha (deploy). Fuso Europe/Lisbon. */
export const INICIO_CAMPANHA_ISO = "2026-08-05T22:00:00+01:00";

/** Fim da campanha — 10 de agosto de 2026, 10h Lisboa (fecho da lista gratuita). */
export const FIM_CAMPANHA_ISO = "2026-08-10T10:00:00+01:00";

/** Número de WhatsApp do projeto (o do salão) — único, partilhado por todos os fluxos. */
export const SALON_WHATSAPP = "351928400069";

/** Mensagem pré-preenchida do botão WhatsApp pós-inscrição (lista de espera). */
export const MENSAGEM_LISTA =
  "Olá pessoal da Essence of Beauty, faço parte do evento e gostaria de saber mais sobre a minha inscrição.";

/** Mensagem pré-preenchida do botão WhatsApp pós-confirmação (inscrição paga). */
export const MENSAGEM_INSCRICAO =
  "Olá pessoal da Essence of Beauty, fiz a minha inscrição no Além do Espelho 2026 e gostaria de saber mais.";

/** Itens do kit de solidariedade — fonte única (CausaSocial e ParabensModal). */
export const KIT_ITENS = [
  "Escovas de dente (Dentax)",
  "Pasta de dente (Anticáries)",
  "Sabonete (Margarida Cosmética)",
  "Absorvente (Leve & Segura)",
] as const;
