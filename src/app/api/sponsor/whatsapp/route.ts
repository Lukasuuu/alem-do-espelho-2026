import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, sponsorWhatsappSchema, type TipoErro } from "@/lib/validation";
import { SPONSOR_MOCK_ATIVO } from "@/lib/sponsor-mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | { ok: true; estado: string; canal: "whatsapp" }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

const SEM_PAGAMENTO = "Este pagamento não existe ou já não aceita comprovativos.";

/**
 * HANDOFF WHATSAPP do comprovativo do PATROCÍNIO (0011 r2, RPC
 * marcar_comprovativo_whatsapp_sponsor).
 *
 * A pessoa escolheu enviar o comprovativo à Vitória pelo WhatsApp. O registo
 * do handoff (canal_comprovativo='whatsapp', whatsapp_handoff_at=now(),
 * estado → awaiting_proof) acontece AQUI, ANTES de abrir a conversa — a UI
 * só abre o WhatsApp se esta rota responder OK. Assim a Vitória vê no painel
 * quem prometeu enviar comprovativo mesmo que a pessoa desista a meio.
 * Nunca expõe tokens nem IDs técnicos na conversa — a mensagem é montada no
 * cliente com nome/empresa/nível/valor (ver lib/sponsor.ts).
 */
export async function PATCH(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`sponsor-whatsapp:${ip}`);

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

  // 3. Validação do formato (uuid + uuid + token de posse)
  let dados;
  try {
    dados = sponsorWhatsappSchema.parse(corpo);
  } catch (erro) {
    if (erro instanceof ZodError) {
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao" }, { status: 422 });
    }
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }

  // 4. Persistência
  if (SPONSOR_MOCK_ATIVO) {
    // QA em localhost (ver lib/sponsor-mock.ts) — sem tocar na Supabase.
    return NextResponse.json({ ok: true, estado: "awaiting_proof", canal: "whatsapp" });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("marcar_comprovativo_whatsapp_sponsor", {
      p_sponsor_id: dados.sponsorId,
      p_pagamento_id: dados.pagamentoId,
      p_posse_token: dados.posseToken,
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("pagamento_nao_encontrado") || codigo.includes("estado_invalido")) {
        return NextResponse.json(
          { ok: false, mensagem: SEM_PAGAMENTO, tipo: "validacao" },
          { status: 404 }
        );
      }
      if (codigo.includes("acesso_negado")) {
        // Token de posse não bate — sessão antiga/expirada.
        return NextResponse.json({ ok: false, mensagem: MENSAGENS.sessaoExpirada, tipo: "fase" }, { status: 403 });
      }

      console.error("[sponsor-whatsapp] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = data as { pagamento_estado: string; canal_comprovativo: string };

    return NextResponse.json({
      ok: true,
      estado: resultado.pagamento_estado,
      canal: "whatsapp",
    });
  } catch (erro) {
    console.error("[sponsor-whatsapp] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}

const MENSAGENS_COMPROVATIVO_SEM_PAGAMENTO =
  "Este pagamento não existe ou já não aceita comprovativos.";