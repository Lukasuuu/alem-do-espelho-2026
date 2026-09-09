import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, sponsorUploadPedidoSchema, type TipoErro } from "@/lib/validation";
import { SPONSOR_MOCK_ATIVO } from "@/lib/sponsor-mock";
import {
  BUCKET_COMPROVATIVOS_SPONSOR,
  FORMATOS_COMPROVATIVO,
  MENSAGENS_COMPROVATIVO,
  TAMANHO_MAXIMO,
  detetarTipo,
  extensaoDe,
} from "@/lib/comprovativo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | { ok: true; signedUrl: string; storagePath: string; pagamentoEstado: string }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/**
 * SIGNED UPLOAD do comprovativo do PATROCÍNIO — fase 1 de 2 (0011 r2).
 *
 * Por que em vez do multipart: o proxy da Vercel corta o corpo do request a
 * ~4,5 MB, mas o bucket aceita 8 MB — um comprovativo de 6 MB era validado
 * aqui e PERDIDO no proxy. Em vez disso:
 *   1. o cliente envia SÓ o nome, o tamanho e os primeiros 64 bytes (base64);
 *   2. esta rota valida extensão + tamanho + magic bytes NO SERVIDOR;
 *   3. valida ownership/estado via RPC (posse_token, devolve proof_token);
 *   4. emite uma signed upload URL para o bucket PRIVADO
 *      sponsor-payment-proofs — o PUT do ficheiro vai direto ao Supabase,
 *      sem passar por esta rota;
 *   5. o cliente chama POST /api/sponsor/comprovativo/registo para registar
 *      os metadados (fase 2).
 * O path é construído AQUI (nunca pelo cliente):
 *   sponsor-payment-proofs/{sponsor_id}/{proof_token}/{uuid}.{ext}
 */
export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  const ip = obterIp(request.headers);
  const limite = rateLimit(`sponsor-comprovativo:${ip}`);

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

  // 1. Corpo JSON (não multipart — o ficheiro grande nunca passa por aqui)
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" }, { status: 400 });
  }

  let dados;
  try {
    dados = sponsorUploadPedidoSchema.parse(corpo);
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

  // 2. Tamanho e extensão (nome)
  if (dados.tamanho > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.grande, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.grande } },
      { status: 422 }
    );
  }

  const extensao = extensaoDe(dados.nomeFicheiro);
  if (!extensao) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.formato, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.formato } },
      { status: 422 }
    );
  }

  // 3. Conteúdo real (magic bytes do prefixo). O MIME detetado tem de bater
  //    certo com o da extensão reclamada — senão é extensão disfarçada.
  let prefixo: Uint8Array;
  try {
    prefixo = new Uint8Array(Buffer.from(dados.primeirosBytesBase64, "base64"));
  } catch {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.formato, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.formato } },
      { status: 422 }
    );
  }
  const tipo = detetarTipo(prefixo);
  if (!tipo) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.formato, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.formato } },
      { status: 422 }
    );
  }
  if (FORMATOS_COMPROVATIVO[extensao] !== tipo.mime) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.incompativel, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.incompativel } },
      { status: 422 }
    );
  }

  try {
    const supabase = getSupabase();

    if (SPONSOR_MOCK_ATIVO) {
      // QA em localhost (ver lib/sponsor-mock.ts) — sem tocar na Supabase.
      return NextResponse.json({
        ok: true,
        signedUrl: "https://mock.supabase.local/storage/v1/upload/sign/mock",
        storagePath: `sponsor-payment-proofs/${dados.sponsorId}/00000000-0000-0000-0000-000000000003/${randomUUID()}.${tipo.ext}`,
        pagamentoEstado: "awaiting_proof",
      });
    }

    // 4. Ownership + estado do pagamento; recebe o proof_token do servidor.
    // B1/0011: ownership pelo posse_token (capability). Também faz a
    // transição payment_started/rejected → awaiting_proof.
    const { data: validacao, error: erroValidacao } = await supabase.rpc("validar_comprovativo_upload_sponsor", {
      p_pagamento_id: dados.pagamentoId,
      p_sponsor_id: dados.sponsorId,
      p_posse_token: dados.posseToken,
    });

    if (erroValidacao) {
      const codigo = erroValidacao.message ?? "";
      if (codigo.includes("pagamento_nao_encontrado") || codigo.includes("estado_invalido")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS_COMPROVATIVO.semPagamento, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.semPagamento } },
          { status: 404 }
        );
      }
      if (codigo.includes("acesso_negado")) {
        console.error("[sponsor-comprovativo] acesso_negado no pedido de URL");
        return NextResponse.json(
          { ok: false, mensagem: "Não tens permissão para enviar o comprovativo deste patrocínio.", tipo: "validacao" },
          { status: 403 }
        );
      }
      console.error("[sponsor-comprovativo] erro ao validar pagamento:", erroValidacao.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS_COMPROVATIVO.servidor, tipo: "servidor" }, { status: 502 });
    }

    const proofToken = (validacao as { proof_token: string }).proof_token;
    const storagePath = `${BUCKET_COMPROVATIVOS_SPONSOR}/${dados.sponsorId}/${proofToken}/${randomUUID()}.${tipo.ext}`;

    // 5. URL de upload direto. A policy de INSERT do bucket (token-gated
    //    sponsor-payment-proofs) é avaliada AQUI; o PUT subsequente usa o URL
    //    assinado — o ficheiro nunca atravessa a Vercel.
    const { data: url, error: erroUrl } = await supabase.storage
      .from(BUCKET_COMPROVATIVOS_SPONSOR)
      .createSignedUploadUrl(storagePath);

    if (erroUrl || !url) {
      console.error("[sponsor-comprovativo] erro de signed upload URL:", erroUrl?.message ?? "sem URL");
      return NextResponse.json({ ok: false, mensagem: MENSAGENS_COMPROVATIVO.servidor, tipo: "servidor" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      signedUrl: url.signedUrl,
      storagePath,
      pagamentoEstado: "awaiting_proof",
    });
  } catch (erro) {
    console.error("[sponsor-comprovativo] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS_COMPROVATIVO.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}