import { NextResponse } from "next/server";
import { lerDoacoesAdmin } from "@/lib/vaquinha-servidor";
import { sessaoValida } from "@/lib/vaquinha-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A lista que o painel do voluntário sonda a cada 15 s. Exige a sessão (cookie
 * httpOnly) e é o SERVIDOR que fala com a RPC de admin com a chave — o browser
 * nunca a vê. Sem no-store: uma lista de doações por confirmar não se serve de
 * cache nenhuma.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await sessaoValida())) {
    return NextResponse.json({ ok: false, mensagem: "Sessão expirada." }, { status: 401 });
  }
  const lista = await lerDoacoesAdmin();
  if (!lista) {
    return NextResponse.json(
      { ok: false, mensagem: "Não conseguimos ler as contribuições agora." },
      { status: 502 }
    );
  }
  return NextResponse.json(
    { ok: true, doacoes: lista.doacoes, totais: lista.totais },
    { headers: { "Cache-Control": "no-store" } }
  );
}
