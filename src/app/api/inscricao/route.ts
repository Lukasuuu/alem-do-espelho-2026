import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashIp, obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, inscricaoSchema, validarTelefone, type TipoErro } from "@/lib/validation";
import { inscricaoAtiva } from "@/lib/cutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Dados pessoais tratados na UE: função junto da base de dados (Supabase em Paris).
export const preferredRegion = ["cdg1"];

type Resposta =
  | { ok: true; status: "criada" | "ja_inscrita"; id: string }
  | { ok: false; mensagem: string; tipo: TipoErro; campos?: Record<string, string> };

/** Tempo mínimo plausível entre carregar o formulário e submeter. */
const TEMPO_MINIMO_MS = 2_500;

/**
 * Regista a inscrição paga com status 'pendente'. O método de pagamento só é
 * marcado depois, na modal (PATCH /api/inscricao/metodo). Mesmo padrão do
 * waitlist: RLS + função SECURITY DEFINER via RPC, sem service role.
 */
export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  // 0. Fase ativa (server-first): a inscrição paga só abre em FIM_CAMPANHA_ISO
  //    (10/08, 10:00 Lisbon), ou antes com NEXT_PUBLIC_FASE_OVERRIDE=inscricao
  //    (teste). Enquanto a lista gratuita estiver aberta, 410 Gone.
  if (!inscricaoAtiva()) {
    return NextResponse.json(
      { ok: false, mensagem: "As inscrições pagas ainda não estão abertas.", tipo: "fase" },
      { status: 410 }
    );
  }

  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`inscricao:${ip}`);

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

  // 3. Validação do formato
  let dados;
  try {
    dados = inscricaoSchema.parse(corpo);
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

  // 4. Armadilhas anti-bot, resposta genérica de propósito
  if (dados.website && dados.website.length > 0) {
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.bot, tipo: "bot" }, { status: 400 });
  }
  if (typeof dados.elapsedMs === "number" && dados.elapsedMs < TEMPO_MINIMO_MS) {
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.bot, tipo: "bot" }, { status: 400 });
  }

  // 5. Telemóvel: validação real por país e normalização E.164
  const telefone = validarTelefone(dados.phone, dados.phoneCountry);
  if (!telefone.ok || !telefone.e164) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { phone: telefone.erro! } },
      { status: 422 }
    );
  }

  // 6. Persistência
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("registar_inscricao", {
      p_nome: dados.nome,
      p_email: dados.email,
      p_telefone: telefone.e164,
      p_ip_hash: hashIp(ip),
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("invalid_email")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { email: "Este email não parece válido." } },
          { status: 422 }
        );
      }
      if (codigo.includes("invalid_phone")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { phone: "Este número não parece válido." } },
          { status: 422 }
        );
      }
      if (codigo.includes("invalid_full_name")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { nome: "Escreve o teu nome completo." } },
          { status: 422 }
        );
      }

      console.error("[inscricao] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    const resultado = data as { status: "criada" | "ja_inscrita"; id: string };

    return NextResponse.json(
      { ok: true, status: resultado.status, id: resultado.id },
      { status: resultado.status === "criada" ? 201 : 200 }
    );
  } catch (erro) {
    console.error("[inscricao] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
