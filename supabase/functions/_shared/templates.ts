/**
 * Templates dos emails (R19 v2 — ADENDA 2) — marca real, voz da jornada,
 * assinatura da Vitória. FONTE DE VERDADE: docs/r19-v2/maquetes/*.html
 * («Reproduz estas maquetes; não reinterpretes») — o HTML abaixo é o das
 * maquetes com as variáveis por cima e os href="#" trocados por URLs reais.
 *
 * O que a ADENDA 2 muda face à v1:
 *   • IMAGENS PERMITIDAS (a regra «sem imagens» era da própria Vitória e foi
 *     revogada) — mas o email tem de ficar legível e completo com imagens
 *     bloqueadas: alt descritivo, background na célula (marca: #BE747F) e
 *     toda a informação essencial também em texto. Assets no Storage
 *     (config.ASSETS), independentes dos deploys — ordem FUNÇÃO PRIMEIRO.
 *   • TEXTO centrado na participante e na jornada («você», registo do banner
 *     e da Vitória), frases copiadas PALAVRA POR PALAVRA das maquetes.
 *   • ASSINATURA (cartão marfim + painel verde profundo) nos três modelos de
 *     participante. Mobile <480px: painel passa para baixo, a toda a largura
 *     (media query no <head>), e o número de WhatsApp leva white-space:nowrap
 *     — na maquete mobile ele partia em duas linhas.
 *   • Mantém-se da Adenda 1: Modelo 3 com EXACTAMENTE dois campos e assunto
 *     sem «PAGA»; botão «Anexar comprovativo» diz o passo manual em voz alta.
 *
 * Ficheiro PURO (sem APIs Deno/Node): importado por
 *   • enviar-emails/index.ts (Deno);
 *   • docs/previews-r19/gerar.mjs (Node 24 — type stripping nativo).
 *
 * Alterar aqui NÃO publica nada sozinho: `supabase functions deploy
 * enviar-emails` (ordem de publicação: FUNÇÃO PRIMEIRO, site depois).
 */
import { EVENTO, ASSETS } from "./config.ts";

export type TipoEmail =
  | "instrucoes"
  | "org_nova_inscricao"
  | "comprovativo_recebido"
  | "confirmacao";

export type DadosEmail = Record<string, string | undefined>;

export interface LinhaEmail {
  tipo: TipoEmail;
  destinatario: string;
  dados: DadosEmail;
}

export interface EmailPronto {
  subject: string;
  html: string;
  text: string;
}

/* ---------------------------------------------------------------- paleta -- */
/* Cores LITERAIS das maquetes v2 (docs/r19-v2/maquetes) — inline styles, sem
 * variáveis CSS: clientes de email não garantem custom properties. */

const C = {
  fundo: "#F6ECEC", // fundo exterior do email (maquete v2)
  marcaFundo: "#BE747F", // célula do cabeçalho com a imagem bloqueada
  borda: "#E9DFDA", // caixas de dados e cartões de pagamento
  salvia: "#667360", // pílula de acção principal
  salviaProfundo: "#455448", // pílula do comprovativo + painel da assinatura
  rosa: "#E8C9CA", // filete da citação, círculos 1 e 3
  vinho: "#49242B", // títulos e valores serif
  marfim: "#FAF7F2", // caixa das perguntas, cartão da assinatura
  texto: "#2E2B29",
  suave: "#6B6B63",
} as const;

const FONTE_SERIFA = "Georgia,'Times New Roman',serif";
const FONTE_TEXTO = "Arial,Helvetica,sans-serif";

/* ---------------------------------------------------------------- helpers -- */

/** Escapa dados da base (nome, referência, método, data_hora) e de config. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
}

function primeiroNome(nome?: string): string {
  const p = (nome ?? "").trim().split(/\s+/)[0];
  return p ? escapeHtml(p) : "";
}

/** «Olá, <strong>Ana</strong>.» — como nas maquetes (ponto, não exclamação). */
function saudacao(nome?: string): string {
  const p = primeiroNome(nome);
  return p ? `Olá, <strong>${p}</strong>.` : "Olá.";
}

/* ---------------------------------------------------------------- blocos -- */

