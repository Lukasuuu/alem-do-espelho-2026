import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashIp, obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, sponsorSchema, validarTelefone } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Dados pessoais tratados na UE: função junto da base de dados (Supabase em Paris).
export const preferredRegion = ["cdg1"];

type Resposta =
  | { ok: true; status: "sponsor"; id: string; nivel: number | null }
  | { ok: false; mensagem: string; campos?: Record<string, string> };

/** Tempo mínimo plausível entre carregar o formulário e submeter. */
const TEMPO_MINIMO_MS = 2_500;

/**
 * Mascara um email para registo: mantém o domínio e a 1ª letra,
 * ocultando o resto, nunca guardamos PII em claro nos logs.
 */
function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!dominio) return "***";
  const visivel = local ? `${local.slice(0, 1)}***` : "***";
  return `${visivel}@${dominio}`;
}

/**
 * Regista o interesse de patrocínio (CORREÇÃO nº3): no POST do formulário o
 * nível AINDA não foi escolhido — fica null e é marcado depois, no passo B
 * (PATCH /api/sponsor/nivel). A empresa/marca é opcional (CORREÇÃO nº6) e o
 * consentimento RGPD é obrigatório, como na inscrição. O método de pagamento
 * é marcado por fim (PATCH /api/sponsor/metodo). Mesmo padrão do
 * waitlist/inscrição: RLS + função SECURITY DEFINER via RPC, sem service role.
 */
export async function POST(request: Request): Promise<NextResponse<Resposta>> {
  // 1. Limite de tentativas por IP
  const ip = obterIp(request.headers);
  const limite = rateLimit(`sponsor:${ip}`);

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

  // 3. Validação do formato — o esquema do patrocínio exige o nível escolhido
  let dados;
  try {
    dados = sponsorSchema.parse(corpo);
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

    const { data, error } = await supabase.rpc("registar_sponsor", {
      p_nome: dados.fullName,
      p_email: dados.email,
      p_telefone: telefone.e164,
      // Nível escolhido só no passo B — aqui ainda null.
      p_nivel: dados.nivel ?? null,
      p_empresa: dados.empresa || null,
      p_consentimento: true,
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
      if (codigo.includes("invalid_nivel")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, campos: { nivel: "Escolhe um nível de parceria." } },
          { status: 422 }
        );
      }

      console.error("[sponsor] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor }, { status: 502 });
    }

    const resultado = data as {
      status: "criada" | "ja_existente";
      id: string;
      nivel: number | null;
    };

    // 7. Observabilidade, sem PII em claro (RGPD) — email mascarado; a empresa
    //    é um nome de marca público, não dado pessoal, e ajuda a identificar.
    console.info(
      "[sponsor] novo interesse de patrocínio",
      JSON.stringify({
        email: mascararEmail(dados.email),
        empresa: dados.empresa || null,
        nivel: resultado.nivel,
        status: resultado.status,
        pais: dados.phoneCountry,
        utmSource: dados.utm?.utm_source ?? null,
        ipHash: hashIp(ip),
      })
    );

    return NextResponse.json(
      { ok: true, status: "sponsor", id: resultado.id, nivel: resultado.nivel },
      { status: 201 }
    );
  } catch (erro) {
    console.error("[sponsor] falha inesperada:", erro);
    return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
