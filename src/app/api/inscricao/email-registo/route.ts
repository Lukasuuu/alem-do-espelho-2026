import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, emailRegistoSchema, type TipoErro } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta = { ok: true } | { ok: false; mensagem: string; tipo: TipoErro };

/**
 * Bloco E — regista o resultado de um envio de email na inscrição
 * (colunas email_*_em/email_*_ok, RPC registar_envio_email da 0010).
 * O envio em si é client-side (EmailJS) e best-effort; o que aqui fica
 * gravado é a auditoria — a fonte de verdade de "quem pagou" é a base,
 * nunca o inbox. B1 (0009): o dono valida-se por posse_token (a 0010
 * passava por ip_hash — o B1 trocou para posse_token nesta RPC).
 * Chamado fire-and-forget pelo EventoPage depois de cada tentativa de
 * envio (cliente e organização) — falhas desta rota nunca chegam à pessoa.
 */
export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`inscricao-email:${ip}`);

  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.rateLimit, tipo: "rate" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limite.resetEm - Date.now()) / 1000)),
        },
      }
    );
  }

  // 2. Corpo do pedido
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" }, { status: 400 });
  }

  // 3. Validação do formato (uuid + destino + ok)
  let dados;
  try {
    dados = emailRegistoSchema.parse(corpo);
  } catch (erro) {
    if (erro instanceof ZodError) {
      return NextResponse.json(
        { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }

  // 4. Persistência (RPC SECURITY DEFINER da 0010)
  try {
    const supabase = getSupabase();

    const { error } = await supabase.rpc("registar_envio_email", {
      p_inscricao_id: dados.inscricaoId,
      p_posse_token: dados.posseToken,
      p_destino: dados.destino,
      p_ok: dados.ok,
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("invalid_destino")) {
        return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" }, { status: 422 });
      }
      if (codigo.includes("inscricao_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos a tua inscrição.", tipo: "validacao" },
          { status: 404 }
        );
      }
      if (codigo.includes("acesso_negado")) {
        console.error("[inscricao-email-registo] acesso_negado ao registar envio");
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" },
          { status: 403 }
        );
      }

      console.error("[inscricao-email-registo] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error("[inscricao-email-registo] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}