const IMG_MARCA =
  `<img src="${ASSETS.marca}" width="600" alt="Além do Espelho · Além de Mim — 2.ª edição" ` +
  `style="display:block;width:100%;max-width:600px;height:auto;border:0;background:${C.marcaFundo};color:#FFFFFF;font-family:${FONTE_SERIFA};font-size:22px;">`;

const IMG_BANNER =
  `<img src="${ASSETS.banner}" width="544" alt="As convidadas do Além do Espelho 2026" ` +
  `style="display:block;width:100%;height:auto;border:0;border-radius:12px;margin:4px 0 8px;">`;

function kicker(texto: string): string {
  return `<div style="font-family:${FONTE_TEXTO};font-size:11px;letter-spacing:2.4px;color:${C.salviaProfundo};font-weight:bold;margin:0 0 14px;">${texto}</div>`;
}

function titulo(html: string): string {
  return `<h1 style="margin:0 0 22px;font-family:${FONTE_SERIFA};font-size:27px;line-height:1.3;font-weight:normal;color:${C.vinho};">${html}</h1>`;
}

function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONTE_TEXTO};font-size:15.5px;line-height:1.7;color:${C.texto};">${html}</p>`;
}

/** Nota pequena cinza (13px) — «Caso já tenha enviado…». */
function pPequena(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONTE_TEXTO};line-height:1.7;font-size:13px;color:${C.suave};">${html}</p>`;
}

/** Citação em serifa itálico com filete rosa de 3px à esquerda (maquetes). */
function citacao(texto: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 26px;"><tr>` +
    `<td width="3" style="background:${C.rosa};"></td>` +
    `<td style="padding:4px 0 4px 18px;font-family:${FONTE_SERIFA};font-style:italic;font-size:18px;line-height:1.55;color:${C.salviaProfundo};">${texto}</td>` +
    `</tr></table>`
  );
}

/** Legenda centrada sob o banner (Modelo 2). */
function legendaCentrada(texto: string): string {
  return `<p style="margin:0 0 26px;font-family:${FONTE_TEXTO};font-size:12.5px;line-height:1.7;color:${C.suave};text-align:center;">${texto}</p>`;
}

/** Rótulo + valor serif de uma caixa de dados. */
function campoBox(rotulo: string, valor: string): string {
  return (
    `<div style="font-family:${FONTE_TEXTO};font-size:10.5px;letter-spacing:1.6px;color:${C.suave};font-weight:bold;">${rotulo}</div>` +
    `<div style="margin-top:6px;font-family:${FONTE_SERIFA};font-size:22px;color:${C.vinho};word-break:break-word;">${valor}</div>`
  );
}

/** Caixa de dados com borda fina e divisor vertical (maquetes: REFERÊNCIA |
 *  INVESTIMENTO, Nº | ESTADO). As duas colunas mantêm-se lado a lado no
 *  mobile (confirmado na maquete mobile). */
function caixaDados2(a: [string, string], b: [string, string]): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.borda};border-radius:14px;margin:0 0 22px;"><tr>` +
    `<td width="55%" style="padding:18px 22px;">${campoBox(a[0], a[1])}</td>` +
    `<td width="45%" style="padding:18px 22px;border-left:1px solid ${C.borda};">${campoBox(b[0], b[1])}</td>` +
    `</tr></table>`
  );
}

/** Título de secção serif 20px («Garanta o seu lugar», «Já fez o pagamento?»). */
function secaoTitulo(texto: string): string {
  return `<div style="margin:30px 0 14px;font-family:${FONTE_SERIFA};font-size:20px;color:${C.vinho};">${texto}</div>`;
}

/** Cartão de pagamento — borda fina, número sálvia, título bold, sub cinza. */
function cartaoPagamento(numero: string, nome: string, sub: string, extraHtml: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid ${C.borda};border-radius:12px;margin:0 0 10px;"><tr><td style="padding:16px 20px;">` +
    `<div style="font-family:${FONTE_TEXTO};font-size:14.5px;color:${C.vinho};"><span style="color:${C.salvia};font-weight:bold;">${numero}</span>&nbsp;&nbsp;<strong>${nome}</strong></div>` +
    `<div style="margin:3px 0 0;font-family:${FONTE_TEXTO};font-size:12.5px;color:${C.suave};">${sub}</div>` +
    extraHtml +
    `</td></tr></table>`
  );
}

