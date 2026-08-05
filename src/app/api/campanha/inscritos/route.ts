import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { rateLimit, obterIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta = { ok: true; inscritos: number } | { ok: false; mensagem: string };

/**
 * GET /api/campanha/inscritos — counter público da campanha Ecobag.
 * Retorna o número de inscrições com is_bonus = true (máx. 50).
 * Rate limit: 60 req/min por IP. Cache: 30s no CDN.
 */
export async function GET(request: Request): Promise<NextResponse<Resposta>> {
  const ip = obterIp(request.headers);
  const limite = rateLimit(`campanha:${ip}`, 60, 60_000);

  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, mensagem: "Demasiados pedidos. Tenta novamente mais tarde." },
      { status: 429 }
    );
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("inscricoes_campanha_count");

    if (error) {
      console.error("[campanha/inscritos] erro do supabase:", error.message);
      return NextResponse.json(
        { ok: false, mensagem: "Erro ao obter dados da campanha." },
        { status: 502 }
      );
    }

    const inscritos = Number(data ?? 0);

    return NextResponse.json(
      { ok: true, inscritos },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (erro) {
    console.error("[campanha/inscritos] falha inesperada:", erro);
    return NextResponse.json(
      { ok: false, mensagem: "Erro interno." },
      { status: 500 }
    );
  }
}
