/**
 * enviar-emails — R15 FASE 3: drena a fila emails_fila e envia via Resend.
 *
 * Regras do prompt (R15 + adenda):
 *   • O browser nunca envia emails nem decide destinatários — esta função lê
 *     a fila (destinatário e dados) da base e nunca recebe um email de fora.
 *   • Drenagem concorrente segura: reclamar_lote_emails usa
 *     `for update skip locked` (0012 §3) — não omitido, é o mecanismo.
 *   • Regras de falha (concluir_email, 0012 §4):
 *       2xx          → enviado
 *       422 / 400    → falhado à primeira (payload inválido não melhora com retry)
 *       429          → adia 6 h SEM incrementar tentativas (rate limit do Resend)
 *       5xx / rede   → retry com backoff 1min/5min/15min/1h/6h/24h, depois falhado
 *   • ultimo_erro é truncado a 500 chars NO SQL; aqui nunca se junta a API key
 *     a um erro, nunca se loga a key, nunca se devolve a key na resposta.
 *   • IBAN/MB Way/beneficiário/link SumUp NÃO vivem aqui — chegam em `dados`
 *     (enfileirados pelas rotas /api/ a partir de src/lib/pagamento.ts).
 *   • HTML: tabelas + estilos inline, sem imagens externas, sem emojis.
 *     Paleta da marca: verde #3D4A40, creme #F2CDBA, caixa #F4EFE7, botão #411618.
 *
 * Autorização: header `x-worker-secret` com WORKER_SECRET (nunca um JWT de
 * utilizador). O cron (FASE 5) e o Lucas (manual) chamam com este header.
 * Latência: o caminho rápido é a rota /api/ accionar o worker a seguir ao
 * enfileiramento; o cron minuto a minuto é a garantia (R15, nota de método).
 */

// ── Config ────────────────────────────────────────────────────────
const RESEND_API = "https://api.resend.com/emails";
const SITE_EVENTO = "https://essenceofbeautysalon.com/alem-do-espelho-2026";

// ── Utilitários ───────────────────────────────────────────────────

