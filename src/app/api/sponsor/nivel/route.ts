import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import {
  MENSAGENS,
  nivelSponsorSchema,
  type NivelParceria,
  type TipoErro,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["cdg1"];

type Resposta =
  | { ok: true; sponsorId: string; nivel: NivelParceria }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/**
 * Marca o nível de parceria escolhido no passo B (depois do formulário).
 * No POST /api/sponsor o nível ainda é null; só aqui fica 75/150/200€, para a
 * reconciliação manual saber que valor cada patrocinadora vai pagar.
 */
export async function PATCH(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`sponsor-nivel:${ip}`);

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

  // 3. Validação do formato (uuid + nível fechado 75/150/200)
  let dados;
  try {
    dados = nivelSponsorSchema.parse(corpo);
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

    const { data, error } = await supabase.rpc("definir_nivel_sponsor", {
      p_sponsor_id: dados.sponsorId,
      p_nivel: dados.nivel,
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("invalid_nivel")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { nivel: "Escolhe um nível de parceria." } },
          { status: 422 }
        );
      }
      if (codigo.includes("sponsor_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos o teu registo. Recarrega e tenta novamente.", tipo: "validacao" },
          { status: 404 }
        );
      }

      console.error("[sponsor-nivel] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = data as { status: "ok"; id: string; nivel: NivelParceria };

    return NextResponse.json({ ok: true, sponsorId: resultado.id, nivel: resultado.nivel });
  } catch (erro) {
    console.error("[sponsor-nivel] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
