import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hashIp, obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, validarTelefone, waitlistSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Resposta =
  | { ok: true; status: "sponsor" }
  | { ok: false; mensagem: string; campos?: Record<string, string> };

/** Tempo mínimo plausível entre carregar o formulário e submeter. */
const TEMPO_MINIMO_MS = 2_500;

/**
 * Mascara um email para registo: mantém o domínio e a 1ª letra,
 * ocultando o resto — nunca guardamos PII em claro nos logs.
 */
function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!dominio) return "***";
  const visivel = local ? `${local.slice(0, 1)}***` : "***";
  return `${visivel}@${dominio}`;
}

/**
 * Rota de manifestação de interesse em patrocínio.
 *
 * Reutiliza a validação e o anti-bot do formulário da lista de espera
 * (WaitlistForm variant="sponsor" envia exatamente o mesmo payload).
 *
 * Persistência: ainda não existe uma tabela de leads de patrocínio, por
 * isso o interesse é registado no log da função (com email mascarado).
 * Quando a tabela for criada, o passo 6 abaixo troca o console.info por
 * um insert — o resto da rota fica igual.
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

  // 3. Validação do formato — o mesmo esquema da lista de espera
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

  // 4. Armadilhas anti-bot — resposta genérica de propósito
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

  // 6. Registo do lead — sem PII em claro (RGPD)
  console.info(
    "[sponsor] novo interesse de patrocínio",
    JSON.stringify({
      email: mascararEmail(dados.email),
      pais: dados.phoneCountry,
      utmSource: dados.utm?.utm_source ?? null,
      ipHash: hashIp(ip),
    })
  );

  return NextResponse.json({ ok: true, status: "sponsor" }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}
