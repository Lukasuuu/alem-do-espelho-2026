import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, estadoSponsorSchema, type TipoErro } from "@/lib/validation";
import { SPONSOR_MOCK_ATIVO } from "@/lib/sponsor-mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | {
      ok: true;
      /** Estado do pagamento ativo (ex.: proof_uploaded, confirmed, rejected). */
      estado: string;
      motivoRejeicao: string | null;
    }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/**
 * Polling do passo de comprovativo do patrocínio (Bloco J/0011, espelho de
 * estado_inscricao/0009): a modal consulta o estado do pagamento ativo para
 * detetar rejeição (mostra o motivo e permite reenvio). Leitura, sem escrita,
 * posse por posse_token. O cliente chama com moderação (não-agressivo).
 */
export async function PATCH(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`sponsor-estado:${ip}`);

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

  // 3. Validação do formato (uuid + token de posse)
  let dados;
  try {
    dados = estadoSponsorSchema.parse(corpo);
  } catch (erro) {
    if (erro instanceof ZodError) {
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" }, { status: 422 });
    }
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }

  // 4. Leitura
  if (SPONSOR_MOCK_ATIVO) {
    // QA em localhost (ver lib/sponsor-mock.ts) — sem tocar na Supabase.
    return NextResponse.json({ ok: true, estado: "proof_uploaded", motivoRejeicao: null });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("estado_sponsor", {
      p_sponsor_id: dados.sponsorId,
      p_posse_token: dados.posseToken,
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("sponsor_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos o teu registo. Recarrega e tenta novamente.", tipo: "validacao" },
          { status: 404 }
        );
      }
      if (codigo.includes("acesso_negado")) {
        // Token de posse não bate — sessão antiga/expirada.
        return NextResponse.json({ ok: false, mensagem: MENSAGENS.metodoServidor, tipo: "fase" }, { status: 403 });
      }

      console.error("[sponsor-estado] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = data as {
      pagamento_estado: string;
      motivo_rejeicao: string | null;
    };

    return NextResponse.json({
      ok: true,
      estado: resultado.pagamento_estado,
      motivoRejeicao: resultado.motivo_rejeicao ?? null,
    });
  } catch (erro) {
    console.error("[sponsor-estado] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}