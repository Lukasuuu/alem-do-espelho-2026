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
 *   • HTML + texto simples: supabase/functions/_shared/templates.ts (R19 —
 *     paleta sálvia/rosa/vinho/marfim, preheader escondido, 600px, tabelas +
 *     estilos inline, sem imagens externas, dados da base escapados). Este
 *     ficheiro mantém SÓ auth, reclamar lote, envio e concluir.
 *
 * Autorização: header `x-worker-secret` com WORKER_SECRET (nunca um JWT de
 * utilizador). O cron (FASE 5) e o Lucas (manual) chamam com este header.
 * Latência: o caminho rápido é a rota /api/ accionar o worker a seguir ao
 * enfileiramento; o cron minuto a minuto é a garantia (R15, nota de método).
 */

import { construirEmail } from "../_shared/templates.ts";

// ── Config ────────────────────────────────────────────────────────
const RESEND_API = "https://api.resend.com/emails";

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

// ── Handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const workerSecret = Deno.env.get("WORKER_SECRET");
  if (!workerSecret) return json({ ok: false, erro: "worker_nao_configurado" }, 500);

  const secreto = req.headers.get("x-worker-secret");
  if (!(await segredoValido(secreto, workerSecret))) {
    // R16 — corpo distinto do 401 do gateway: `segredo_invalido` significa que
    // esta função correu mas o WORKER_SECRET a montante não coincide; um 401
    // do gateway (ex.: {"message":"Missing authorization header"}) significa
    // Authorization ausente ou verify_jwt a rejeitar — sem chegar aqui.
    return json({ ok: false, erro: "segredo_invalido" }, 401);
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
      // R19: templates partilhados — subject + html + text num só sítio
      // (_shared/templates.ts). Tipo desconhecido lança → backoff (como antes).
      const email = construirEmail({
        tipo: linha.tipo,
        destinatario: linha.destinatario,
        dados: linha.dados ?? {},
      });

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
          subject: email.subject,
          html: email.html,
          text: email.text,
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