/** Campo rótulo/valor dentro de um cartão (NÚMERO, BENEFICIÁRIA, IBAN…). */
function campoCartao(rotulo: string, valor: string): string {
  return (
    `<div style="margin-top:10px;font-family:${FONTE_TEXTO};font-size:11px;letter-spacing:1px;color:${C.suave};font-weight:bold;">${rotulo}</div>` +
    `<div style="font-family:${FONTE_TEXTO};font-size:15px;color:${C.texto};word-break:break-word;">${valor}</div>`
  );
}

/** Botão pílula — sálvia (acção principal) ou verde profundo (comprovativo). */
function botaoPillula(url: string, texto: string, bg: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 12px;"><tr><td style="background:${bg};border-radius:999px;">` +
    `<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 30px;font-family:${FONTE_TEXTO};font-size:14px;font-weight:bold;letter-spacing:.4px;color:#FFFFFF;text-decoration:none;">${texto}</a></td></tr></table>`
  );
}

/** Caixa «DOZE MOMENTOS · TRÊS PERGUNTAS» (marfim, círculos rosa/sálvia). */
function boxPerguntas(): string {
  const pergunta = (n: string, bg: string, fg: string, q: string, tags: string) =>
    `<tr><td width="44" valign="top" style="padding:0 0 16px;"><div style="width:32px;height:32px;line-height:32px;border-radius:16px;background:${bg};color:${fg};text-align:center;font-family:${FONTE_SERIFA};font-size:16px;">${n}</div></td>` +
    `<td valign="top" style="padding:3px 0 16px;"><div style="font-family:${FONTE_SERIFA};font-size:17px;line-height:1.35;color:${C.vinho};">${q}</div><div style="margin-top:3px;font-family:${FONTE_TEXTO};font-size:12px;letter-spacing:.3px;color:${C.suave};">${tags}</div></td></tr>`;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.marfim};border-radius:14px;margin:6px 0 22px;"><tr><td style="padding:24px 24px 10px;">` +
    `<div style="font-family:${FONTE_TEXTO};font-size:11px;letter-spacing:2px;color:${C.suave};font-weight:bold;margin:0 0 16px;">DOZE MOMENTOS · TRÊS PERGUNTAS</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    pergunta("1", C.rosa, C.vinho, "Como eu me vejo?", "Identidade · mentalidade · posicionamento") +
    pergunta("2", C.salvia, "#FFFFFF", "O que eu expresso e deixo no mundo?", "Marca pessoal · finanças · impacto · saúde") +
    pergunta("3", C.rosa, C.vinho, "O que permanece quando o espelho deixa de ser suficiente?", "Espiritualidade · superação · verdadeira beleza") +
    `</table></td></tr></table>`
  );
}

/** Linha DATA / HORÁRIO / LOCAL do Modelo 2 (todas com filete inferior, como
 *  na maquete — including a última). */
function linhaEvento(rotulo: string, valorHtml: string, subHtml = ""): string {
  return (
    `<tr><td style="padding:14px 0;border-bottom:1px solid ${C.borda};">` +
    `<div style="font-family:${FONTE_TEXTO};font-size:10.5px;letter-spacing:1.6px;color:${C.suave};font-weight:bold;">${rotulo}</div>` +
    `<div style="margin-top:4px;font-family:${FONTE_SERIFA};font-size:17px;color:${C.vinho};">${valorHtml}</div>` +
    (subHtml ? `<div style="font-family:${FONTE_TEXTO};font-size:13px;color:${C.suave};margin-top:2px;">${subHtml}</div>` : "") +
    `</td></tr>`
  );
}

/** Assinatura («anexo 1» da Vitória): cartão marfim + painel verde profundo.
 *  Mobile <480px (media query no layout): o painel passa para baixo, a toda
 *  a largura. O número leva nowrap — na maquete mobile partia em duas linhas.
 *  Número e local são dados de marca (mesmos de src/lib/pagamento.ts →
 *  MBWAY_NUMERO; alterar EM PAR se mudarem). */
function assinatura(): string {
  return (
    `<tr><td style="padding:10px 28px 32px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;background:${C.marfim};"><tr>` +
    `<td valign="middle" style="padding:22px 18px 22px 22px;" width="96"><img src="${ASSETS.vitoria}" width="84" height="84" alt="Vitória Gomes" style="display:block;border:0;border-radius:42px;"></td>` +
    `<td valign="middle" style="padding:22px 14px 22px 0;">` +
    `<div style="font-family:${FONTE_SERIFA};font-size:17px;color:${C.vinho};">Vitória Gomes</div>` +
    `<div style="margin:2px 0 10px;font-family:${FONTE_TEXTO};font-size:12px;color:${C.suave};">Anfitriã do Além do Espelho · Essence of Beauty</div>` +
    `<div style="font-family:${FONTE_TEXTO};font-size:12.5px;line-height:1.75;color:${C.texto};">WhatsApp <span style="white-space:nowrap;">+351 928 400 069</span><br>INNSiDE by Meliá, Braga<br><a href="${EVENTO.site_raiz}" style="color:${C.salviaProfundo};text-decoration:none;">essenceofbeautysalon.com</a></div></td>` +
    `<td class="sig-panel" valign="middle" align="center" width="150" style="background:${C.salviaProfundo};padding:22px 14px;">` +
    `<div style="font-family:${FONTE_SERIFA};font-size:19px;line-height:1.15;letter-spacing:1px;color:${C.marfim};">Além do<br>Espelho</div>` +
    `<div style="margin-top:8px;font-family:${FONTE_SERIFA};font-style:italic;font-size:13px;color:${C.rosa};">Além de Mim</div>` +
    `<div style="margin-top:10px;font-family:${FONTE_TEXTO};font-size:9.5px;letter-spacing:1.6px;color:${C.marfim};">2.ª EDIÇÃO · 2026</div></td>` +
    `</tr></table></td></tr>`
  );
}

function rodape(linha1: string, linha2: string): string {
  return (
    `<tr><td style="padding:0 28px 28px;"><div style="font-family:${FONTE_TEXTO};font-size:11.5px;line-height:1.6;color:${C.suave};text-align:center;">${linha1}<br>${linha2}</div></td></tr>`
  );
}

const RODAPE_INSCRICAO =
  "Você recebeu este e-mail porque se inscreveu no Além do Espelho 2026 em essenceofbeautysalon.com.";

/* ---------------------------------------------------------------- layout -- */

function layout(
  subject: string,
  preheaderText: string,
  corpoHtml: string,
  comAssinatura: boolean,
  rodapeHtml: string,
): string {
  // Sem assinatura (org): o conteúdo fecha com respiro próprio.
  const paddingCorpo = comAssinatura ? "34px 28px 8px" : "34px 28px 34px";
  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
<style>
@media only screen and (max-width:480px) {
  .sig-panel { display:block !important; width:100% !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:${C.fundo};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheaderText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fundo};"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;">
<tr><td style="padding:0;">${IMG_MARCA}</td></tr>
<tr><td style="padding:${paddingCorpo};">
${corpoHtml}
</td></tr>
${comAssinatura ? assinatura() : ""}
${rodapeHtml}
</table></td></tr></table>
</body>
</html>`;
}

