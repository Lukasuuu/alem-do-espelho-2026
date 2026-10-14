import { NextResponse } from "next/server";
import { z } from "zod";
import { procurarDoacaoAdmin } from "@/lib/vaquinha-servidor";
import { sessaoValida } from "@/lib/vaquinha-sessao";
import { MENSAGENS_VAQUINHA } from "@/lib/vaquinha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  // Só se exige que haja com que procurar: quem normaliza é a RPC (maiúsculas,
  // sem espaços nem hífenes), portanto «atos 83p2» e «83P2» chegam lá inteiros.
  referencia: z.string().trim().min(2, MENSAGENS_VAQUINHA.referenciaCurta).max(40),
});

/**
 * Procura por referência no painel da Vitória (0014c). Exige a sessão do link
 * pessoal; a chave admin fica no servidor, como nas outras rotas do painel.
 *
 * Distingue três coisas de propósito: 401 (sessão caiu → volta ao link), 422
 * (não escreveu nada de útil) e 502 (não conseguimos ler) — porque «não há
 * resultados» e «não consegui ler» não podem parecer a mesma coisa a quem está
 * a procurar um pagamento que pode estar ali.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await sessaoValida())) {
    return NextResponse.json({ ok: false, mensagem: "Sessão expirada." }, { status: 401 });
  }

  let termo: string;
  try {
    termo = corpoSchema.parse(await request.json()).referencia;
  } catch {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.referenciaCurta },
      { status: 422 }
    );
  }

  const lista = await procurarDoacaoAdmin(termo);
  if (!lista) {
    return NextResponse.json(
      { ok: false, mensagem: "Não conseguimos procurar agora. Tenta novamente." },
      { status: 502 }
    );
  }
  return NextResponse.json(
    { ok: true, doacoes: lista.doacoes, totais: lista.totais },
    { headers: { "Cache-Control": "no-store" } }
  );
}
