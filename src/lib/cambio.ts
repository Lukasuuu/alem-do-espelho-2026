/**
 * Câmbio do euro para as moedas dos canais estrangeiros da vaquinha (GBP, BRL).
 *
 * ── A REGRA QUE DEFINE O DESENHO ─────────────────────────────────────────────
 * O EURO É A UNIDADE DE CONTA. A moeda estrangeira é só o canal de pagamento e
 * uma conversão MOSTRADA no ecrã. O que fica guardado como valor da doação
 * continua a ser `valor_cents`, em euros — por isso o mínimo, o máximo, a meta
 * de 2.000 € e o contador não mudam com o câmbio do dia.
 *
 * ── A FONTE ──────────────────────────────────────────────────────────────────
 * Taxas de referência DIÁRIAS DO BCE (eurofxref-daily.xml): gratuitas, sem
 * chave, publicadas uma vez por dia útil (~16:00 CET) e — o que mais importa —
 * cotadas com o EURO como base, que é exatamente a nossa unidade de conta. O
 * XML traz GBP e BRL.
 *
 * ── O QUE NUNCA PODE ACONTECER ───────────────────────────────────────────────
 * O fetch do câmbio nunca bloqueia uma doação. Se o BCE estiver em baixo,
 * usa-se a taxa de RECURSO e a legenda diz que é de referência, sem inventar
 * uma data. Falhar para o lado de continuar a funcionar, não para o lado de
 * rebentar.
 *
 * Este módulo é CLIENT-SAFE: não tem imports de servidor. `obterCambio()` corre
 * só no servidor (página e rota /api) — o cliente importa daqui apenas os tipos,
 * as taxas de recurso e as funções puras de conversão/formatação.
 */

export type MoedaEstrangeira = "GBP" | "BRL";

export type Cambio = {
  taxas: Record<MoedaEstrangeira, number>;
  /** Data de referência do BCE (ISO), null quando se está na taxa de recurso. */
  data: string | null;
  fonte: "BCE" | "recurso";
};

/**
 * Taxas de recurso — usadas SÓ quando o fetch do BCE falha (arredondadas, com
 * duas casas, e assumidamente aproximadas). Não são um valor de negócio: são a
 * rede que impede a página de ficar sem número nenhum. A legenda que as
 * acompanha diz «câmbio indicativo de referência» e não lhes atribui data.
 */
export const TAXAS_RECURSO: Record<MoedaEstrangeira, number> = {
  GBP: 0.87,
  BRL: 6.2,
};

/** O câmbio de recurso já montado — para quando não vale a pena ir ao BCE. */
export const CAMBIO_RECURSO: Cambio = {
  taxas: TAXAS_RECURSO,
  data: null,
  fonte: "recurso",
};

const URL_BCE = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

/** 6 h de cache: o BCE publica uma vez por dia útil; 4 fetches/dia chegam. */
const REVALIDATE_SEGUNDOS = 21600;

/** Um BCE lento não pode atrasar a página da vaquinha. */
const TIMEOUT_MS = 2500;

function lerTaxa(xml: string, moeda: MoedaEstrangeira): number | null {
  // <Cube currency="GBP" rate="0.87"/> — aceita aspas simples ou duplas e
  // atributos na ordem normal do BCE.
  const m = xml.match(
    new RegExp(`currency=["']${moeda}["'][^>]*rate=["']([0-9]+(?:\\.[0-9]+)?)["']`)
  );
  if (!m) return null;
  const taxa = Number(m[1]);
  return Number.isFinite(taxa) && taxa > 0 ? taxa : null;
}

/**
 * Lê o eurofxref-daily.xml. Devolve null se faltar GBP, BRL ou a data — quem
 * chama cai na taxa de recurso. Separado do fetch de propósito: é a parte que
 * se pode testar sem rede (ver o teste manual no fim do ficheiro).
 */
