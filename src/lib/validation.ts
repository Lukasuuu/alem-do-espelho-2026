import { z } from "zod";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Colapsa espaços múltiplos e remove espaços nas pontas. */
export function normalizarNome(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

/** Exige nome e pelo menos um apelido, ambos com 2+ letras. */
const NOME_COMPLETO = /^\p{L}[\p{L}'’.-]{1,}(?:\s+\p{L}[\p{L}'’.-]{1,})+$/u;

export const waitlistSchema = z.object({
  fullName: z
    .string()
    .transform(normalizarNome)
    .pipe(
      z
        .string()
        .min(3, "Escreve o teu nome completo.")
        .max(120, "Nome demasiado longo.")
        .regex(NOME_COMPLETO, "Escreve o nome e o apelido.")
    ),

  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(5, "Indica o teu email.")
        .max(180, "Email demasiado longo.")
        .email("Este email não parece válido.")
    ),

  phoneCountry: z
    .string()
    .length(2, "País inválido.")
    .transform((v) => v.toUpperCase()),

  phone: z
    .string()
    .min(5, "Indica o teu telemóvel.")
    .max(24, "Número demasiado longo."),

  consent: z.literal(true, {
    errorMap: () => ({ message: "Precisamos da tua autorização para te contactar." }),
  }),

  // Anti-bot: campo invisível que só um robô preenche.
  // Aceita qualquer valor aqui, a rejeição acontece no handler,
  // com resposta genérica, para não dar pistas ao robô.
  website: z.string().max(200).optional().default(""),

  // Anti-bot: submissões em menos de 2,5 s são quase sempre automáticas.
  elapsedMs: z.number().int().nonnegative().optional(),

  locale: z.string().max(12).optional(),
  utm: z.record(z.string().max(160)).optional(),
});

export type WaitlistInput = z.input<typeof waitlistSchema>;

export type TelefoneValidado = {
  ok: boolean;
  e164?: string;
  erro?: string;
};

/** Valida e normaliza o telemóvel para E.164 usando as regras reais de cada país. */
export function validarTelefone(numero: string, pais: string): TelefoneValidado {
  const limpo = numero.replace(/[^\d+]/g, "");
  if (!limpo) return { ok: false, erro: "Indica o teu telemóvel." };

  const parsed = parsePhoneNumberFromString(limpo, pais as CountryCode);

  if (!parsed || !parsed.isValid()) {
    return { ok: false, erro: "Este número não parece válido para o país escolhido." };
  }

  const tipo = parsed.getType();
  if (tipo && tipo !== "MOBILE" && tipo !== "FIXED_LINE_OR_MOBILE") {
    return { ok: false, erro: "Indica um número de telemóvel." };
  }

  return { ok: true, e164: parsed.number };
}

/** Mensagens de erro do servidor, já em português e prontas para o ecrã. */
export const MENSAGENS = {
  rateLimit: "Demasiadas tentativas. Aguarda um minuto e tenta novamente.",
  invalido: "Confere os dados assinalados e tenta novamente.",
  servidor: "Não conseguimos guardar a tua inscrição agora. Tenta daqui a pouco.",
  bot: "Não conseguimos validar esta submissão.",
} as const;