/* --------------------------------------------- fallback wa.me (Modelo 1) -- */

/** Fallback para linhas enfileiradas ANTES de o site passar `wa_url` (ou se o
 *  campo vier a faltar): replica o texto CANÓNICO de src/lib/pagamento.ts →
 *  mensagemComprovativoWhatsApp(). Alterar os dois EM PAR. A mensagem é
 *  neutra (sem tu/você) e ficou INALTERADA na ADENDA 2. */
function waUrlFallback(nome: string, referencia: string, numeroDisplay: string): string {
  const texto =
    `Olá, Vitória! Sou ${nome || "participante"} e a minha referência é ${referencia}.\n` +
    `Vou anexar o comprovativo do pagamento da minha inscrição no ${EVENTO.nome}.`;
  return `https://wa.me/${numeroDisplay.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

/* ----------------------------------------------------------- Modelo 1 ---- */

function corpoInstrucoes(d: DadosEmail): string {
  const ref = escapeHtml(d.referencia ?? "");
  const valor = escapeHtml(d.valor ?? EVENTO.valor_texto);
  const waUrl = escapeHtml(
    d.wa_url || waUrlFallback(d.nome ?? "", d.referencia ?? "", d.mbway_numero ?? "+351 928 400 069"),
  );
  // Maquete 03: IBAN exibido agrupado em blocos de 4 («IE60 SUMU 9903 …»).
  const ibanExibicao = escapeHtml((d.iban ?? "—").replace(/(.{4})/g, "$1 ").trim());

  return (
    kicker("INSCRIÇÃO RECEBIDA · PAGAMENTO PENDENTE") +
    titulo("Toda transformação começa com uma decisão.<br>A sua já foi tomada.") +
    p(saudacao(d.nome)) +
    p(`Sua inscrição no <strong>${escapeHtml(EVENTO.nome)}</strong> foi efetuada com sucesso. Falta apenas um passo para garantir o seu lugar.`) +
    citacao(`Prepare-se para, no dia ${EVENTO.data_curta}, viver uma experiência que vai fazer você enxergar a vida com outro olhar.`) +
    p("Serão doze momentos para responder a três perguntas que ecoam dentro de cada uma de nós:") +
    boxPerguntas() +
    secaoTitulo("Garanta o seu lugar") +
    caixaDados2(["SUA REFERÊNCIA", ref], ["INVESTIMENTO", valor]) +
    cartaoPagamento("01", "Pagar online · SumUp", "Cartão, MB WAY ou Multibanco, em poucos segundos.",
      d.sumup_url
        ? `<div style="margin-top:12px;">${botaoPillula(escapeHtml(d.sumup_url), "Pagar online", C.salvia)}</div>`
        : "") +
    cartaoPagamento("02", "MB WAY", "Na app, escolha «Pagar por número».",
      campoCartao("NÚMERO", escapeHtml(d.mbway_numero ?? "—"))) +
    cartaoPagamento("03", "Transferência bancária", "Sem custos adicionais.",
      campoCartao("BENEFICIÁRIA", escapeHtml(d.beneficiario ?? "—")) +
      campoCartao("IBAN", ibanExibicao) +
      campoCartao("BIC / SWIFT", escapeHtml(d.bic ?? "—"))) +
    secaoTitulo("Já fez o pagamento?") +
    p("Envie o comprovativo para a Vitória. Ao tocar no botão, a conversa abre com o seu nome e a sua referência já escritos — é só tocar no ícone de anexo, escolher o comprovativo e enviar.") +
    botaoPillula(waUrl, "Anexar comprovativo", C.salviaProfundo) +
    pPequena("Caso já tenha enviado, pode desconsiderar esta mensagem.")
  );
}

/* ----------------------------------------------------------- Modelo 2 ---- */

function corpoConfirmacao(d: DadosEmail): string {
  const ref = escapeHtml(d.referencia ?? "");
  return (
    kicker("PAGAMENTO CONFIRMADO · LUGAR GARANTIDO") +
    titulo("Recebemos o seu pagamento.<br>O seu lugar está garantido.") +
    p(saudacao(d.nome)) +
    p(`Sua inscrição no <strong>${escapeHtml(EVENTO.nome)}</strong> está confirmada. A partir de agora, esta jornada também é sua.`) +
    citacao(`Prepare-se para, no dia ${EVENTO.data_curta}, viver uma experiência que vai fazer você enxergar a vida com outro olhar.`) +
    IMG_BANNER +
    legendaCentrada("As mulheres que vão caminhar com você nesta imersão de dentro para fora.") +
    caixaDados2(["Nº DE INSCRIÇÃO", ref], ["ESTADO", "Confirmada"]) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">` +
    linhaEvento("DATA", escapeHtml(EVENTO.data_extenso)) +
    // «09h30 às 18h00» como na maquete — derivado do horário canónico da config.
    linhaEvento("HORÁRIO", escapeHtml(EVENTO.horario.replace("–", " às "))) +
    linhaEvento("LOCAL", escapeHtml(EVENTO.local_nome), escapeHtml(EVENTO.local_morada)) +
    `</table>` +
    botaoPillula(EVENTO.mapa_url, "Ver localização", C.salvia) +
    `<p style="margin:14px 0 16px;font-family:${FONTE_TEXTO};font-size:15.5px;line-height:1.7;color:${C.texto};">No dia, apresente este e-mail ou a sua referência à chegada. E não precisa levar nada além de você.</p>`
  );
}

