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
import { validarIban } from "@/lib/pagamento";
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
 * Canais de pagamento do fluxo automático. A MOEDA É DECIDIDA PELO CANAL — não
 * pela pessoa que doa: ela escolhe o valor em euros (como sempre) e por onde
 * paga; se escolher Wise ou Pix, o site mostra o valor convertido a título
 * indicativo. O `valor_cents` guardado continua a ser em euros.
 */
export const METODOS_DOACAO = ["mbway", "transferencia", "wise_gbp", "pix_brl"] as const;
export type MetodoDoacao = (typeof METODOS_DOACAO)[number];

/** Canal → moeda em que o dinheiro sai. O euro é sempre a unidade de conta. */
export const MOEDA_POR_METODO: Record<MetodoDoacao, "EUR" | "GBP" | "BRL"> = {
  mbway: "EUR",
  transferencia: "EUR",
  wise_gbp: "GBP",
  pix_brl: "BRL",
};

/**
 * D4 — dados de recebimento das doações (revisto a 21/10/2026).
 *
 * Mudança de 19/10: a conta e o MB Way da vaquinha deixaram de ser os da
 * inscrição. Passam a ser constantes PRÓPRIAS, aqui — e não importadas de
 * lib/pagamento.ts. É de propósito: a inscrição continua a receber no número
 * dela, e há inscrições pendentes que ainda pagam por lá. São dois fluxos de
 * dinheiro com destinos diferentes, e voltar a amarrá-los seria voltar a
 * mandar dinheiro para o lado errado no dia em que um dos dois mudasse.
 *
 * Revisão de 21/10 (confirmada com a Vitória pelo Lucas): a conta em euros
 * passou da anterior para a Revolut Bank UAB (Sucursal em Portugal). O BIC
 * ficou VISÍVEL (decisão do Lucas): dentro da SEPA basta o IBAN, mas quem
 * envia de fora da SEPA precisa dele. O MB Way, a frase de transparência, o
 * contador e a meta NÃO mudaram nesta revisão.
 *
 * Titulares: cada conta vai com o nome TAL COMO ESTÁ REGISTADA nela, não com a
 * forma curta que o site usa para a anfitriã. Os bancos confrontam o nome com
 * o IBAN/chave e avisam quem transfere quando não bate — «Vitória Gomes» aqui
 * seria um aviso a mais para quem está a doar.
 *
 * Canais estrangeiros (acrescentados a 21/10): Wise em GBP e Pix em BRL. A
 * moeda é só o canal + uma conversão MOSTRADA; o valor da doação continua em
 * euros (ver METODOS_DOACAO acima e lib/cambio.ts).
 *
 * A vaquinha não tem link de pagamento (o D3 desapareceu na revisão 2 de 13/10).
 */
export const VAQUINHA_PAGAMENTO = {
  mbway: {
    mostrar: "+351 939 009 874",
    copiar: "939009874",
  },
  transferencia: {
    /** Nome registado na conta Revolut — confirmado pelo Lucas a 21/10. */
    beneficiario: "Vitória Silva da Conceição Gomes",
    iban: "PT50356000019001883341386", // Revolut Bank UAB, guardado sem espaços
    bic: "REVOPTP2",
  },
  wise: {
    /** Grafia do registo da conta Wise (sem acentos), confirmada pelo Lucas. */
    titular: "Vitoria Conceicao Gomes",
    sortCode: "23-08-01",
    conta: "14790433",
    iban: "GB81TRWI23080114790433", // guardado sem espaços, como o português
    bic: "TRWIGB2LXXX",
  },
  pix: {
    /** Chave CPF (11 dígitos) — confirmada pelo Lucas a 21/10. */
    chave: "16141333796",
    titular: "Vitória Silva da Conceição Gomes",
    agencia: "0001",
    conta: "25314548-0",
    banco: "0260 — Nu Pagamentos S.A.",
  },
} as const;

// Mesmo tripwire da TRANSFERENCIA da inscrição (lib/pagamento.ts): um IBAN
// inválido em código parte o build/consola em vez de mandar alguém transferir
// para o lado errado. A vaquinha é dinheiro de uma causa solidária — falha alto.
// Cobre os DOIS IBANs do fluxo automático: o português (EUR) e o britânico (GBP).
const IBANS_VAQUINHA = [
  ["EUR (Revolut)", VAQUINHA_PAGAMENTO.transferencia.iban],
  ["GBP (Wise)", VAQUINHA_PAGAMENTO.wise.iban],
] as const;

