import { linkWhatsApp } from "@/lib/site";
import { SALON_WHATSAPP } from "@/lib/campanha";
import type { MetodoPagamento } from "@/lib/validation";

/** Valor da inscrição — fonte única, usado no copy da modal. */
export const VALOR_INSCRICAO = 40;
export const VALOR_INSCRICAO_TEXT = `${VALOR_INSCRICAO}€`;

/** Link do checkout SumUp da 2ª edição (link estático do B2C). */
export const SUMUP_URL = "https://pay.sumup.com/b2c/QZW9NOCM";

/**
 * WhatsApp de confirmação de pagamento — número ÚNICO do projeto (o do salão,
 * 351 928 400 069). Fonte única em campanha.ts (SALON_WHATSAPP); todos os
 * fluxos (footer, patrocínio, pagamento, Ecobag) usam este mesmo número.
 */

// ═══════════════════════════════════════════════════════════════
// DADOS A CONFIRMAR COM A VITÓRIA — placeholders honestos.
// Assim que chegarem os valores reais, substituir aqui (e só aqui).
// ═══════════════════════════════════════════════════════════════
export const MBWAY_NUMERO = "a confirmar";

/**
 * IBAN da conta de recebimento da inscrição (SumUp, SEPA).
 * Validado por validarIban() abaixo — qualquer edição que o quebre
 * faz o módulo lançar erro em dev/SSR (tripwire), impedindo o deploy.
 */
export const TRANSFERENCIA = {
  iban: "IE60SUMU99036513007149",
  // Nome do titular da conta ainda não confirmado pela Vitória.
  beneficiario: "A confirmar",
} as const;

// ═══════════════════════════════════════════════════════════════
// IBAN mod-97 — validação de fronteira para dados financeiros.
// ═══════════════════════════════════════════════════════════════

/**
 * Valida um IBAN (ISO 13616) pelo algoritmo mod-97:
 * 1. remove espaços e normaliza para maiúsculas;
 * 2. move os 4 primeiros caracteres para o fim;
 * 3. converte letras para números (A=10 … Z=35);
 * 4. resto da divisão inteira por 97 tem de ser 1.
 * IBANs de teste com país fictício (XX/YY) ou comprimento errado → false.
 */
export function validarIban(iban: string): boolean {
  const normalizado = iban.replace(/[\s -]/g, "").toUpperCase();
  // Tamanho por país: IE=22, PT=25. Sem tabela completa, exigimos ≥ 15
  // e rejeitamos códigos de país de teste óbvios.
  if (normalizado.length < 15 || /^(XX|YY|ZZ)/.test(normalizado)) return false;
  const reorganizado = normalizado.slice(4) + normalizado.slice(0, 4);
  const digitos = reorganizado
    .split("")
    .map((c) => (/[A-Z]/.test(c) ? c.charCodeAt(0) - 55 : Number(c)))
    .join("");
  let resto = 0;
  for (let i = 0; i < digitos.length; i += 7) {
    resto = Number(resto + digitos.slice(i, i + 7)) % 97;
  }
  return resto === 1;
}

/**
 * Tripwire de build/dev: se algum IBAN configurado for inválido, o módulo
 * lança erro ao carregar — impossível passar despercebido no dev server
 * nem chegar a produção. O IBAN atual é válido; a validação corre em cada
 * carregamento e fica inerte até alguém editar a constante para um valor mau.
 */
if (!validarIban(TRANSFERENCIA.iban)) {
  throw new Error(
    `[pagamento] IBAN de transferência inválido em src/lib/pagamento.ts: "${TRANSFERENCIA.iban}". Corrige antes de avançar.`
  );
}

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
  return linkWhatsApp(SALON_WHATSAPP, mensagemConfirmacaoPagamento(metodo));
}
