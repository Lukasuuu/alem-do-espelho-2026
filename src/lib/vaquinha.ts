/**
 * Vaquinha Online da ONG Atos — fonte única do lado do cliente.
 *
 * Módulo CLIENT-SAFE e SEM imports de servidor (next/headers), pelo mesmo motivo
 * de lib/fase.ts: tanto as rotas /api como os componentes precisam das MESMAS
 * constantes. Se crescer para lógica de servidor, vai para lib/vaquinha-fase.ts.
 *
 * O que NÃO vive aqui: a meta (está em vaquinha_config.meta_cents), os valores
 * dos pagamentos por omissão de outra fase e o gate de fase (é do servidor).
 */

import { EVENTO_ISO } from "../../supabase/functions/_shared/config";
import { z } from "zod";

/**
 * Início da vaquinha = início do evento (17/10/2026, 09h30 Lisboa).
 *
 * Derivado de EVENTO_ISO (fonte única partilhada com os emails e com o
 * cronómetro do hero) em vez de um literal novo: dois literais para o mesmo
 * instante divergem sempre — e é este instante que decide a troca no hero.
 * A constante é PRÓPRIA da vaquinha (não se reutiliza FIM_CAMPANHA_ISO nem
 * CORTE_ESPERA_ISO, que são de outras fases).
 */
export const VAQUINHA_INICIO_ISO = EVENTO_ISO.inicio;

/** Valores rápidos dos chips, em euros. */
export const VALORES_RAPIDOS = [5, 10, 20, 50] as const;

/** Mínimo do servidor (500 = 5 €): a RPC recusa abaixo disto. */
export const VALOR_MIN_CENTS = 500;

/** Teto do servidor (100000 = 1.000 €) — acima disto, WhatsApp. */
export const VALOR_MAX_CENTS = 100000;

/**
 * D3/D4 — dados de recebimento das doações. AINDA POR DECIDIR (Lucas/Vitória).
 *
 * Ficam a null de propósito, em vez de herdarem os da inscrição: o dinheiro da
 * vaquinha pode ir para outra conta (D2), e uma instrução de pagamento errada é
 * pior do que uma instrução ausente — alguém transfere para o sítio errado.
 * Enquanto algum estiver a null, pagamentoConfigurado() é false e o fluxo NÃO
 * pode mostrar instruções (o V6 falha de propósito neste ponto).
 *
 * D3: é um link SumUp de VALOR LIVRE — nunca o da inscrição, que é de 40 € fixos
 * (lib/pagamento.ts SUMUP_URL).
 */
export const VAQUINHA_PAGAMENTO: {
  sumupUrl: string | null;
  qrSumup: string | null;
  mbwayNumero: string | null;
  transferencia: { iban: string; beneficiario: string } | null;
} = {
  sumupUrl: null,
  qrSumup: null,
  mbwayNumero: null,
  transferencia: null,
};

/** true só quando D3 e D4 estão preenchidos (porta do V6 e do V4). */
export function pagamentoConfigurado(): boolean {
  const p = VAQUINHA_PAGAMENTO;
  return Boolean(
    p.sumupUrl && p.qrSumup && p.mbwayNumero && p.transferencia?.iban && p.transferencia?.beneficiario
  );
}

/**
 * Euros a partir de cêntimos. Sempre por Intl — o projeto não formata dinheiro
 * à mão em lado nenhum (`1240 €` vs `1 240 €` vs `1.240,00 €` depende da locale
 * e o Intl resolve-o).
 */
export function formatarEuros(centimos: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(centimos) / 100);
}

/** "inclui 180 € a confirmar · 37 contribuições" (plural tratado). */
export function textoContribuicoes(n: number): string {
  return n === 1 ? "1 contribuição" : `${n} contribuições`;
}

/**
 * Mensagens de erro da vaquinha — uma por código de RAISE, para a resposta ser
 * específica em vez do genérico da inscrição (lição do B0). O código vem da RPC
 * (0014) no campo `message`; a frase vive aqui, no servidor que a devolve.
 */
export const MENSAGENS_VAQUINHA = {
  naoConfigurada: "A vaquinha ainda não está pronta. Tenta novamente daqui a pouco.",
  naoAbriu: "A vaquinha ainda não abriu. Volta ao início do evento.",
  inativa: "A vaquinha está fechada neste momento.",
  encerrada: "A vaquinha já encerrou. Obrigada a quem participou!",
  valorMinimo: "O valor mínimo é 5 €.",
  valorMaximo: "Valor acima do limite — fala connosco no WhatsApp.",
  metodo: "Escolhe uma forma de contribuir.",
  demasiadosPedidos: "Demasiados pedidos seguidos. Aguarda um momento e tenta novamente.",
  naoEncontrada: "Não encontrámos esta contribuição.",
  acessoNegado: "Não conseguimos confirmar esta contribuição.",
  anulada: "Esta contribuição foi anulada.",
  demasiadoRapida: "Conclui primeiro o pagamento e depois carrega em «Já fiz a doação».",
  invalido: "Confere os dados e tenta novamente.",
  servidor: "Não conseguimos registar a tua contribuição agora. Tenta daqui a pouco.",
  bot: "Não conseguimos validar esta submissão.",
} as const;

