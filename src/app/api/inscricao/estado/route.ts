import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashIp, obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, type TipoErro } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["cdg1"];

type Resposta =
  | {
      ok: true;
      status: string;
      is_bonus: boolean;
      metodo: string | null;
      pagamento_id: string | null;
      pagamento_estado: string;
      motivo_rejeicao: string | null;
      comprovativo_status: string | null;
    }
  | { ok: false; mensagem: string; tipo: TipoErro };

const uuidSchema = z.string().uuid("Inscrição inválida.");

/**
 * Estado da inscrição + pagamento para o polling (não-agressivo) do modal.
 * A RPC verifica ownership pelo ip_hash: só o dono (mesmo IP do formulário)
 * consegue ler o estado — ninguém espreita a inscrição de outro.
 */
export async function GET(request: NextRequest): Promise<NextResponse<Resposta>> {
  const ip = obterIp(request.headers);
  // Polling gentil (~15 s) → 10/min dá folga sem abrir porta a spam.
  const limite = rateLimit(`inscricao-estado:${ip}`, 10);

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

  const inscricaoId = request.nextUrl.searchParams.get("inscricaoId");
  const parse = uuidSchema.safeParse(inscricaoId);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" },
      { status: 422 }
    );
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("estado_inscricao", {
      p_inscricao_id: parse.data,
      p_ip_hash: hashIp(ip),
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("inscricao_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos a tua inscrição.", tipo: "validacao" },
          { status: 404 }
        );
      }
      if (codigo.includes("acesso_negado")) {
        console.error("[inscricao-estado] acesso_negado");
        return NextResponse.json(
          { ok: false, mensagem: "Não tens permissão para consultar este estado.", tipo: "validacao" },
          { status: 403 }
        );
      }

      console.error("[inscricao-estado] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const estado = data as Omit<Extract<Resposta, { ok: true }>, "ok">;
    return NextResponse.json({ ok: true, ...estado });
  } catch (erro) {
    console.error("[inscricao-estado] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}
