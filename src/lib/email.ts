/**
 * Email transacional (FASE2) — via EmailJS, com as credenciais reais
 * fornecidas pelo Lucas (11/08/2026): SERVICE_ID service_09wx5bn,
 * TEMPLATE_ID template_ix2xnxj ("Confirmação de Inscrição"), PUBLIC_KEY
 * pública por design do EmailJS (nunca pedir/armazenar senha SMTP).
 *
 * INVARIANTE DE SEGURANÇA (directiva): o envio de email é PARALELO e
 * INDEPENDENTE da confirmação do pagamento. Se o email falhar, a inscrição
 * já confirmada na DB continua confirmada — este módulo nunca bloqueia nem
 * reverte nada: captura o erro, regista e devolve false.
 *
 * ENV-GATED: se faltar QUALQUER uma das três variáveis, enviarEmailNotificacao()
 * é um no-op seguro (retorna false, nunca lança, nunca toca a rede). Só passa
 * a enviar com as três configuradas (NEXT_PUBLIC, inlined em build).
 * Este é o ÚNICO ponto de saída de email do projeto.
 */

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? "";
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? "";

/** true apenas quando as três credenciais EmailJS existem (vazias → desligado). */
export const EMAILJS_CONFIGURADO = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

/**
 * Parâmetros do template "Confirmação de Inscrição - Além do Espelho"
 * (template_ix2xnxj). Nomes EXATOS do template — não renomear.
 */
export type ParametrosEmail = {
  to_name: string; // nome do inscrito
  to_email: string; // email do inscrito
  amount: string | number; // valor pago (40)
  order_id: string; // referência — id da inscrição
  event_link: string; // link do evento
};

/**
 * Envia o email de confirmação de inscrição (fire-and-forget).
 * - Sem credenciais → no-op seguro (false), silencioso.
 * - Com credenciais → importa @emailjs/browser só nesta chamada (não pesa o
 *   bundle de quem nunca envia) e envia; qualquer falha é capturada aqui —
 *   o chamador nunca rebenta por causa de email.
 */
export async function enviarEmailNotificacao(
  parametros: ParametrosEmail
): Promise<boolean> {
  if (!EMAILJS_CONFIGURADO) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[email] EmailJS não configurado — envio ignorado. Define NEXT_PUBLIC_EMAILJS_SERVICE_ID / TEMPLATE_ID / PUBLIC_KEY para ativar."
      );
    }
    return false;
  }

  try {
    const { default: emailjs } = await import("@emailjs/browser");
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, parametros, {
      publicKey: PUBLIC_KEY,
    });
    return true;
  } catch (err) {
    // Directiva: email nunca bloqueia a confirmação de pagamento já processada.
    console.error("[email] Falha ao enviar email de confirmação:", err);
    return false;
  }
}
