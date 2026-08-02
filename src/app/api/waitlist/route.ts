import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashIp, obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, validarTelefone, waitlistSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | { ok: true; status: "created" | "already_registered"; posicao: number }
  | { ok: false; mensagem: string; campos?: Record<string, string> };

/** Tempo mínimo plausível entre carregar o formulário e submeter. */
const TEMPO_MINIMO_MS = 2_500;

export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`waitlist:${ip}`);

  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.rateLimit },
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
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.invalido }, { status: 400 });
  }

  // 3. Validação do formato
  let dados;
  try {
    dados = waitlistSchema.parse(corpo);
  } catch (erro) {
    if (erro instanceof ZodError) {
      const campos: Record<string, string> = {};
      for (const issue of erro.issues) {
        const chave = String(issue.path[0] ?? "form");
        if (!campos[chave]) campos[chave] = issue.message;
      }
      return NextResponse.json(
        { ok: false, mensagem: MENSAGENS.invalido, campos },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor }, { status: 500 });
  }

  // 4. Armadilhas anti-bot, resposta genérica de propósito
  if (dados.website && dados.website.length > 0) {
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.bot }, { status: 400 });
  }
  if (typeof dados.elapsedMs === "number" && dados.elapsedMs < TEMPO_MINIMO_MS) {
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.bot }, { status: 400 });
  }

  // 5. Telemóvel: validação real por país e normalização E.164
  const telefone = validarTelefone(dados.phone, dados.phoneCountry);
  if (!telefone.ok || !telefone.e164) {
    return NextResponse.json(
      { ok: false, mensagem: MENSAGENS.invalido, campos: { phone: telefone.erro! } },
      { status: 422 }
    );
  }

  // 6. Persistência
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc("join_waitlist", {
      p_full_name: dados.fullName,
      p_email: dados.email,
      p_phone: telefone.e164,
      p_phone_country: dados.phoneCountry,
      p_consent: true,
      p_locale: dados.locale ?? null,
      p_source: "waitlist-lp",
      p_utm: dados.utm ?? {},
      p_referrer: request.headers.get("referer"),
      p_user_agent: request.headers.get("user-agent"),
      p_ip_hash: hashIp(ip),
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("invalid_email")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, campos: { email: "Este email não parece válido." } },
          { status: 422 }
        );
      }
      if (codigo.includes("invalid_phone")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, campos: { phone: "Este número não parece válido." } },
          { status: 422 }
        );
      }
      if (codigo.includes("invalid_full_name")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, campos: { fullName: "Escreve o teu nome completo." } },
          { status: 422 }
        );
      }

      console.error("[waitlist] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor }, { status: 502 });
    }

    const resultado = data as { status: "created" | "already_registered"; position: number };

    return NextResponse.json(
      { ok: true, status: resultado.status, posicao: resultado.position },
      { status: resultado.status === "created" ? 201 : 200 }
    );
  } catch (erro) {
    console.error("[waitlist] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