for (const [canal, iban] of IBANS_VAQUINHA) {
  if (!validarIban(iban)) {
    throw new Error(
      `[vaquinha] IBAN de doações inválido (${canal}) em src/lib/vaquinha.ts: "${iban}". Corrige antes de avançar.`
    );
  }
}

/**
 * D2 — frase de transparência (fechado a 13/10/2026, confirmada pela Vitória).
 * Vive ao lado do VAQUINHA_PAGAMENTO para o D2 e o D4 estarem no mesmo sítio:
 * é a mesma pergunta — quem recebe este dinheiro.
 */
export const VAQUINHA_TRANSPARENCIA =
  "Os valores são recebidos por Vitória Gomes, organizadora do Além do Espelho, e entregues na totalidade à ONG Atos.";

/** true com D4 preenchido (porta do checklist de pré-go-live). */
export function pagamentoConfigurado(): boolean {
  const p = VAQUINHA_PAGAMENTO;
  return Boolean(
    p.mbway.mostrar && p.mbway.copiar && p.transferencia.beneficiario && p.transferencia.iban
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
 * Como `formatarEuros`, mas com os cêntimos à mostra ("10,00 €"). As folhas da
 * vaquinha (03–05) escrevem o valor assim no cabeçalho; o cartão e a frase do
 * agradecimento escrevem sem cêntimos ("1240 €", "10 €"). São os dois formatos
 * da referência aprovada, por isso existem as duas funções.
 */
export function formatarEurosComCentimos(centimos: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(centimos / 100);
}

/** Mensagem do WhatsApp da vaquinha — número único do projeto (SALON_WHATSAPP). */
export const MENSAGEM_VAQUINHA_WHATSAPP =
  "Olá! Estou a contribuir para a vaquinha da ONG Atos, no Além do Espelho 2026, e preciso de ajuda.";

/**
 * Mensagens de erro da vaquinha — uma por código de RAISE, para a resposta ser
 * específica em vez do genérico da inscrição (lição do B0). O código vem da RPC
 * (0014) no campo `message`; a frase vive aqui, no servidor que a devolve.
 */
export const MENSAGENS_VAQUINHA = {
  naoConfigurada: "A vaquinha ainda não está pronta. Tenta novamente daqui a pouco.",
  naoAbriu: "A vaquinha abre no dia do evento, às 09h30.",
  inativa: "A vaquinha está fechada neste momento.",
  encerrada: "A vaquinha já encerrou. Obrigada a quem participou!",
  valorMinimo: "O valor mínimo é 5 €.",
  /** Diz QUAL é o limite. É esta que o 422 do servidor devolve e a que o cartão
      mostra por baixo do input — tem de acompanhar VALOR_MAX_CENTS (1000 €). */
  valorMaximo: "O valor máximo é 1000 €. Para mais, fala connosco no WhatsApp.",
  metodo: "Escolhe uma forma de contribuir.",
  demasiadosPedidos: "Demasiados pedidos seguidos. Aguarda um momento e tenta novamente.",
  naoEncontrada: "Não encontrámos esta contribuição.",
  acessoNegado: "Não conseguimos confirmar esta contribuição.",
  anulada: "Esta contribuição foi anulada.",
  demasiadoRapida: "Conclui primeiro o pagamento na tua app e depois carrega em «Já fiz a doação».",
  /** Painel (V5): procura por referência. */
  referenciaCurta: "Escreve a referência que queres procurar.",
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
  // Canal estrangeiro com moeda/valor/câmbio incoerentes (0015). O cliente
  // correto nunca chega aqui — a rota é que preenche estes campos.
  moeda_invalida: { status: 422, mensagem: MENSAGENS_VAQUINHA.invalido },
  idem_key_obrigatoria: { status: 422, mensagem: MENSAGENS_VAQUINHA.invalido },
  demasiados_pedidos: { status: 429, mensagem: MENSAGENS_VAQUINHA.demasiadosPedidos },
  referencia_indisponivel: { status: 503, mensagem: MENSAGENS_VAQUINHA.servidor },
  doacao_nao_encontrada: { status: 404, mensagem: MENSAGENS_VAQUINHA.naoEncontrada },
  acesso_negado: { status: 403, mensagem: MENSAGENS_VAQUINHA.acessoNegado },
  doacao_anulada: { status: 409, mensagem: MENSAGENS_VAQUINHA.anulada },
  declaracao_demasiado_rapida: { status: 409, mensagem: MENSAGENS_VAQUINHA.demasiadoRapida },
  referencia_obrigatoria: { status: 422, mensagem: MENSAGENS_VAQUINHA.referenciaCurta },
};

/**
 * Fecho da frase do agradecimento (D8, 14/10).
 *
 * O que muda entre os dois casos é o que a pessoa vê: abaixo do limite de
 * confiança a contribuição já está na barra (e tem de lá estar mesmo — é a
 * confiança que o D8 decidiu); acima do limite só entra quando a Vitória
 * confirmar, e a frase não pode prometer o contrário do que a barra mostra.
 * O valor vai à frente da frase, na mesma linha, e é o componente que o põe.
 */
export const AGRADECIMENTO_VAQUINHA = {
  contaLogo: "já conta na barra.",
  aguardaConfirmacao: "entra na barra assim que a Vitória confirmar o recebimento.",
} as const;

/** A parte variável da frase do agradecimento, conforme o valor declarado. */
export function fraseAgradecimento(
  valorCents: number,
  limiteCents: number = LIMITE_CONFIANCA_PADRAO_CENTS
): string {
  return valorCents > limiteCents
    ? AGRADECIMENTO_VAQUINHA.aguardaConfirmacao
    : AGRADECIMENTO_VAQUINHA.contaLogo;
}

/**
 * Limite de confiança, em cêntimos, em vigor enquanto a RPC não responder.
 *
 * A autoridade é a COLUNA `vaquinha_config.limite_confianca_cents`, que vem na
 * resposta de `vaquinha_totais()` (D8, 0014c) — é isso que faz o limite mudar
 * por SQL sem deploy. Esta constante só existe para o caso em que não há
 * resposta nenhuma (base em baixo, RPC ainda por aplicar): sem valor, a frase
 * do agradecimento não se podia escrever.
 */
export const LIMITE_CONFIANCA_PADRAO_CENTS = 10000; // 100 €

/**
 * Totais como a RPC os devolve (vaquinha_totais — 0014 / 0014b / 0014c).
 *
 * `arrecadado_cents` (D8) é o número que o site mostra e a parte SÓLIDA da
 * barra: é o confirmado MAIS as declaradas até ao limite de confiança — quem
 * carrega em «Já fiz a doação» está a dizer que pagou, e acredita-se. Acima do
 * limite a declarada só aparece nas riscas (`a_confirmar_cents`) até a Vitória
 * confirmar. `confirmado_cents` fica na resposta porque o painel da Vitória
 * mostra-o por partes.
 */
export type TotaisVaquinha = {
  confirmado_cents: number;
  arrecadado_cents: number;
  a_confirmar_cents: number;
  limite_confianca_cents: number;
  meta_cents: number | null;
  ativa: boolean;
  inicio: string | null;
  fim: string | null;
  contar_pendentes: boolean;
};

/**
 * Totais + o estado que o SERVIDOR deriva deles.
 *
 * `encerrada` não vem da base: é calculado com o relógio de quem serve (page.tsx
 * e /api/vaquinha/totais), nunca com o do browser. A vaquinha vai até 18/11 e
 * quem tiver a página aberta à meia-noite tem de ver a troca sem recarregar —
 * com o polling dos 15 s, o próximo /totais já traz encerrada = true.
 */
export type TotaisComEstado = TotaisVaquinha & { encerrada: boolean };

/** O fecho já passou? `fim` nulo = sem fecho (fica aberta). */
export function estaEncerrada(totais: Pick<TotaisVaquinha, "fim">, agora: Date): boolean {
  return totais.fim !== null && agora.getTime() >= new Date(totais.fim).getTime();
}

/**
 * O último dia da vaquinha, para mostrar no cartão: «Até 18 de novembro».
 *
 * O `fim` é o INSTANTE de fecho (19/11 às 00:00), portanto o último dia é o
 * milissegundo anterior, formatado em Europe/Lisbon. Ler isto do `fim` (e não
 * escrever a data no código) é o que faz o cartão acompanhar sozinho se a data
 * mudar por SQL, sem deploy.
 */
export function prazoDoFim(fim: string | null): string | null {
  if (!fim) return null;
  const ultimoDia = new Date(new Date(fim).getTime() - 1);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Lisbon",
  }).format(ultimoDia);
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
  metodo: z.enum(METODOS_DOACAO, {
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

