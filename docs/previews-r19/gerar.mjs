/**
 * R19 v2 — pré-visualizações dos 4 emails (ADENDA 2) com dados FICTÍCIOS.
 *
 * Gera em docs/previews-r19/:
 *   • 01..04-*.html          — o HTML EXACTO que a Edge Function mandaria ao Resend;
 *   • 01..04-*-sem-imagens.html — o MESMO HTML com os <img> REMOVIDOS — simula
 *     o pior caso de imagens bloqueadas (nem alt aparece). É a prova da regra
 *     da ADENDA 2: «o email tem de continuar legível e completo»;
 *   • 01..04-*.txt           — a versão texto simples;
 *   • previews.html          — índice com cada modelo a 600px (desktop) e 320px
 *     (mobile), o par normal + sem-imagens, assuntos e texto simples.
 *
 * Fonte única real: importa os MESMOS supabase/functions/_shared/templates.ts
 * e config.ts que a Edge Function usa (Node 24 remove tipos de .ts nativamente).
 *
 * Verificações obrigatórias — o script PÁRA com exit 1 se:
 *   7.2   aparecer `{{` ou `}}` no HTML renderizado (variável por interpolar);
 *   7.3   (v2) algum <img> com src FORA dos 3 ASSETS de config.ts ou com alt
 *         vazio (com imagens bloqueadas, o alt é a única descrição da imagem);
 *   7.3b  o wa.me gerado (fallback da função) decodificado divergir da
 *         mensagem canónica de src/lib/pagamento.ts ou perder acentos;
 *   7.3c  na variante -sem-imagens faltar dado essencial (referência, valor,
 *         IBAN, número MB WAY, data/horário/local…) — a ADENDA 2 exige que a
 *         informação essencial viva em texto, não só na imagem.
 *
 * NADA é enviado: este script não fala com rede nenhuma.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { construirEmail } from "../../supabase/functions/_shared/templates.ts";
import { ASSETS } from "../../supabase/functions/_shared/config.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/* ---------------------------------------------------------------- fixtures */
/* Dados fictícios — espelham o formato dos `dados` que a base enfileira
 * (trigger 0012 + DADOS_FINANCEIROS de src/lib/pagamento.ts). NUNCA são
 * pessoas reais. A mensagem wa.me é a canónica de pagamento.ts (Adenda 1 §3)
 * — copiada aqui com comentário cruzado; o check 7.3b valida-a abaixo. */
const NOME = "Ana Exemplo Silva";
const REF = "a1b2c3d4";
const DADOS_FINANCEIROS = {
  iban: "IE60SUMU99036513007149",
  beneficiario: "Vitória Silva da Conceição Gomes",
  bic: "SUMUIE22XXX",
  instituicao: "SumUp Limited",
  mbway_numero: "+351 928 400 069",
  mbway_copiar: "928400069",
  sumup_url: "https://pay.sumup.com/b2c/QZW9NOCM",
};
const MENSAGEM_WA =
  `Olá, Vitória! Sou ${NOME} e a minha referência é ${REF}.\n` +
  `Vou anexar o comprovativo do pagamento da minha inscrição no Além do Espelho 2026.`;
const WA_URL = `https://wa.me/351928400069?text=${encodeURIComponent(MENSAGEM_WA)}`;

/* Destino das pré-visualizações — NUNCA fixo no código (o repo é público).
 * Define PREVIEW_TO no ambiente (ex.: setx PREVIEW_TO "o-teu@email") para
 * apontar para o teu endereço; o valor só viaja para o cabeçalho "para" do
 * email renderizado e nunca é enviado a lado nenhum. */
const PREVIEW_TO = process.env.PREVIEW_TO ?? "preview@example.com";