/**
 * Código do RAISE → mensagem + estado HTTP. Mapa único, para as três rotas não
 * divergirem: um código novo na 0014 que falte aqui cai no 502 genérico.
 */
export const ERRO_VAQUINHA: Record<string, { status: number; mensagem: string }> = {
  vaquinha_nao_configurada: { status: 503, mensagem: MENSAGENS_VAQUINHA.naoConfigurada },
  vaquinha_nao_abriu: { status: 410, mensagem: MENSAGENS_VAQUINHA.naoAbriu },
  vaquinha_inativa: { status: 410, mensagem: MENSAGENS_VAQUINHA.inativa },
  vaquinha_encerrada: { status: 410, mensagem: MENSAGENS_VAQUINHA.encerrada },
  valor_minimo: { status: 422, mensagem: MENSAGENS_VAQUINHA.valorMinimo },
  valor_maximo: { status: 422, mensagem: MENSAGENS_VAQUINHA.valorMaximo },
  invalid_metodo: { status: 422, mensagem: MENSAGENS_VAQUINHA.metodo },
  idem_key_obrigatoria: { status: 422, mensagem: MENSAGENS_VAQUINHA.invalido },
  demasiados_pedidos: { status: 429, mensagem: MENSAGENS_VAQUINHA.demasiadosPedidos },
  referencia_indisponivel: { status: 503, mensagem: MENSAGENS_VAQUINHA.servidor },
  doacao_nao_encontrada: { status: 404, mensagem: MENSAGENS_VAQUINHA.naoEncontrada },
  acesso_negado: { status: 403, mensagem: MENSAGENS_VAQUINHA.acessoNegado },
  doacao_anulada: { status: 409, mensagem: MENSAGENS_VAQUINHA.anulada },
  declaracao_demasiado_rapida: { status: 409, mensagem: MENSAGENS_VAQUINHA.demasiadoRapida },
};

/** Totais como a RPC os devolve (vaquinha_totais na 0014). */
export type TotaisVaquinha = {
  confirmado_cents: number;
  a_confirmar_cents: number;
  n_contribuicoes: number;
  meta_cents: number | null;
  ativa: boolean;
  inicio: string | null;
  fim: string | null;
  contar_pendentes: boolean;
};

/** Total que a barra mostra: confirmado + (a confirmar, se o interruptor o permitir). */
export function totalNaBarra(t: TotaisVaquinha): number {
  return t.confirmado_cents + (t.contar_pendentes ? t.a_confirmar_cents : 0);
}

/* ── Validação da fronteira (zod), com as MESMAS regras da RPC ───────────────
   A RPC é a autoridade; isto é a primeira barreira, para a resposta ser
   específica e não gastar uma ida à base com um valor inválido. */

export const iniciarDoacaoSchema = z.object({
  valorCents: z
    .number({ invalid_type_error: MENSAGENS_VAQUINHA.invalido })
    .int(MENSAGENS_VAQUINHA.invalido)
    .min(VALOR_MIN_CENTS, MENSAGENS_VAQUINHA.valorMinimo)
    .max(VALOR_MAX_CENTS, MENSAGENS_VAQUINHA.valorMaximo)
    .refine((v) => v % 100 === 0, { message: "Valor em euros inteiros." }),
  metodo: z.enum(["link", "mbway", "transferencia"], {
    errorMap: () => ({ message: MENSAGENS_VAQUINHA.metodo }),
  }),
  /** Gerado no cliente, um por tentativa: é a chave anti duplo clique. */
  idemKey: z.string().uuid(MENSAGENS_VAQUINHA.invalido),
  // Anti-bot, igual ao formulário de inscrição: campo invisível que só um robô
  // preenche e tempo mínimo plausível. A rejeição é genérica, no handler.
  website: z.string().max(200).optional().default(""),
  elapsedMs: z.number().int().nonnegative().optional(),
});

export const declararDoacaoSchema = z.object({
  id: z.string().uuid(MENSAGENS_VAQUINHA.invalido),
  // O token de posse da 0009 tem 64 caracteres; a folga é para não partir se o
  // formato crescer. Nunca é registado em log.
  posseToken: z.string().min(32, MENSAGENS_VAQUINHA.acessoNegado).max(200),
});

/**
 * Código de RAISE → resposta HTTP. Devolve null quando o erro não é conhecido
 * (a rota responde 502 e regista o código no console, sem nunca imprimir dados).
 */
export function erroDaVaquinha(mensagem: string | undefined | null): {
  status: number;
  mensagem: string;
} | null {
  if (!mensagem) return null;
  for (const [codigo, m] of Object.entries(ERRO_VAQUINHA)) {
    if (mensagem.includes(codigo)) return m;
  }
  return null;
}

