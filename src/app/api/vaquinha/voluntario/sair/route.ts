import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_PAINEL } from "@/lib/vaquinha-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sair: apaga o cookie. Sem sessão guardada no servidor, é tudo. */
export async function POST(): Promise<NextResponse> {
  const jar = await cookies();
  jar.set(COOKIE_PAINEL.nome, "", { ...COOKIE_PAINEL.opcoes, expires: new Date(0) });
  return NextResponse.json({ ok: true });
}
