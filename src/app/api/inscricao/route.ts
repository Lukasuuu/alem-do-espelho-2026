import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabase } from "@/lib/supabase";
import { hashIp, obterIp, rateLimit } from "@/lib/rate-limit";
import { MENSAGENS, inscricaoSchema, validarTelefone, type TipoErro } from "@/lib/validation";
import { inscricaoAtiva } from "@/lib/cutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Dados pessoais tratados na UE — a região das funções está fixada em cdg1 (Paris)
// no vercel.json, junto da base de dados (Supabase em eu-west-3).

type Resposta =
  | { ok: true; status: "criada" | "ja_inscrita"; id: string; posseToken: string }
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
      // RGPD (Lucas, 11/08): passa o consentimento real (a 5-arg — sobrecarga
      // nova). A de 4 args continua a existir até ser verificado por grep que
      // nada mais a chama e só então é descartada.
      p_consentimento: dados.consent === true,
      // B1: o ip_hash deixa de ser posse (passa a sinal de abuso apenas);
      // a posse real é o posse_token que a RPC gera e devolve abaixo.
      p_ip_hash: hashIp(ip),
    });

    if (error) {
      const codigo = error.message ?? "";
      if (codigo.includes("consentimento_obrigatorio")) {
        return NextResponse.json(
          { ok: false, mensagem: MENSAGENS.invalido, tipo: "validacao", campos: { consent: "Precisamos da tua autorização para tratar da tua inscrição." } },
          { status: 422 }
        );
      }
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
      if (codigo.includes("inscricao_confirmada")) {
        // Guard da 0008 (Lucas, 05/09): inscrição paga não volta ao
        // formulário — fecha o takeover por email conhecido. Tipo
        // "validacao" para o formulário mostrar a mensagem verbatim.
        return NextResponse.json(
          { ok: false, mensagem: "Esta inscrição já está paga e confirmada. Fala connosco no WhatsApp se precisares de algo.", tipo: "validacao" },
          { status: 409 }
        );
      }

      console.error("[inscricao] erro do supabase:", error.message);
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    // B1 (0009): a RPC devolve posse_token em AMBOS os ramos (INSERT e
    // UPDATE — re-submeter o formulário é a prova de posse e roda o token).
    // Devolve-se UMA vez aqui; o cliente guarda-o só em memória.
    const resultado = data as {
      status: "criada" | "ja_inscrita" | "ja_confirmada";
      id: string;
      posse_token: string | null;
    };

    // Guard anti-takeover (0008b/0009, soft-return — a base NÃO faz raise):
    // inscrição confirmada não toca na linha e não emite token. 409 ANTES do
    // check de token — aqui o token falta à propósito; 502 seria enganador.
    if (resultado.status === "ja_confirmada") {
      return NextResponse.json(
        { ok: false, mensagem: "Esta inscrição já está paga e confirmada. Fala connosco no WhatsApp se precisares de algo.", tipo: "validacao" },
        { status: 409 }
      );
    }

    if (!resultado.posse_token) {
      // Base sem a 0009 aplicada (deploy vs. migration fora de sincronia).
      // Nunca se imprime o valor — só a ausência.
      console.error("[inscricao] posse_token ausente na resposta da RPC");
      return NextResponse.json({ ok: false, mensagem: MENSAGENS.servidor, tipo: "servidor" }, { status: 502 });
    }

    return NextResponse.json(
      { ok: true, status: resultado.status, id: resultado.id, posseToken: resultado.posse_token },
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