/* ----------------------------------------------------------- Modelo 3 ---- */
/* Adenda 1, correcção A (mantida na ADENDA 2): EXACTAMENTE dois campos.
 * A ADENDA 2 pede apenas o cabeçalho com a marca e o novo estilo de caixas —
 * sem assinatura, sem poesia: é para a equipa. */

function corpoOrg(d: DadosEmail): string {
  return (
    kicker("NOVA INSCRIÇÃO · A AGUARDAR PAGAMENTO") +
    titulo("Uma nova participante deu o primeiro passo.") +
    caixaDados2(["REFERÊNCIA", escapeHtml(d.referencia ?? "—")], ["REGISTADA EM", escapeHtml(d.data_hora ?? "—")]) +
    p("Comprovativos e detalhes de pagamento: Supabase (inscricoes / pagamentos / comprovativos).") +
    pPequena("Notificação interna destinada exclusivamente à equipa do evento. Este email não inclui dados pessoais (decisão de 06/09 — RGPD).")
  );
}

/* ------------------------------------------------ comprovativo recebido -- */

function corpoComprovativoRecebido(d: DadosEmail): string {
  // O tipo cobre MB Way/transferência (comprovativo real) E a declaração do
  // checkout SumUp (sem ficheiro). ADENDA 2 §4: no ramo SumUp muda o assunto
  // e a primeira frase passa a «a sua declaração de pagamento»; o título
  // acompanha o assunto (como no ramo normal, onde assunto espelha título).
  const porSumup = d.metodo === "sumup";
  return (
    kicker("COMPROVATIVO RECEBIDO") +
    titulo(porSumup ? "Recebemos a sua declaração de pagamento." : "O seu comprovativo chegou até nós.") +
    p(saudacao(d.nome)) +
    p(`Agora é conosco: vamos confirmar ${porSumup ? "a sua declaração de pagamento" : "o seu pagamento"} e, assim que estiver validado, você recebe a confirmação do seu lugar. Não precisa fazer mais nada.`) +
    citacao("Enquanto isso, guarde a data: 17 de outubro, em Braga. Uma jornada de dentro para fora está à sua espera.") +
    caixaDados2(["SUA REFERÊNCIA", escapeHtml(d.referencia ?? "—")], ["ESTADO", "Em validação"])
  );
}

