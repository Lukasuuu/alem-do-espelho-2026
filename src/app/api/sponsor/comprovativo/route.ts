import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, posseTokenSchema, type TipoErro } from "@/lib/validation";
import {
  BUCKET_COMPROVATIVOS,
  FORMATOS_COMPROVATIVO,
  MENSAGENS_COMPROVATIVO,
  TAMANHO_MAXIMO,
  detetarTipo,
  extensaoDe,
} from "@/lib/comprovativo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | { ok: true; comprovativoId: string; pagamentoId: string; pagamentoEstado: string }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

// Espelho de /api/comprovativo (Bloco J/0011) — campo sponsorId em vez de inscricaoId.
const idsSchema = z.object({
  sponsorId: z.string().uuid("Parceria inválida."),
  pagamentoId: z.string().uuid("Pagamento inválido."),
  posseToken: posseTokenSchema,
});

/**
 * Recebe o comprovativo do PATROCÍNIO (multipart/form-data) e:
 *   1. valida tamanho (≤ 8 MB) e formato por MAGIC BYTES no servidor
 *      (nunca confiar só na extensão do nome);
 *   2. verifica o dono e o estado do pagamento via RPC (devolve o
 *      proof_token gerado no servidor — o cliente nunca o envia);
 *   3. guarda o ficheiro no bucket PRIVADO payment-proofs no caminho
 *      payment-proofs/{sponsor_id}/{proof_token}/{uuid}.{ext};
 *   4. regista os metadados em comprovativos_sponsor e passa o pagamento a
 *      proof_uploaded. Nunca armazena base64 — só o path.
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

  // 1. Corpo multipart
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" },
      { status: 400 }
    );
  }

  const ids = idsSchema.safeParse({
    sponsorId: form.get("sponsorId"),
    pagamentoId: form.get("pagamentoId"),
    posseToken: form.get("posseToken"),
  });
  if (!ids.success) {
    const campos: Record<string, string> = {};
    for (const issue of ids.error.issues) {
      const chave = String(issue.path[0] ?? "form");
      if (!campos[chave]) campos[chave] = issue.message;
    }
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos },
      { status: 422 }
    );
  }

  const ficheiro = form.get("ficheiro");
  if (!ficheiro || typeof ficheiro === "string") {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { ficheiro: "Escolhe um ficheiro." } },
      { status: 422 }
    );
  }
  const arquivo = ficheiro as File;

  // 2. Tamanho e extensão (nome)
  if (arquivo.size === 0) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.vazio, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.vazio } },
      { status: 422 }
    );
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.grande, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.grande } },
      { status: 422 }
    );
  }

  const extensao = extensaoDe(arquivo.name);
  if (!extensao) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS_COMPROVATIVO.formato, tipo: "validacao", campos: { ficheiro: MENSAGENS_COMPROVATIVO.formato } },
      { status: 422 }
    );
  }

  // 3. Conteúdo real (magic bytes). O MIME detetado tem de bater com o da
  // extensão reclamada — senão é uma extensão disfarçada e recusamos.
  const buffer = await arquivo.arrayBuffer();
  const tipo = detetarTipo(new Uint8Array(buffer));
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

  const supabase = getSupabase();

  // 4. Ownership + estado do pagamento; recebe o proof_token do servidor.
  // B1/0011: ownership pelo posse_token (capability), não por ip_hash.
  const { data: validacao, error: erroValidacao } = await supabase.rpc("validar_comprovativo_upload_sponsor", {
    p_pagamento_id: ids.data.pagamentoId,
    p_sponsor_id: ids.data.sponsorId,
    p_posse_token: ids.data.posseToken,
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
      console.error("[sponsor-comprovativo] acesso_negado no upload");
      return NextResponse.json(
        { ok: false, mensagem: "Não tens permissão para enviar o comprovativo deste patrocínio.", tipo: "validacao" },
        { status: 403 }
      );
    }
    console.error("[sponsor-comprovativo] erro ao validar pagamento:", erroValidacao.message);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS_COMPROVATIVO.servidor, tipo: "servidor" }, { status: 502 });
  }

  const proofToken = (validacao as { proof_token: string }).proof_token;
  const storagePath = `${BUCKET_COMPROVATIVOS}/${ids.data.sponsorId}/${proofToken}/${randomUUID()}.${tipo.ext}`;

  // 5. Upload para o bucket privado (policy token-gated sponsor, anon)
  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_COMPROVATIVOS)
    .upload(storagePath, new Uint8Array(buffer), { contentType: tipo.mime, upsert: false });

  if (erroUpload) {
    console.error("[sponsor-comprovativo] erro de storage:", erroUpload.message);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS_COMPROVATIVO.servidor, tipo: "servidor" }, { status: 502 });
  }

  // 6. Metadados + transição proof_uploaded (Bloco J/0011)
  const { data: registo, error: erroRegisto } = await supabase.rpc("registar_comprovativo_sponsor", {
    p_pagamento_id: ids.data.pagamentoId,
    p_storage_path: storagePath,
    p_original_filename: arquivo.name,
    p_mime_type: tipo.mime,
    p_file_size: arquivo.size,
    p_posse_token: ids.data.posseToken,
  });

  if (erroRegisto) {
    // Higiene: se os metadados falharem, o ficheiro não pode ficar órfão.
    console.error("[sponsor-comprovativo] erro ao registar metadados:", erroRegisto.message);
    await supabase.storage.from(BUCKET_COMPROVATIVOS).remove([storagePath]);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS_COMPROVATIVO.servidor, tipo: "servidor" }, { status: 502 });
  }

  const resultado = registo as { comprovativo_id: string; pagamento_estado: string };

  return NextResponse.json(
    {
      ok: true,
      comprovativoId: resultado.comprovativo_id,
      pagamentoId: ids.data.pagamentoId,
      pagamentoEstado: resultado.pagamento_estado,
    },
    { status: 201 }
  );
}