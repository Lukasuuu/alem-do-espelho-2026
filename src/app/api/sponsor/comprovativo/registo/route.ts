import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, sponsorUploadRegistoSchema, type TipoErro } from "@/lib/validation";
import { SPONSOR_MOCK_ATIVO } from "@/lib/sponsor-mock";
import {
  FORMATOS_COMPROVATIVO,
  MENSAGENS_COMPROVATIVO,
  TAMANHO_MAXIMO,
  extensaoDe,
} from "@/lib/comprovativo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | { ok: true; comprovativoId: string; pagamentoId: string; pagamentoEstado: string }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/**
 * SIGNED UPLOAD do comprovativo do PATROCÍNIO — fase 2 de 2 (0011 r2).
 * Depois de o cliente fazer PUT do ficheiro direto ao bucket
 * sponsor-payment-proofs com a URL assinada (fase 1, POST /api/sponsor/
 * comprovativo), esta rota regista os metadados em comprovativos_sponsor e
 * passa o pagamento a proof_uploaded (canal upload) via RPC.
 *
 * O servidor NÃO confia nos metadados: re-verifica tamanho, extensão e a
 * coerência mime↔extensão; a RPC re-verifica o path (bucket dedicado, pasta
 * do sponsor, proof_token do pagamento) contra a posse_token.
 */
export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  const ip = obterIp(request.headers);
  const limite = rateLimit(`sponsor-comprovativo-registo:${ip}`);

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

  // 1. Corpo JSON (só metadados — o conteúdo já está no bucket)
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" }, { status: 400 });
  }

  let dados;
  try {
    dados = sponsorUploadRegistoSchema.parse(corpo);
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

  // 2. Re-verificação dos metadados (o cliente não é fonte de verdade)
  if (dados.tamanho > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.grande, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.grande } },
      { status: 422 }
    );
  }
  const extensao = extensaoDe(dados.storagePath);
  if (!extensao || FORMATOS_COMPROVATIVO[extensao] !== dados.mime) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.incompativel, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.incompativel } },
      { status: 422 }
    );
  }

  try {
    const supabase = getSupabase();

    if (SPONSOR_MOCK_ATIVO) {
      // QA em localhost (ver lib/sponsor-mock.ts) — sem tocar na Supabase.
      return NextResponse.json(
        {
          ok: true,
          comprovativoId: "00000000-0000-0000-0000-000000000004",
          pagamentoId: dados.pagamentoId,
          pagamentoEstado: "proof_uploaded",
        },
        { status: 201 }
      );
    }

    // 3. RPC: guard de posse + validação de path + INSERT + proof_uploaded
    const { data: registo, error: erroRegisto } = await supabase.rpc("registar_comprovativo_sponsor", {
      p_pagamento_id: dados.pagamentoId,
      p_storage_path: dados.storagePath,
      p_original_filename: dados.nomeFicheiro,
      p_mime_type: dados.mime,
      p_file_size: dados.tamanho,
      p_posse_token: dados.posseToken,
    });

    if (erroRegisto) {
      const codigo = erroRegisto.message ?? "";
      if (codigo.includes("pagamento_nao_encontrado") || codigo.includes("estado_invalido")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS_COMPROVATIVO.semPagamento, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.semPagamento } },
          { status: 404 }
        );
      }
      if (codigo.includes("storage_path_invalido") || codigo.includes("extensao_invalida") || codigo.includes("mime_invalido")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS_COMPROVATIVO.incompativel, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.incompativel } },
          { status: 422 }
        );
      }
      if (codigo.includes("tamanho_invalido")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS_COMPROVATIVO.grande, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.grande } },
          { status: 422 }
        );
      }
      if (codigo.includes("acesso_negado")) {
        console.error("[sponsor-comprovativo-registo] acesso_negado");
        return NextResponse.json(
          { ok: false, mensagem: "Não tens permissão para enviar o comprovativo deste patrocínio.", tipo: "validacao" },
          { status: 403 }
        );
      }
      console.error("[sponsor-comprovativo-registo] erro do supabase:", erroRegisto.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS_COMPROVATIVO.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = registo as { comprovativo_id: string; pagamento_estado: string };

    return NextResponse.json(
      {
        ok: true,
        comprovativoId: resultado.comprovativo_id,
        pagamentoId: dados.pagamentoId,
        pagamentoEstado: resultado.pagamento_estado,
      },
      { status: 201 }
    );
  } catch (erro) {
    console.error("[sponsor-comprovativo-registo] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS_COMPROVATIVO.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}