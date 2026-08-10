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

/**
 * Inscrição paga (FASE3): mesma disciplina do waitlist, sem o consentimento —
 * ao pagar, a pessoa consente o contacto. O telemóvel valida-se depois com
 * libphonenumber (E.164) na rota, igual ao fluxo da lista de espera.
 */
export const inscricaoSchema = z.object({
  nome: z
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

  // Anti-bot: igual ao waitlist — o campo invisível e o tempo mínimo.
  website: z.string().max(200).optional().default(""),
  elapsedMs: z.number().int().nonnegative().optional(),

  locale: z.string().max(12).optional(),
  utm: z.record(z.string().max(160)).optional(),
});

export type InscricaoInput = z.input<typeof inscricaoSchema>;

/** Métodos de pagamento da modal — são também os valores da coluna da base. */
export const METODOS_PAGAMENTO = ["sumup", "mbway", "transferencia"] as const;
export type MetodoPagamento = (typeof METODOS_PAGAMENTO)[number];

/** PATCH que marca o método escolhido (chamado ao abrir cada método). */
export const metodoInscricaoSchema = z.object({
  inscricaoId: z.string().uuid("Inscrição inválida."),
  metodo: z.enum(METODOS_PAGAMENTO, {
    errorMap: () => ({ message: "Método de pagamento inválido." }),
  }),
});

export type MetodoInscricaoInput = z.input<typeof metodoInscricaoSchema>;

/** Níveis de parceria do patrocínio — fechados a 75 / 150 / 200€ (FASE5). */
export const NIVEIS_PARCERIA = [75, 150, 200] as const;
export type NivelParceria = (typeof NIVEIS_PARCERIA)[number];

/** Métodos do patrocínio — SEM cartão: só MB Way ou transferência. O SumUp é exclusivo da inscrição. */
export const METODOS_SPONSOR = ["mbway", "transferencia"] as const;
export type MetodoSponsor = (typeof METODOS_SPONSOR)[number];

/**
 * Registo de patrocínio (CORREÇÃO nº3): mesmos campos do waitlist (nome,
 * email, telemóvel, consentimento, anti-bot) mais a empresa/marca OPCIONAL.
 * O nível já NÃO entra aqui — a escolha passou para o passo B (depois do
 * formulário) e é marcada num PATCH próprio (/api/sponsor/nivel).
 */
export const sponsorSchema = waitlistSchema.extend({
  // Campo novo (CORREÇÃO nº6): empresa/marca, opcional — quem patrocina a
  // título individual deixa em branco.
  empresa: z
    .string()
    .transform(normalizarNome)
    .pipe(
      z
        .string()
        .max(120, "Nome da empresa ou marca demasiado longo.")
    )
    .optional()
    .default(""),

  // Nível escolhido no passo B — ausente no POST do formulário (null),
  // presente apenas se algo o enviar (mantém a validação de fronteira).
  nivel: z
    .union(
      [z.literal(75), z.literal(150), z.literal(200)],
      { errorMap: () => ({ message: "Escolhe um nível de parceria." }) }
    )
    .nullish(),
});

export type SponsorInput = z.input<typeof sponsorSchema>;

/** PATCH que marca o nível escolhido no passo B (depois do formulário). */
export const nivelSponsorSchema = z.object({
  sponsorId: z.string().uuid("Parceria inválida."),
  nivel: z.union(
    [z.literal(75), z.literal(150), z.literal(200)],
    { errorMap: () => ({ message: "Escolhe um nível de parceria." }) }
  ),
});

export type NivelSponsorInput = z.input<typeof nivelSponsorSchema>;

/** PATCH que marca o método do patrocínio (MB Way ou transferência). */
export const metodoSponsorSchema = z.object({
  sponsorId: z.string().uuid("Parceria inválida."),
  metodo: z.enum(METODOS_SPONSOR, {
    errorMap: () => ({ message: "Método de pagamento inválido." }),
  }),
});

export type MetodoSponsorInput = z.input<typeof metodoSponsorSchema>;

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

/**
 * Classifica o erro devolvido pelas rotas para o formulário decidir a mensagem
 * e o caminho humano (FIX-3): "fase" (410), "rate" (429), "validacao"
 * (422/400 de formato ou telemóvel), "bot" (400 anti-bot), "servidor"
 * (502/500). O formulário trata qualquer tipo desconhecido ou ausente como
 * "servidor" — default seguro, com contacto humano via WhatsApp.
 */
export type TipoErro = "fase" | "rate" | "validacao" | "bot" | "servidor";

/** Mensagens de erro do servidor, já em português e prontas para o ecrã. */
export const MENSAGENS = {
  rateLimit: "Demasiadas tentativas. Aguarda um minuto e tenta novamente.",
  invalido: "Confere os dados assinalados e tenta novamente.",
  servidor: "Não conseguimos guardar a tua inscrição agora. Tenta daqui a pouco.",
  bot: "Não conseguimos validar esta submissão.",
} as const;
