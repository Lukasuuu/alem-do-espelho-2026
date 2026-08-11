import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, metodoSponsorSchema, type MetodoSponsor, type TipoErro } from "@/lib/validation";
import { SPONSOR_MOCK_ATIVO } from "@/lib/sponsor-mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["cdg1"];

type Resposta =
  | { ok: true; sponsorId: string; metodo: MetodoSponsor }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/**
 * Marca o método de pagamento do patrocínio escolhido na modal. Chamado ao
 * abrir MB Way ou Transferência, para a reconciliação manual saber por onde
 * cada patrocinador pagou. Só mbway/transferencia — o SumUp é exclusivo da
 * inscrição e nunca aparece aqui.
 */
export async function PATCH(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`sponsor-metodo:${ip}`);

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
    dados = metodoSponsorSchema.parse(corpo);
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
  if (SPONSOR_MOCK_ATIVO) {
    // QA em localhost (ver lib/sponsor-mock.ts) — sem tocar na Supabase.
    return NextResponse.json({ ok: true, sponsorId: dados.sponsorId, metodo: dados.metodo });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("definir_metodo_sponsor", {
      p_sponsor_id: dados.sponsorId,
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
      if (codigo.includes("sponsor_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos o teu registo. Recarrega e tenta novamente.", tipo: "validacao" },
          { status: 404 }
        );
      }

      console.error("[sponsor-metodo] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = data as { status: "ok"; id: string; metodo: MetodoSponsor };

    return NextResponse.json({ ok: true, sponsorId: resultado.id, metodo: resultado.metodo });
  } catch (erro) {
    console.error("[sponsor-metodo] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