const modelos = [
  {
    id: "01-modelo-1-instrucoes",
    tipo: "instrucoes",
    descricao: "Modelo 1 — participante, após o formulário (botão «Anexar comprovativo»)",
    dados: { nome: NOME, referencia: REF, valor: "40,00 €", metodo: "transferencia", wa_url: WA_URL, ...DADOS_FINANCEIROS },
    // Dados que TÊM de sobreviver com as imagens bloqueadas (7.3c). O IBAN
    // aparece agrupado em blocos de 4 como na maquete.
    essencial: [REF, "40,00 €", "IE60 SUMU 9903 6513 0071 49", "+351 928 400 069", "Vitória Silva da Conceição Gomes", "SUMUIE22XXX"],
  },
  {
    id: "02-modelo-2-confirmacao",
    tipo: "confirmacao",
    descricao: "Modelo 2 — participante, pagamento validado (dispara pelo trigger 0012)",
    dados: { nome: NOME, referencia: REF, valor: "40,00 €", metodo: "transferencia" },
    essencial: [REF, "Confirmada", "Sábado, 17 de outubro de 2026", "09h30 às 18h00", "INNSiDE by Meliá Braga Centro", "Avenida Central 107, 4710-310 Braga"],
  },
  {
    id: "03-modelo-3-org",
    tipo: "org_nova_inscricao",
    descricao: "Modelo 3 — aviso interno (Adenda 1, correcção A: EXACTAMENTE 2 campos; sem assinatura)",
    dados: { data_hora: "25/09/2026 14:32", referencia: REF },
    essencial: [REF, "25/09/2026 14:32"],
  },
  {
    id: "04-comprovativo-recebido",
    tipo: "comprovativo_recebido",
    descricao: "comprovativo_recebido — upload no site (variante com nome; SumUp muda o assunto)",
    dados: { nome: NOME, referencia: REF, metodo: "mbway", valor: "40,00 €" },
    essencial: [REF, "Em validação"],
  },
];

mkdirSync(AQUI, { recursive: true });

/* --------------------------------------------------- 7.2 / 7.3 / 7.3b/3c -- */
let falhas = 0;

