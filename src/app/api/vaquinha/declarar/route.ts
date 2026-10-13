import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import {
  MENSAGENS_VAQUINHA,
  declararDoacaoSchema,
  erroDaVaquinha,
  type TotaisVaquinha,
} from "@/lib/vaquinha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | {
      ok: true;
      status: "declarada" | "ja_declarada";
      id: string;
      referencia: string;
      valorCents: number;
      totais: TotaisVaquinha;
    }
  | { ok: false; mensagem: string; tipo: string; campos?: Record<string, string> };

/**
 * "Já fiz a doação": 'iniciada' → 'declarada', que é o momento em que o valor
 * passa a contar na barra (como "a confirmar"). Devolve os totais já atualizados
 * para a barra subir sem um segundo pedido.
 *
 * Idempotente: declarar duas vezes responde 'ja_declarada' sem duplicar. O
 * travão anti-bot (menos de 10 s desde criada_em) vive na RPC, dentro do ramo
 * que escreve — um script que faz iniciar→declarar seguido bate lá.
 *
 * Posse pelo posse_token (nunca por IP): o corpo traz o id e o token que a rota
 * /iniciar devolveu, e o cliente só os tem em memória.
 */
export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.invalido, tipo: "validacao" },
      { status: 400 }
    );
  }

  let dados;
  try {
    dados = declararDoacaoSchema.parse(corpo);
  } catch (erro) {
    if (erro instanceof ZodError) {
      const campos: Record<string, string> = {};
      for (const issue of erro.issues) {
        const chave = String(issue.path[0] ?? "form");
        if (!campos[chave]) campos[chave] = issue.message;
      }
      return NextResponse.json(
        { ok: false, mensagem: MENSAGENS_VAQUINHA.invalido, tipo: "validacao", campos },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor, tipo: "servidor" },
      { status: 500 }
    );
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("declarar_doacao", {
      p_id: dados.id,
      p_posse_token: dados.posseToken,
    });

    if (error) {
      const conhecido = erroDaVaquinha(error.message);
      if (conhecido) {
        return NextResponse.json(
          { ok: false, mensagem: conhecido.mensagem, tipo: "vaquinha" },
          { status: conhecido.status }
        );
      }
      console.error("[vaquinha/declarar] erro do supabase:", error.message);
      return NextResponse.json(
        { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor, tipo: "servidor" },
        { status: 502 }
      );
    }

    const r = data as {
      status: "declarada" | "ja_declarada";
      id: string;
      referencia: string;
      valor_cents: number;
      totais: TotaisVaquinha;
    };

    return NextResponse.json(
      {
        ok: true,
        status: r.status,
        id: r.id,
        referencia: r.referencia,
        valorCents: r.valor_cents,
        totais: r.totais,
      },
      { status: 200 }
    );
  } catch (erro) {
    console.error("[vaquinha/declarar] falha inesperada:", erro);
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor, tipo: "servidor" },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
