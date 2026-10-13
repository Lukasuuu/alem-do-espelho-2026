import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { COOKIE_VOLUNTARIO, senhaValida, tokenSessao } from "@/lib/vaquinha-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Login do voluntário. Aqui o limite por IP FAZ SENTIDO (ao contrário das rotas
 * públicas da vaquinha, onde a sala inteira partilha um IP): são poucas pessoas
 * com uma palavra-passe, e é isto que trava quem a tente adivinhar. O limite em
 * memória é por instância e serve de primeira barreira; o que trava a sério é a
 * palavra-passe ter entropia suficiente.
 */
const LIMITE_POR_JANELA = 8;

const corpoSchema = z.object({ senha: z.string().min(1).max(200) });

export async function POST(request: Request): Promise<NextResponse> {
  const ip = obterIp(request.headers);
  const limite = rateLimit(`vaquinha-voluntario:${ip}`, LIMITE_POR_JANELA);
  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, mensagem: "Demasiadas tentativas. Aguarda um minuto." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limite.resetEm - Date.now()) / 1000)) } }
    );
  }

  let senha: string;
  try {
    senha = corpoSchema.parse(await request.json()).senha;
  } catch {
    return NextResponse.json({ ok: false, mensagem: "Escreve a palavra-passe." }, { status: 400 });
  }

  if (!senhaValida(senha)) {
    // Mensagem única para os dois casos (palavra-passe errada / ambiente por
    // configurar): não se diz a quem tenta se o problema é dele.
    return NextResponse.json({ ok: false, mensagem: "Palavra-passe incorreta." }, { status: 401 });
  }

  const token = tokenSessao();
  if (!token) {
    return NextResponse.json({ ok: false, mensagem: "O acesso não está configurado." }, { status: 503 });
  }

  const jar = await cookies();
  jar.set(COOKIE_VOLUNTARIO.nome, token, COOKIE_VOLUNTARIO.opcoes);
  return NextResponse.json({ ok: true });
}
