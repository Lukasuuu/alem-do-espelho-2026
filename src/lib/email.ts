/**
 * Email transacional (FASE2) — ENV-GATED via EmailJS.
 *
 * 🔴 NÃO ATIVAR envio real enquanto as credenciais não forem fornecidas pelo
 *    Lucas. As três variáveis abaixo são as ÚNICAS autorizadas (públicas do
 *    EmailJS — nunca pedir nem armazenar senha):
 *      NEXT_PUBLIC_EMAILJS_SERVICE_ID  — Service ID da conta EmailJS
 *      NEXT_PUBLIC_EMAILJS_TEMPLATE_ID — Template ID do email do evento
 *      NEXT_PUBLIC_EMAILJS_PUBLIC_KEY  — Public key do EmailJS (safe p/ client)
 *
 * Enquanto não estiverem configuradas, enviarEmailNotificacao() é um no-op
 * seguro: nunca lança, nunca toca a rede, nunca rebenta o chamador. Assim que
 * as credenciais chegarem, implementar o corpo em "quandoConfigurado" e só
 * então o envio passa a disparar. Este é o ÚNICO ponto de saída de email do
 * projeto.
 */

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? "";
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? "";

/** true apenas quando as três credenciais EmailJS existem (vazias → desligado). */
export const EMAILJS_CONFIGURADO = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

export type ParametrosEmail = Record<string, string | number | boolean>;

/**
 * Envia um email transacional se (e só se) o EmailJS estiver configurado.
 * Sem credenciais → no-op seguro (retorna false), silencioso em produção e com
 * aviso único em dev. Com credenciais presentes mas implementação pendente →
 * lança um erro alto (tripwire), para nunca haver envio "morto" por engano.
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

  // quandoConfigurado — com as credenciais presentes, importar dinamicamente
  // @emailjs/browser (não está instalado de propósito) e enviar:
  //
  //   const { default: emailjs } = await import("@emailjs/browser");
  //   await emailjs.send(SERVICE_ID, TEMPLATE_ID, parametros, {
  //     publicKey: PUBLIC_KEY,
  //   });
  //   return true;
  //
  // Se o envio falhar, registar o erro e devolver false — nunca rebentar o
  // fluxo de inscrição/pagamento que o chamou.
  throw new Error(
    "[email] Credenciais presentes mas envio ainda não implementado. PARAR e pedir os dados reais antes de ativar."
  );
}