export function interpretarXmlBce(xml: string): Cambio | null {
  const data = xml.match(/<Cube\s+time=["'](\d{4}-\d{2}-\d{2})["']/)?.[1] ?? null;
  const gbp = lerTaxa(xml, "GBP");
  const brl = lerTaxa(xml, "BRL");
  if (!data || !gbp || !brl) return null;
  return { taxas: { GBP: gbp, BRL: brl }, data, fonte: "BCE" };
}

/**
 * Taxas em vigor. Nunca lança: qualquer falha (rede, HTTP, XML sem GBP/BRL)
 * devolve a taxa de recurso com fonte "recurso".
 *
 * Corre no servidor (página e rota /api/vaquinha/iniciar). O `next.revalidate`
 * põe o resultado na Data Cache do Next; como o URL é fixo, a página e a rota
 * leem a MESMA entrada — o valor guardado é o que foi mostrado.
 */
export async function obterCambio(): Promise<Cambio> {
  try {
    const resposta = await fetch(URL_BCE, {
      next: { revalidate: REVALIDATE_SEGUNDOS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const cambio = interpretarXmlBce(await resposta.text());
    if (!cambio) throw new Error("XML do BCE sem data ou sem GBP/BRL");
    return cambio;
  } catch (erro) {
    // Log sem dados de utilizador: isto é um problema de infraestrutura.
    console.warn(
      "[cambio] BCE indisponível — a usar a taxa de recurso:",
      erro instanceof Error ? erro.message : String(erro)
    );
    return CAMBIO_RECURSO;
  }
}

/** Cêntimos de euro → cêntimos na moeda de destino (arredondamento normal). */
export function converterParaMoeda(valorCentsEur: number, taxa: number): number {
  return Math.round(valorCentsEur * taxa);
}

/**
 * "8,70 £" / "R$ 62,00" — sempre com as duas casas decimais.
 *
 * BRL usa pt-BR de propósito: quem paga por Pix lê em português do Brasil, e
 * «R$ 62,00» é a forma que a app do banco mostra. GBP fica em pt-PT («8,70 £»),
 * a mesma convenção de formatarEuros («10 €») — mudar o símbolo de lugar só
 * para parecer inglês criaria uma inconsistência no mesmo ecrã.
 */
export function formatarMoeda(centimos: number, moeda: MoedaEstrangeira): string {
  return new Intl.NumberFormat(moeda === "BRL" ? "pt-BR" : "pt-PT", {
    style: "currency",
    currency: moeda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centimos / 100);
}

/**
 * Valor a colar na app do banco: "62,00". Nas transferências em euros o
 * projeto copia o valor sem casas ("10"); num Pix ou numa transferência em
 * libras o separador decimal faz parte do que se escreve no campo.
 */
export function valorParaCopiar(centimos: number): string {
  return (centimos / 100).toFixed(2).replace(".", ",");
}

/** "21/10" a partir de "2026-10-21" — só para a legenda do câmbio. */
export function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

/**
 * A legenda do valor convertido. É o texto que impede alguém de ler «£8,70»
 * como um valor exato garantido: o valor é INDICATIVO e quem aplica o câmbio
 * final é o banco/Wise. Sem isto, uma campanha solidária promete um número que
 * não controla.
 */
export function legendaCambio(
  cambio: Cambio,
  valorCentsEur: number,
  moeda: MoedaEstrangeira
): string {
  const convertido = formatarMoeda(converterParaMoeda(valorCentsEur, cambio.taxas[moeda]), moeda);
  const quando =
    cambio.fonte === "BCE" && cambio.data
      ? `câmbio indicativo do BCE de ${dataCurta(cambio.data) ?? cambio.data}`
      : "câmbio indicativo de referência";

  return moeda === "BRL"
    ? `≈ ${convertido} · ${quando}. No Pix, envia exatamente este valor em reais.`
    : `≈ ${convertido} · ${quando}. A Wise aplica o câmbio dela antes de confirmares.`;
}
