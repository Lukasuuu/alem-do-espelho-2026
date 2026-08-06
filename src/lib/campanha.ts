/**
 * Campanha "Ecobag Bónus" — primeira edição.
 *
 * Constantes partilhadas entre client (countdown, EcobagModal) e server
 * (API route, Supabase RPC).  Manter em sincronia com a migration
 * 0003_campanha.sql (INICIO_CAMPANHA no SQL deve bater com INICIO_CAMPANHA_ISO aqui).
 */

/** Início da janela de campanha (deploy). Fuso Europe/Lisbon. */
export const INICIO_CAMPANHA_ISO = "2026-08-05T22:00:00+01:00";

/** Fim da campanha — 10 de agosto de 2026, 10h Lisboa. */
export const FIM_CAMPANHA_ISO = "2026-08-10T10:00:00+01:00";

/** Máximo de ecobags bónus.  Atribuição é server-side em registar_inscricao(). */
export const LIMITE_BONUS = 50;

/** Texto descritivo do bónus, usado no EcobagModal e no disclaimer do PagamentoModal. */
export const TEXTO_BONUS = "Ecobag exclusiva Além do Espelho + kit de solidariedade";

/** Intervalo de polling do counter no client (ms). */
export const CAMPAIGN_POLL_MS = 30_000;

/** Número de WhatsApp do botão "Falar sobre a minha Ecobag" na confirmação pós-inscrição. */
export const SALON_WHATSAPP = "351928400069";

/** Mensagem pré-preenchida do botão Ecobag pós-inscrição. */
export const MENSAGEM_ECOBAG =
  "Olá pessoal da Essence of Beauty, faço parte do evento e gostaria de saber mais sobre a minha Ecobag.";
