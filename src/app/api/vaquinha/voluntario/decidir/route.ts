import { NextResponse } from "next/server";
import { z } from "zod";
import { decidirDoacaoAdmin } from "@/lib/vaquinha-servidor";
import { sessaoValida } from "@/lib/vaquinha-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["confirmada", "anulada"]),
  // A nota é opcional (a base aceita null); quando vem, é limpa de espaços.
  nota: z.string().max(300).optional().nullable(),
});

/** Confirmar ou anular uma doação. Exige a sessão; a chave admin fica no servidor. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await sessaoValida())) {
    return NextResponse.json({ ok: false, mensagem: "Sessão expirada." }, { status: 401 });
  }

  let dados: z.infer<typeof corpoSchema>;
  try {
    dados = corpoSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, mensagem: "Pedido inválido." }, { status: 422 });
  }

  const r = await decidirDoacaoAdmin(
    dados.id,
    dados.estado,
    dados.nota?.trim() ? dados.nota.trim() : null
  );
  if (!r.ok) {
    return NextResponse.json({ ok: false, mensagem: r.mensagem }, { status: 409 });
  }
  return NextResponse.json({ ok: true, referencia: r.referencia, estado: r.estado, totais: r.totais });
}
