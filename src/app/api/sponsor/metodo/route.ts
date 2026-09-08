import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, metodoSponsorSchema, type MetodoSponsor, type TipoErro } from "@/lib/validation";
import { SPONSOR_MOCK_ATIVO } from "@/lib/sponsor-mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | {
      ok: true;
      sponsorId: string;
      metodo: MetodoSponsor;
      /** Pagamento ativo criado pela sequência (valor derivado do nível). */
      pagamento: { pagamentoId: string; estado: string };
    }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/**
 * Marca o método de pagamento do patrocínio escolhido na modal E cria o
 * pagamento na mesma sequência (espelho de /api/inscricao/metodo, Bloco J/0011):
 *   definir_metodo_sponsor → criar_pagamento_sponsor (valor derivado do nível).
 * Chamado ao abrir MB Way ou Transferência, para a reconciliação manual saber
 * por onde cada patrocinador pagou. Só mbway/transferencia — o SumUp é
 * exclusivo da inscrição e nunca aparece aqui.
 */
export async function PATCH(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`sponsor-metodo:${ip}`);

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
    dados = metodoSponsorSchema.parse(corpo);
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
  if (SPONSOR_MOCK_ATIVO) {
    // QA em localhost (ver lib/sponsor-mock.ts) — sem tocar na Supabase.
    return NextResponse.json({
      ok: true,
      sponsorId: dados.sponsorId,
      metodo: dados.metodo,
      pagamento: { pagamentoId: "00000000-0000-0000-0000-000000000002", estado: "payment_started" },
    });
  }

  try {
    const supabase = getSupabase();

    // Sequência espelho de /api/inscricao/metodo (B1/0011):
    // 1. marca o método (guard de posse pela RPC);
    const { error: erroMetodo } = await supabase.rpc("definir_metodo_sponsor", {
      p_sponsor_id: dados.sponsorId,
      p_metodo: dados.metodo,
      p_posse_token: dados.posseToken,
    });

    if (erroMetodo) {
      const codigo = erroMetodo.message ?? "";
      if (codigo.includes("invalid_metodo")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { metodo: "Método de pagamento inválido." } },
          { status: 422 }
        );
      }
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

      console.error("[sponsor-metodo] erro ao definir método:", erroMetodo.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    // 2. cria o pagamento (idempotente; valor derivado do nível pela RPC).
    const { data: pagamento, error: erroPagamento } = await supabase.rpc("criar_pagamento_sponsor", {
      p_sponsor_id: dados.sponsorId,
      p_metodo: dados.metodo,
      p_posse_token: dados.posseToken,
    });

    if (erroPagamento) {
      const codigo = erroPagamento.message ?? "";
      if (codigo.includes("invalid_metodo")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { metodo: "Método de pagamento inválido." } },
          { status: 422 }
        );
      }
      if (codigo.includes("sponsor_nao_encontrada")) {
        return NextResponse.json(
          { ok: false, mensagem: "Não encontrámos o teu registo. Recarrega e tenta novamente.", tipo: "validacao" },
          { status: 404 }
        );
      }
      if (codigo.includes("nivel_nao_definido")) {
        // Falha de fase: o nível ainda não foi escolhido no passo B.
        return NextResponse.json(
          { ok: false, mensagem: "Escolhe primeiro o nível de parceria.", tipo: "fase" },
          { status: 422 }
        );
      }
      if (codigo.includes("acesso_negado")) {
        return NextResponse.json({ ok: false, mensagem: MENSAGENS.metodoServidor, tipo: "fase" }, { status: 403 });
      }

      console.error("[sponsor-metodo] erro ao criar pagamento:", erroPagamento.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = pagamento as {
      status: "criado" | "existente";
      pagamento_id: string;
      estado: string;
    };

    return NextResponse.json({
      ok: true,
      sponsorId: dados.sponsorId,
      metodo: dados.metodo,
      pagamento: { pagamentoId: resultado.pagamento_id, estado: resultado.estado },
    });
  } catch (erro) {
    console.error("[sponsor-metodo] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
