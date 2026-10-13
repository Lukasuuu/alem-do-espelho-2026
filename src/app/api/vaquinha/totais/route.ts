import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { MENSAGENS_VAQUINHA, type TotaisVaquinha } from "@/lib/vaquinha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Totais públicos da vaquinha (a barra). NUNCA devolve linhas individuais — a
 * RPC soma e devolve só os números, e as tabelas não têm política nenhuma de
 * RLS (nem anon lê as doações).
 *
 * Cache de 5 s na borda (stale-while-revalidate 10 s): no evento o ecrã do
 * salão e os ~100 telemóveis sondam isto a cada 15 s, e sem cache seriam ~7
 * pedidos por segundo à base. 5 s é curto de mais para alguém notar o atraso e
 * suficiente para a base não sentir o pico.
 *
 * SEM rate limit por IP (partilham todos o mesmo IP público no hotel) e sem
 * gate de fase: os totais são leitura pública e, sem config, a RPC devolve
 * zeros com ativa = false — nunca um erro.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("vaquinha_totais");

    if (error) {
      console.error("[vaquinha/totais] erro do supabase:", error.message);
      return NextResponse.json(
        { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, totais: data as TotaisVaquinha },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  } catch (erro) {
    console.error("[vaquinha/totais] falha inesperada:", erro);
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor },
      { status: 500 }
    );
  }
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