// 7.3b — exercitar o FALLBACK da função (instruções SEM wa_url): o HTML tem
// de conter um wa.me cujo texto decodificado é a mensagem canónica COM acentos.
const paraFallback = construirEmail({
  tipo: "instrucoes",
  destinatario: PREVIEW_TO,
  dados: { nome: NOME, referencia: REF, valor: "40,00 €", metodo: "transferencia", ...DADOS_FINANCEIROS },
});
const mWa = paraFallback.html.match(/https:\/\/wa\.me\/351928400069\?text=([^"]+)/);
if (!mWa) {
  console.error("FALHA 7.3b: o fallback da função não gerou wa.me no HTML de instruções.");
  falhas++;
} else {
  const decodificada = decodeURIComponent(mWa[1].replace(/&amp;/g, "&"));
  if (decodificada !== MENSAGEM_WA) {
    console.error("FALHA 7.3b: mensagem wa.me do fallback diverge da canónica de pagamento.ts:");
    console.error("  esperada:", JSON.stringify(MENSAGEM_WA));
    console.error("  obtida:  ", JSON.stringify(decodificada));
    falhas++;
  } else if (!/[áàâãéêíóôõúç]/i.test(decodificada)) {
    console.error("FALHA 7.3b: acentos perdidos no wa.me.");
    falhas++;
  } else {
    console.log("OK 7.3b: wa.me com acentos — mensagem decodificada idêntica à canónica.");
    console.log("  ", decodificada.split("\n")[0]);
  }
}

// 7.3 (v2) — que <img>s cada modelo DEVE ter (marca em todos; banner só no 02;
// retrato da Vitória nos 3 de participante; org NUNCA tem banner nem retrato).
const imgsEsperadas = {
  "01-modelo-1-instrucoes": [ASSETS.marca, ASSETS.vitoria],
  "02-modelo-2-confirmacao": [ASSETS.marca, ASSETS.banner, ASSETS.vitoria],
  "03-modelo-3-org": [ASSETS.marca],
  "04-comprovativo-recebido": [ASSETS.marca, ASSETS.vitoria],
};
const urlsAssets = Object.values(ASSETS);

for (const m of modelos) {
  const email = construirEmail({ tipo: m.tipo, destinatario: PREVIEW_TO, dados: m.dados });

  // 7.2 — qualquer {{ }} no HTML renderizado PÁRA TUDO.
  if (/\{\{|\}\}/.test(email.html)) {
    console.error(`FALHA 7.2: {{ ou }} encontrado no HTML renderizado de ${m.id} — parar tudo.`);
    falhas++;
    continue;
  }
  if (/\{\{|\}\}/.test(email.text)) {
    console.error(`FALHA 7.2: {{ ou }} encontrado no texto simples de ${m.id}.`);
    falhas++;
    continue;
  }

  // 7.3 (v2) — imagens permitidas MAS controladas: só os 3 URLs do Storage
  // (config.ASSETS) e alt NUNCA vazio (é a única descrição quando bloqueada).
  const imgs = email.html.match(/<img\b[^>]*>/gi) ?? [];
  const srcsVistos = [];
  for (const img of imgs) {
    const src = img.match(/\ssrc="([^"]*)"/i)?.[1] ?? "";
    const alt = img.match(/\salt="([^"]*)"/i)?.[1];
    if (!urlsAssets.includes(src)) {
      console.error(`FALHA 7.3: <img> em ${m.id} com src fora dos ASSETS de config.ts: ${src || "(vazio)"}`);
      falhas++;
    }
    if (alt === undefined || alt.trim() === "") {
      console.error(`FALHA 7.3: <img> em ${m.id} sem alt descritivo (src: ${src}).`);
      falhas++;
    }
    srcsVistos.push(src);
  }
  const esperadas = imgsEsperadas[m.id] ?? [];
  for (const esperada of esperadas) {
    if (!srcsVistos.includes(esperada)) {
      console.error(`FALHA 7.3: ${m.id} devia conter a imagem ${esperada.split("/").pop()} e não contém.`);
      falhas++;
    }
  }

  // 7.3c — variante -sem-imagens: <img> removidos (pior caso: nem o alt
  // aparece). A informação essencial TEM de continuar lá, em texto.
  const semImagens = email.html.replace(/<img\b[^>]*>/gi, "");
  for (const pedaco of m.essencial) {
    if (!semImagens.includes(pedaco)) {
      console.error(`FALHA 7.3c: com imagens bloqueadas, ${m.id} perde o essencial: "${pedaco}".`);
      falhas++;
    }
  }

  writeFileSync(path.join(AQUI, `${m.id}.html`), email.html);
  writeFileSync(path.join(AQUI, `${m.id}-sem-imagens.html`), semImagens);
  writeFileSync(path.join(AQUI, `${m.id}.txt`), `ASSUNTO: ${email.subject}\n\n${email.text}`);
  console.log(
    `OK ${m.id}: ${imgs.length} <img> nos ASSETS com alt · sem-imagens completo · ${email.subject}`,
  );
}

// Variante SumUp do comprovativo (assunto «declaração») — só para conferência
// do assunto, não gera ficheiro extra.
const assuntoSumup = construirEmail({
  tipo: "comprovativo_recebido",
  destinatario: PREVIEW_TO,
  dados: { nome: NOME, referencia: REF, metodo: "sumup" },
}).subject;
console.log(`OK variante SumUp: ${assuntoSumup}`);

if (falhas > 0) {
  console.error(`\n${falhas} FALHA(S) — parar: nada é entregue ao Lucas sem estes checks verdes.`);
  process.exit(1);
}

/* ------------------------------------------------------------------ índice */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const blocos = modelos
  .map((m) => {
    const email = construirEmail({ tipo: m.tipo, destinatario: "x@example.com", dados: m.dados });
    return `
  <section style="margin:0 0 56px;">
    <h2 style="font-family:Georgia,serif;color:#49242B;margin:0 0 4px;">${esc(m.descricao)}</h2>
    <p style="font-family:Arial,sans-serif;color:#6B6B63;margin:0 0 16px;">Assunto: <strong>${esc(email.subject)}</strong>
      · <a href="./${m.id}.html" style="color:#667360;">abrir sozinho</a> · <a href="./${m.id}-sem-imagens.html" style="color:#667360;">sem imagens</a> · <a href="./${m.id}.txt" style="color:#667360;">texto simples</a></p>
    <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;">
      <div style="flex:0 1 600px;min-width:300px;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;color:#6B6B63;margin-bottom:6px;">DESKTOP · 600PX</div>
        <iframe src="./${m.id}.html" title="${esc(m.id)} desktop" style="width:600px;max-width:100%;height:2200px;border:1px solid #E8C9CA;border-radius:10px;background:#fff;"></iframe>
      </div>
      <div style="flex:0 0 320px;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;color:#6B6B63;margin-bottom:6px;">MOBILE · 320PX</div>
        <iframe src="./${m.id}.html" title="${esc(m.id)} mobile" style="width:320px;height:3600px;border:1px solid #E8C9CA;border-radius:10px;background:#fff;"></iframe>
      </div>
      <div style="flex:0 1 600px;min-width:300px;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1px;color:#6B6B63;margin-bottom:6px;">IMAGENS BLOQUEADAS · 600PX</div>
        <iframe src="./${m.id}-sem-imagens.html" title="${esc(m.id)} sem imagens" style="width:600px;max-width:100%;height:2200px;border:1px dashed #BE747F;border-radius:10px;background:#fff;"></iframe>
      </div>
    </div>
  </section>`;
  })
  .join("\n");

const indice = `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pré-visualizações R19 v2 — Além do Espelho 2026</title></head>
<body style="margin:0;background:#FAF7F2;padding:40px 24px;">
<div style="max-width:1400px;margin:0 auto;">
  <p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;color:#667360;margin:0 0 6px;">R19 · V2 (ADENDA 2) · PRÉ-VISUALIZAÇÕES · DADOS FICTÍCIOS</p>
  <h1 style="font-family:Georgia,serif;color:#49242B;margin:0 0 8px;">Os quatro emails, com a marca</h1>
  <p style="font-family:Arial,sans-serif;color:#2E2B29;line-height:1.6;margin:0 0 32px;">
    Gerados pelos MESMOS templates da Edge Function (<code>_shared/templates.ts</code>) — não há cópia.
    Cada modelo a 600&nbsp;px (desktop) e 320&nbsp;px (mobile) — no mobile a assinatura passa para baixo
    (media query &lt;480px) e o número de WhatsApp deixa de partir em duas linhas.
    A terceira coluna simula <strong>imagens bloqueadas</strong> (sem <code>&lt;img&gt;</code>, pior caso):
    o email tem de continuar legível e completo — regra da ADENDA 2.
    Checks 7.2 (sem <code>{{ }}</code>), 7.3 (imagens só dos ASSETS do Storage, com alt), 7.3b (wa.me com acentos)
    e 7.3c (essencial sobrevive sem imagens) correram antes destes ficheiros serem escritos —
    <strong>se o terminal disse FALHA, ignore esta página</strong>.
  </p>
  ${blocos}
  <p style="font-family:Arial,sans-serif;font-size:12px;color:#6B6B63;">Dados fictícios (Ana Exemplo Silva / ref a1b2c3d4). Nada daqui foi enviado a ninguém.</p>
</div>
</body></html>`;
writeFileSync(path.join(AQUI, "previews.html"), indice);

console.log("\nGerado: docs/previews-r19/previews.html (abrir no browser) + 4 .html + 4 -sem-imagens.html + 4 .txt");
console.log("PARA aqui — aprovação do Lucas antes de qualquer envio real (Bloco 7-BIS).");