/* ------------------------------------------------------ assuntos / texto -- */

function assunto(linha: LinhaEmail): string {
  const ref = linha.dados.referencia ?? "";
  switch (linha.tipo) {
    case "instrucoes":
      return `O seu primeiro passo para o Além do Espelho · ref ${ref}`;
    case "confirmacao":
      return `O seu lugar está garantido · Além do Espelho 2026`;
    case "org_nova_inscricao":
      // Adenda 1 §2 (mantida): nunca «Nova inscrição paga» — não há pagamento ainda.
      return `Nova inscrição · ref ${ref} — ${EVENTO.nome}`;
    case "comprovativo_recebido":
      // Caminho SumUp: é uma declaração, não há comprovativo em anexo.
      return linha.dados.metodo === "sumup"
        ? `Recebemos a sua declaração de pagamento · ref ${ref}`
        : `O seu comprovativo chegou até nós · ref ${ref}`;
  }
}

function preheader(linha: LinhaEmail): string {
  switch (linha.tipo) {
    case "instrucoes":
      return "Sua inscrição foi recebida. Falta só um passo para garantir o seu lugar.";
    case "confirmacao":
      return "Seu lugar no Além do Espelho 2026 está garantido. Guarde a sua referência.";
    case "org_nova_inscricao":
      return "Uma nova inscrição na página do evento — a aguardar validação de pagamento.";
    case "comprovativo_recebido":
      return "Recebemos o seu comprovativo. Em breve, a confirmação do seu lugar.";
  }
}

