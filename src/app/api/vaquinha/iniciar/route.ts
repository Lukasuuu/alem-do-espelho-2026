import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashIp, obterIp } from "@/lib/rate-limit";
import { MENSAGENS_VAQUINHA, erroDaVaquinha, iniciarDoacaoSchema } from "@/lib/vaquinha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tempo mínimo plausível. Muito mais baixo do que os 2,5 s da inscrição, e de
 * propósito: aqui são DOIS toques num cartão que já está à frente da pessoa
 * (escolher o valor, escolher o método), não um formulário com campos para
 * preencher. Medido na janela de teste: um percurso automático — mais rápido do
 * que qualquer pessoa — levava 1,5 s desde o carregamento da página, portanto
 * qualquer limiar acima disto rejeitava gente a sério com «não conseguimos
 * validar esta submissão». 800 ms continua a apanhar o script que carrega a
 * página e dispara logo; quem toca duas vezes não é travado.
 */
const TEMPO_MINIMO_MS = 800;

type Resposta =
  | {
      ok: true;
      status: "criada" | "existente";
      id: string;
      referencia: string;
      posseToken: string;
      valorCents: number;
      metodo: string;
      estado: string;
    }
  | { ok: false; mensagem: string; tipo: string; campos?: Record<string, string> };

/**
 * Cria a contribuição (estado 'iniciada') e devolve a referência ATOS-XXXX e o
 * token de posse. O cliente guarda o token só em memória React, como na
 * inscrição (B1/0009) — nunca em storage, cookie, URL nem log.
 *
 * SEM rate limit por IP de propósito: no evento as ~100 pessoas partilham o
 * mesmo IP público do hotel, e um limite por IP bloquearia a sala inteira. A
 * defesa é o idem_key (único, anti duplo clique) e o sinal grosso de abuso que
 * vive dentro da RPC (200 em 10 min, só sobre 'iniciada').
 *
 * O gate de fase é o SERVIDOR na RPC (ativa / já abriu / ainda não fechou): o
 * override de render (NEXT_PUBLIC_VAQUINHA_OVERRIDE) não abre nada aqui.
 */
export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Corpo do pedido
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.invalido, tipo: "validacao" },
      { status: 400 }
    );
  }

  // 2. Validação da fronteira
  let dados;
  try {
    dados = iniciarDoacaoSchema.parse(corpo);
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

  // 3. Armadilhas anti-bot — resposta genérica de propósito
  if (dados.website && dados.website.length > 0) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.bot, tipo: "bot" },
      { status: 400 }
    );
  }
  if (typeof dados.elapsedMs === "number" && dados.elapsedMs < TEMPO_MINIMO_MS) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.bot, tipo: "bot" },
      { status: 400 }
    );
  }

  // 4. Persistência (RPC SECURITY DEFINER — sem service role)
  try {
    const supabase = getSupabase();
    const ip = obterIp(request.headers);

    const { data, error } = await supabase.rpc("iniciar_doacao", {
      p_valor_cents: dados.valorCents,
      p_metodo: dados.metodo,
      p_idem_key: dados.idemKey,
      // Sinal de abuso apenas — a posse é o posse_token devolvido abaixo.
      p_ip_hash: hashIp(ip),
    });

    if (error) {
      const conhecido = erroDaVaquinha(error.message);
      if (conhecido) {
        return NextResponse.json(
          { ok: false, mensagem: conhecido.mensagem, tipo: "vaquinha" },
          { status: conhecido.status }
        );
      }
      console.error("[vaquinha/iniciar] erro do supabase:", error.message);
      return NextResponse.json(
        { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor, tipo: "servidor" },
        { status: 502 }
      );
    }

    const r = data as {
      status: "criada" | "existente";
      id: string;
      referencia: string;
      posse_token: string;
      valor_cents: number;
      metodo: string;
      estado: string;
    };

    // A RPC devolve posse_token em ambos os ramos. Sem token é sinal de base
    // fora de sincronia com a 0014 — nunca se imprime valor nenhum.
    if (!r?.posse_token) {
      console.error("[vaquinha/iniciar] posse_token ausente na resposta da RPC");
      return NextResponse.json(
        { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor, tipo: "servidor" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: r.status,
        id: r.id,
        referencia: r.referencia,
        posseToken: r.posse_token,
        valorCents: r.valor_cents,
        metodo: r.metodo,
        estado: r.estado,
      },
      { status: r.status === "criada" ? 201 : 200 }
    );
  } catch (erro) {
    console.error("[vaquinha/iniciar] falha inesperada:", erro);
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_VAQUINHA.servidor, tipo: "servidor" },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
