import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashIp, obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, metodoInscricaoSchema, type MetodoPagamento, type TipoErro } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["cdg1"];

type Resposta =
  | {
      ok: true;
      inscricaoId: string;
      metodo: MetodoPagamento;
      pagamento: { pagamentoId: string; estado: string };
    }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/**
 * Marca o método de pagamento escolhido na modal e cria o pagamento
 * (estado payment_started). Chamado ANTES de redirecionar para o SumUp e ao
 * abrir MB Way / QR / Transferência, para a reconciliação manual saber por
 * onde cada pessoa pagou. O proof_token é gerado no servidor e nunca sai daqui.
 */
export async function PATCH(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`inscricao-metodo:${ip}`);

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
    dados = metodoInscricaoSchema.parse(corpo);
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
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("definir_metodo_inscricao", {
      p_inscricao_id: dados.inscricaoId,
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
      if (codigo.includes("inscricao_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos a tua inscrição. Recarrega e tenta novamente.", tipo: "validacao" },
          { status: 404 }
        );
      }

      console.error("[inscricao-metodo] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = data as { status: "ok"; id: string; metodo: MetodoPagamento };

    // FASE2: cria o pagamento (payment_started) e devolve o id para o fluxo
    // de comprovativo. Ownership verificado por ip_hash (dono da inscrição).
    const { data: pagamento, error: erroPagamento } = await supabase.rpc("criar_pagamento", {
      p_inscricao_id: resultado.id,
      p_metodo: resultado.metodo,
      p_ip_hash: hashIp(ip),
    });

    if (erroPagamento) {
      const codigo = erroPagamento.message ?? "";
      if (codigo.includes("invalid_metodo")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { metodo: "Método de pagamento inválido." } },
          { status: 422 }
        );
      }
      if (codigo.includes("inscricao_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos a tua inscrição. Recarrega e tenta novamente.", tipo: "validacao" },
          { status: 404 }
        );
      }
      if (codigo.includes("inscricao_cancelada")) {
        return NextResponse.json(
          { ok: false, mensagem: "A tua inscrição foi cancelada. Fala connosco no WhatsApp.", tipo: "fase" },
          { status: 422 }
        );
      }
      if (codigo.includes("acesso_negado")) {
        console.error("[inscricao-metodo] acesso_negado ao criar pagamento");
        return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 403 });
      }

      console.error("[inscricao-metodo] erro ao criar pagamento:", erroPagamento.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const pagamentoData = pagamento as { status: string; pagamento_id: string; estado: string };

    return NextResponse.json({
      ok: true,
      inscricaoId: resultado.id,
      metodo: resultado.metodo,
      pagamento: { pagamentoId: pagamentoData.pagamento_id, estado: pagamentoData.estado },
    });
  } catch (erro) {
    console.error("[inscricao-metodo] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
