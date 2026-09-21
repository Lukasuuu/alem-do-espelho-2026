import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, posseTokenSchema, type TipoErro } from "@/lib/validation";
import { acordarWorkerServer, enfileirarEmail } from "@/lib/fila-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | { ok: true }
  | { ok: false; mensagem: string; tipo: TipoErro };

const declaracaoSchema = z.object({
  inscricaoId: z.string().uuid("Inscrição inválida."),
  posseToken: posseTokenSchema,
});

/**
 * R15, adenda 2 §1.1 — declaração "Já fiz o pagamento" do checkout SumUp.
 *
 * No fluxo SumUp não há upload de comprovativo (a SumUp tem registo próprio,
 * decisão E 06/09) — sem a rota, a pessoa ficava com o último email a dizer
 * "falta só o pagamento". Esta rota enfileira o comprovativo_recebido (o MESMO
 * tipo do upload; o texto varia pelo metodo=sumup no compositor da Edge
 * Function) a partir do SERVIDOR: o browser só passa id + posse_token e nunca
 * decide destinatários nem conteúdo. O email de CONFIRMAÇÃO continua a ser
 * consequência do estado `confirmed` (trigger 0012), quando o pagamento for
 * verificado no painel SumUp.
 *
 * O id do pagamento não é preciso: o enfileirar_email lê o pagamento mais
 * recente da inscrição (metodo/valor) na base.
 */
export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  const ip = obterIp(request.headers);
  const limite = rateLimit(`inscricao-declarar:${ip}`);
  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.rateLimit, tipo: "rate" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limite.resetEm - Date.now()) / 1000)) } }
    );
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" }, { status: 400 });
  }

  let dados;
  try {
    dados = declaracaoSchema.parse(corpo);
  } catch (erro) {
    if (erro instanceof ZodError) {
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" }, { status: 422 });
    }
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.metodoServidor, tipo: "servidor" }, { status: 500 });
  }

  // Enfileiramento (nunca lança; a base valida a posse e decide destinatário).
  await enfileirarEmail(getSupabase(), dados.inscricaoId, dados.posseToken, "comprovativo_recebido");
  acordarWorkerServer();

  return NextResponse.json({ ok: true });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}