/** Versão texto simples (clientes sem HTML / leitores de ecrã) — mesmas
 *  frases; a citação passa a linha normal entre aspas. */
function textoSimples(linha: LinhaEmail): string {
  const d = linha.dados;
  const ref = d.referencia ?? "";
  const primeiro = (d.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const ola = primeiro ? `Olá, ${primeiro}.` : "Olá.";
  const waUrl = d.wa_url || waUrlFallback(d.nome ?? "", ref, d.mbway_numero ?? "+351 928 400 069");
  const ibanExibicao = (d.iban ?? "—").replace(/(.{4})/g, "$1 ").trim();
  const assinaturaTexto = [
    "—",
    "Vitória Gomes — Anfitriã do Além do Espelho · Essence of Beauty",
    "WhatsApp +351 928 400 069",
    "INNSiDE by Meliá, Braga",
    "essenceofbeautysalon.com",
  ];

  switch (linha.tipo) {
    case "instrucoes":
      return [
        "INSCRIÇÃO RECEBIDA · PAGAMENTO PENDENTE",
        "",
        "Toda transformação começa com uma decisão. A sua já foi tomada.",
        "",
        ola,
        "",
        `Sua inscrição no ${EVENTO.nome} foi efetuada com sucesso. Falta apenas um passo para garantir o seu lugar.`,
        "",
        `"Prepare-se para, no dia ${EVENTO.data_curta}, viver uma experiência que vai fazer você enxergar a vida com outro olhar."`,
        "",
        "Serão doze momentos para responder a três perguntas que ecoam dentro de cada uma de nós:",
        "",
        "DOZE MOMENTOS · TRÊS PERGUNTAS",
        "1 — Como eu me vejo? (Identidade · mentalidade · posicionamento)",
        "2 — O que eu expresso e deixo no mundo? (Marca pessoal · finanças · impacto · saúde)",
        "3 — O que permanece quando o espelho deixa de ser suficiente? (Espiritualidade · superação · verdadeira beleza)",
        "",
        "GARANTA O SEU LUGAR",
        `SUA REFERÊNCIA: ${ref}`,
        `INVESTIMENTO: ${d.valor ?? EVENTO.valor_texto}`,
        "",
        "01 · Pagar online · SumUp",
        "Cartão, MB WAY ou Multibanco, em poucos segundos.",
        d.sumup_url ?? "",
        "",
        "02 · MB WAY",
        "Na app, escolha «Pagar por número».",
        `NÚMERO: ${d.mbway_numero ?? "—"}`,
        "",
        "03 · Transferência bancária",
        "Sem custos adicionais.",
        `BENEFICIÁRIA: ${d.beneficiario ?? "—"}`,
        `IBAN: ${ibanExibicao} (copia sem espaços)`,
        `BIC / SWIFT: ${d.bic ?? "—"}`,
        "",
        "JÁ FEZ O PAGAMENTO?",
        "Envie o comprovativo para a Vitória. Ao tocar no botão, a conversa abre com o seu nome e a sua referência já escritos — é só tocar no ícone de anexo, escolher o comprovativo e enviar.",
        `Anexar comprovativo: ${waUrl}`,
        "",
        "Caso já tenha enviado, pode desconsiderar esta mensagem.",
        "",
        ...assinaturaTexto,
        "",
        "O seu lugar fica garantido após a validação do pagamento.",
        RODAPE_INSCRICAO,
      ].join("\n");

    case "confirmacao":
      return [
        "PAGAMENTO CONFIRMADO · LUGAR GARANTIDO",
        "",
        "Recebemos o seu pagamento. O seu lugar está garantido.",
        "",
        ola,
        "",
        `Sua inscrição no ${EVENTO.nome} está confirmada. A partir de agora, esta jornada também é sua.`,
        "",
        `"Prepare-se para, no dia ${EVENTO.data_curta}, viver uma experiência que vai fazer você enxergar a vida com outro olhar."`,
        "",
        "As mulheres que vão caminhar com você nesta imersão de dentro para fora.",
        "",
        `Nº DE INSCRIÇÃO: ${ref}`,
        "ESTADO: Confirmada",
        "",
        `DATA: ${EVENTO.data_extenso}`,
        `HORÁRIO: ${EVENTO.horario.replace("–", " às ")}`,
        `LOCAL: ${EVENTO.local_nome} — ${EVENTO.local_morada}`,
        `Ver localização: ${EVENTO.mapa_url}`,
        "",
        "No dia, apresente este e-mail ou a sua referência à chegada. E não precisa levar nada além de você.",
        "",
        ...assinaturaTexto,
        "",
        "O pagamento já foi confirmado — não precisa pagar novamente.",
        RODAPE_INSCRICAO,
      ].join("\n");

    case "org_nova_inscricao":
      return [
        "NOVA INSCRIÇÃO · A AGUARDAR PAGAMENTO",
        "",
        "Uma nova participante deu o primeiro passo.",
        "",
        `REFERÊNCIA: ${ref}`,
        `REGISTADA EM: ${d.data_hora ?? "—"} (Europe/Lisbon)`,
        "",
        "Comprovativos e detalhes de pagamento: Supabase (inscricoes / pagamentos / comprovativos).",
        "Notificação interna destinada exclusivamente à equipa do evento. Este email não inclui dados pessoais (decisão de 06/09 — RGPD).",
      ].join("\n");

    case "comprovativo_recebido": {
      const porSumup = d.metodo === "sumup";
      return [
        "COMPROVATIVO RECEBIDO",
        "",
        porSumup ? "Recebemos a sua declaração de pagamento." : "O seu comprovativo chegou até nós.",
        "",
        ola,
        "",
        `Agora é conosco: vamos confirmar ${porSumup ? "a sua declaração de pagamento" : "o seu pagamento"} e, assim que estiver validado, você recebe a confirmação do seu lugar. Não precisa fazer mais nada.`,
        "",
        "\"Enquanto isso, guarde a data: 17 de outubro, em Braga. Uma jornada de dentro para fora está à sua espera.\"",
        "",
        `SUA REFERÊNCIA: ${ref}`,
        "ESTADO: Em validação",
        "",
        ...assinaturaTexto,
        "",
        "Assim que o pagamento for validado, você recebe um novo e-mail.",
        RODAPE_INSCRICAO,
      ].join("\n");
    }
  }
}

/* --------------------------------------------------------------- entrada -- */

/** Ponto único: linha da fila → { subject, html, text }. Lança em tipo
 *  desconhecido (o handler trata como erro → backoff, como antes). */
export function construirEmail(linha: LinhaEmail): EmailPronto {
  const subject = assunto(linha);
  let corpo: string;
  let comAssinatura = true;
  let rodapeHtml = "";
  switch (linha.tipo) {
    case "instrucoes":
      corpo = corpoInstrucoes(linha.dados);
      rodapeHtml = rodape("O seu lugar fica garantido após a validação do pagamento.", RODAPE_INSCRICAO);
      break;
    case "confirmacao":
      corpo = corpoConfirmacao(linha.dados);
      rodapeHtml = rodape("O pagamento já foi confirmado — não precisa pagar novamente.", RODAPE_INSCRICAO);
      break;
    case "org_nova_inscricao":
      corpo = corpoOrg(linha.dados);
      comAssinatura = false;
      rodapeHtml = "";
      break;
    case "comprovativo_recebido":
      corpo = corpoComprovativoRecebido(linha.dados);
      rodapeHtml = rodape("Assim que o pagamento for validado, você recebe um novo e-mail.", RODAPE_INSCRICAO);
      break;
    default:
      throw new Error(`tipo_desconhecido:${(linha as { tipo?: string }).tipo ?? "?"}`);
  }
  return { subject, html: layout(subject, preheader(linha), corpo, comAssinatura, rodapeHtml), text: textoSimples(linha) };
}