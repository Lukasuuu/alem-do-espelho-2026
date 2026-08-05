import { linkWhatsApp, site } from "@/lib/site";
import type { MetodoPagamento } from "@/lib/validation";

/** Valor da inscrição — fonte única, usado no copy da modal. */
export const VALOR_INSCRICAO = 40;
export const VALOR_INSCRICAO_TEXT = `${VALOR_INSCRICAO}€`;

/** Link do checkout SumUp da 2ª edição (link estático do B2C). */
export const SUMUP_URL = "https://pay.sumup.com/b2c/QZW9NOCM";

/**
 * WhatsApp de confirmação de pagamento — CANÓNICO do projeto
 * (site.contacto.whatsapp.numero, o mesmo do footer/sponsor).
 * Nunca criar um contacto novo.
 */
export const WHATSAPP_PAGAMENTO = site.contacto.whatsapp.numero;

// ═══════════════════════════════════════════════════════════════
// DADOS A CONFIRMAR COM A VITÓRIA — placeholders honestos.
// Assim que chegarem os valores reais, substituir aqui (e só aqui).
// ═══════════════════════════════════════════════════════════════
export const MBWAY_NUMERO = "a confirmar";
export const TRANSFERENCIA = {
  iban: "PT00 0000 0000 0000 0000 0000 0",
  beneficiario: "A confirmar",
} as const;

const NOME_METODO: Record<MetodoPagamento, string> = {
  sumup: "SumUp",
  mbway: "MB Way",
  transferencia: "Transferência Bancária",
};

export function nomeMetodo(metodo: MetodoPagamento): string {
  return NOME_METODO[metodo];
}

/** Mensagem pré-preenchida do botão de confirmação por WhatsApp. */
export function mensagemConfirmacaoPagamento(metodo: MetodoPagamento): string {
  return `Olá! Acabei de me inscrever no Além do Espelho e escolhi ${nomeMetodo(
    metodo
  )}. Como confirmo o pagamento?`;
}

/** Link wa.me com a mensagem de confirmação do método escolhido. */
export function linkWhatsAppPagamento(metodo: MetodoPagamento): string {
  return linkWhatsApp(WHATSAPP_PAGAMENTO, mensagemConfirmacaoPagamento(metodo));
}
