import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashIp, obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, metodoInscricaoSchema, type MetodoPagamento, type TipoErro } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["cdg1"];

type Resposta =
  | { ok: true; inscricaoId: string; metodo: MetodoPagamento }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/**
 * Marca o método de pagamento escolhido na modal. Chamado ANTES de
 * redirecionar para o SumUp e ao abrir MB Way / Transferência, para a
 * reconciliação manual saber por onde cada pessoa pagou.
 */
export async function PATCH(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`inscricao-metodo:${ip}`);

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

  // 3. Validação do formato (uuid + método)
  let dados;
  try {
    dados = metodoInscricaoSchema.parse(corpo);
  } catch (erro) {
    if (erro instanceof ZodError) {
      const campos: Record<string, string> = {};
      for (const issue of erro.issues) {
        const chave = String(issue.path[0] ?? "form");
        if (!campos[chave]) campos[chave] = issue.message;
      }
      return NextResponse.json(
        { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }

  // 4. Persistência
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("definir_metodo_inscricao", {
      p_inscricao_id: dados.inscricaoId,
      p_metodo: dados.metodo,
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("invalid_metodo")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { metodo: "Método de pagamento inválido." } },
          { status: 422 }
        );
      }
      if (codigo.includes("inscricao_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos a tua inscrição. Recarrega e tenta novamente.", tipo: "validacao" },
          { status: 404 }
        );
      }

      console.error("[inscricao-metodo] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = data as { status: "ok"; id: string; metodo: MetodoPagamento };

    return NextResponse.json({ ok: true, inscricaoId: resultado.id, metodo: resultado.metodo });
  } catch (erro) {
    console.error("[inscricao-metodo] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