/** Compara segredos sem vazar timing (SHA-256 de ambos, comparação de digests). */
async function segredoValido(recebido: string | null, esperado: string): Promise<boolean> {
  if (!recebido) return false;
  const sub = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", sub.encode(recebido)),
    crypto.subtle.digest("SHA-256", sub.encode(esperado)),
  ]);
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function postgrestRpc<T>(fn: string, body: unknown, serviceKey: string): Promise<T> {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw new Error(`rpc ${fn} ${res.status}: ${texto.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

type LinhaFila = {
  id: string;
  inscricao_id: string;
  tipo: "instrucoes" | "org_nova_inscricao" | "comprovativo_recebido" | "confirmacao";
  destinatario: string;
  dados: Record<string, string>;
  tentativas: number;
};

// ── Layout HTML (tabelas + estilos inline; sem imagens externas) ──
const C = {
  verde: "#3D4A40",
  creme: "#F2CDBA",
  caixa: "#F4EFE7",
  vinho: "#411618",
  texto: "#2B2B2B",
  suave: "#6B6B63",
};

function layout(titulo: string, corpoHtml: string): string {
  return `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#EDE9E1;font-family:Georgia,'Times New Roman',serif;color:${C.texto};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE9E1;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;">
  <tr><td style="background:${C.verde};padding:28px 32px;">
    <div style="color:#FFFFFF;font-size:20px;letter-spacing:0.5px;">Além do Espelho 2026</div>
    <div style="color:${C.creme};font-size:13px;margin-top:4px;font-family:Arial,Helvetica,sans-serif;">Essence of Beauty &middot; INNSiDE by Meli&aacute;, Braga &middot; 17 de outubro</div>
  </td></tr>
  <tr><td style="padding:32px;">${corpoHtml}</td></tr>
  <tr><td style="background:${C.caixa};padding:20px 32px;">
    <div style="color:${C.suave};font-size:12px;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
      Recebeu este email porque foi feita uma inscri&ccedil;&atilde;o com este endere&ccedil;o em
      essenceofbeautysalon.com/alem-do-espelho-2026.
      Para falar connosco, responda a este email ou use o WhatsApp do sal&atilde;o.
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Linha de detalhe (rótulo → valor) dentro da caixa creme. */
function detalhe(rotulo: string, valor: string): string {
  return `<tr>
  <td style="padding:8px 14px;color:${C.suave};font-size:12px;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;vertical-align:top;">${rotulo}</td>
  <td style="padding:8px 14px;font-size:14px;line-height:1.5;word-break:break-word;"><strong>${valor}</strong></td>
</tr>`;
}

/** Caixa creme com pares rótulo/valor. */
function caixa(linhas: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="background:${C.caixa};border-radius:8px;margin:20px 0;">${linhas.join("")}</table>`;
}

function paragrafo(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;">${html}</p>`;
}

function saudacao(nome: string): string {
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "";
  return primeiro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;">Olá, <strong>${primeiro}</strong>.</p>` : "";
}

function botao(url: string, texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background:${C.vinho};border-radius:6px;">
  <a href="${url}" style="display:inline-block;padding:13px 28px;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:14px;text-decoration:none;">${texto}</a>
</td></tr></table>`;
}

const NOME_METODO: Record<string, string> = {
  sumup: "SumUp (link de pagamento)",
  mbway: "MB Way",
  qr: "Código QR",
  transferencia: "Transferência bancária",
};

// ── Corpos por tipo ───────────────────────────────────────────────
function corpoInstrucoes(d: Record<string, string>): string {
  const temMbway = !!d.mbway_numero;
  const temIban = !!d.iban;
  return `
${saudacao(d.nome)}
${paragrafo(`Recebemos a tua inscrição no <strong>Além do Espelho 2026</strong>. Falta só um passo: concluir o pagamento da inscrição (${d.valor ?? "40,00 €"}).`)}
${caixa([
    detalhe("Referência", d.referencia ?? "—"),
    detalhe("Valor", d.valor ?? "—"),
  ])}
${paragrafo("Escolhe uma das formas abaixo para pagar:")}

${d.sumup_url ? `<p style="margin:0 0 8px;font-size:15px;"><strong>1. Link de pagamento (SumUp)</strong></p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Paga em segundos com cartão, MB Way ou Multibanco:</p>
${botao(d.sumup_url, "Pagar com o link SumUp")}` : ""}

${temMbway ? `<p style="margin:24px 0 8px;font-size:15px;"><strong>${d.sumup_url ? "2" : "1"}. MB Way</strong></p>
${caixa([detalhe("Número", d.mbway_numero)])}
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Na app MB Way, escolhe <em>Pagar por número</em> e usa o número acima.</p>` : ""}

${temIban ? `<p style="margin:24px 0 8px;font-size:15px;"><strong>${[d.sumup_url, temMbway].filter(Boolean).length + 1}. Transferência bancária</strong></p>
${caixa([
    detalhe("IBAN", d.iban),
    detalhe("Beneficiário", d.beneficiario ?? "—"),
    ...(d.bic ? [detalhe("BIC", d.bic)] : []),
  ])}
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Se pedires o comprovativo no site, enviamos a confirmação logo que for validado.</p>` : ""}

${paragrafo(`Qualquer dúvida, responde a este email ou fala connosco no WhatsApp do salão. A tua referência é <strong>${d.referencia ?? "—"}</strong> — usa-a sempre que falar connosco.`)}`;
}

function corpoComprovativoRecebido(d: Record<string, string>): string {
  // Adenda 2 §1.1 — o tipo cobre MB Way/transferência (comprovativo real) E a
  // declaração do checkout SumUp (sem comprovativo; a SumUp tem registo
  // próprio). O texto varia pelo metodo que a base já colocou nos dados.
  const porSumup = d.metodo === "sumup";
  return `
${saudacao(d.nome)}
${paragrafo(
    porSumup
      ? "Recebemos a tua declaração de pagamento por cartão. Vamos verificar no SumUp e confirmamos por email."
      : "Recebemos o teu comprovativo de pagamento. Vamos validar e confirmamos por email logo que estiver verificado."
  )}
${caixa([
    detalhe("Referência", d.referencia ?? "—"),
    detalhe("Valor", d.valor ?? "—"),
    ...(d.metodo ? [detalhe("Método", NOME_METODO[d.metodo] ?? d.metodo)] : []),
  ])}
${paragrafo("Não precisas de fazer mais nada por agora. Se algo faltar, falamos contigo pelo WhatsApp ou por email.")}`;
}

function corpoConfirmacao(d: Record<string, string>): string {
  return `
${saudacao(d.nome)}
${paragrafo("O teu pagamento está <strong>confirmado</strong>. O teu lugar no Além do Espelho 2026 está garantido.")}
${caixa([
    detalhe("Referência", d.referencia ?? "—"),
    detalhe("Valor", d.valor ?? "—"),
    ...(d.metodo ? [detalhe("Método", NOME_METODO[d.metodo] ?? d.metodo)] : []),
  ])}
${paragrafo("Guarda este email: a referência acima identifica a tua inscrição no dia do evento.")}
${botao(SITE_EVENTO, "Ver o programa do dia")}`;
}

function corpoOrg(d: Record<string, string>): string {
  return `
${paragrafo("<strong>Nova inscrição paga</strong> no Além do Espelho 2026.")}
${caixa([
    detalhe("Quando", d.data_hora ?? "—"),
    detalhe("Referência", d.referencia ?? "—"),
  ])}
${paragrafo("Detalhes e comprovativos no painel do evento (sem dados pessoais neste email, por decisão RGPD de 06/09).")}`;
}

// ── Assuntos ──────────────────────────────────────────────────────
function assunto(l: LinhaFila): string {
  const ref = l.dados?.referencia ?? "";
  const base = "Além do Espelho 2026";
  switch (l.tipo) {
    case "instrucoes":
      return `Inscrição registada · ref ${ref} — ${base}`;
    case "comprovativo_recebido":
      // Adenda 2 §1.1: no caminho SumUp não há comprovativo — é uma declaração.
      return l.dados?.metodo === "sumup"
        ? `Recebemos a tua declaração · ref ${ref} — ${base}`
        : `Recebemos o teu comprovativo · ref ${ref} — ${base}`;
    case "confirmacao":
      return `Pagamento confirmado · ref ${ref} — ${base}`;
    case "org_nova_inscricao":
      return `Nova inscrição paga · ref ${ref} — ${base}`;
  }
}

const CORPOS: Record<LinhaFila["tipo"], (d: Record<string, string>) => string> = {
  instrucoes: corpoInstrucoes,
  comprovativo_recebido: corpoComprovativoRecebido,
  confirmacao: corpoConfirmacao,
  org_nova_inscricao: corpoOrg,
};

// ── Handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const workerSecret = Deno.env.get("WORKER_SECRET");
  if (!workerSecret) return json({ ok: false, erro: "worker_nao_configurado" }, 500);

  const secreto = req.headers.get("x-worker-secret");
  if (!(await segredoValido(secreto, workerSecret))) {
    return json({ ok: false, erro: "nao_autorizado" }, 401);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ ok: false, erro: "sem_service_role" }, 500);

  // Verifica a key ANTES de reclamar o lote: sem ela, as linhas não devem
  // entrar em a_enviar (não queimam tentativas de backoff — o cron volta a
  // chamar e nada se perde).
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ ok: false, erro: "sem_resend_api_key" }, 500);

  // 1. Reclamar lote (for update skip locked dentro da RPC).
  let lote: LinhaFila[];
  try {
    lote = await postgrestRpc<LinhaFila[]>("reclamar_lote_emails", { p_limite: 10 }, serviceKey);
  } catch (e) {
    return json({ ok: false, erro: "fila_indisponivel", detalhe: String(e).slice(0, 200) }, 502);
  }
  if (!Array.isArray(lote) || lote.length === 0) {
    return json({ ok: true, processados: 0 });
  }

  const remetente = Deno.env.get("EMAIL_REMETENTE") ?? "Além do Espelho <inscricoes@essenceofbeautysalon.com>";
  const replyTo = Deno.env.get("EMAIL_ORG") ?? "essenceofbeauty.pt@gmail.com";

  let enviados = 0, falhados = 0, reagendados = 0;

  // 2. Enviar cada linha; falha de UMA não interrompe o lote.
  for (const linha of lote) {
    try {
      const construir = CORPOS[linha.tipo];
      if (!construir) throw new Error(`tipo_desconhecido:${linha.tipo}`);

      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: remetente,
          to: [linha.destinatario],
          reply_to: replyTo,
          subject: assunto(linha),
          html: layout(assunto(linha), construir(linha.dados ?? {})),
        }),
      });

      const corpoTexto = await res.text().catch(() => "");
      let corpoJson: { id?: string; message?: string; name?: string } = {};
      try { corpoJson = JSON.parse(corpoTexto); } catch { /* corpo não-JSON */ }

      if (res.ok) {
        await concluir(serviceKey, linha.id, { ok: true, resend_id: corpoJson.id ?? null });
        enviados++;
      } else if (res.status === 422 || res.status === 400) {
        // Payload inválido — retry não ajuda: falhado à primeira (R15).
        await concluir(serviceKey, linha.id, {
          ok: false, definitivo: true,
          erro: `resend ${res.status}: ${corpoTexto.slice(0, 300)}`,
        });
        falhados++;
      } else if (res.status === 429) {
        // Rate limit — adia 6h SEM contar tentativa (R15).
        await concluir(serviceKey, linha.id, {
          ok: false, contar_tentativa: false, adiar_segundos: 6 * 3600,
          erro: `resend 429 (rate limit): ${corpoTexto.slice(0, 200)}`,
        });
        reagendados++;
      } else {
        // 5xx e outros — retry com backoff (concluir conta a tentativa).
        await concluir(serviceKey, linha.id, {
          ok: false, erro: `resend ${res.status}: ${corpoTexto.slice(0, 300)}`,
        });
        reagendados++;
      }
    } catch (e) {
      // Erro de rede/parse — mesmo caminho do 5xx: backoff.
      await concluir(serviceKey, linha.id, { ok: false, erro: `rede: ${String(e).slice(0, 300)}` })
        .catch(() => { /* nunca interromper o lote */ });
      reagendados++;
    }
  }

  return json({ ok: true, processados: lote.length, enviados, falhados, reagendados });
});

async function concluir(
  serviceKey: string,
  id: string,
  o: { ok: boolean; erro?: string | null; resend_id?: string | null; adiar_segundos?: number | null; definitivo?: boolean; contar_tentativa?: boolean },
): Promise<void> {
  await postgrestRpc("concluir_email", {
    p_email_fila_id: id,
    p_ok: o.ok,
    p_erro: o.erro ?? null,
    p_resend_id: o.resend_id ?? null,
    p_adiar_segundos: o.adiar_segundos ?? null,
    p_definitivo: o.definitivo ?? false,
    p_contar_tentativa: o.contar_tentativa ?? true,
  }, serviceKey);
}

function json(corpo: unknown, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}