import { NextResponse } from "next/server";
import { abrirSessao } from "@/lib/vaquinha-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAINEL = "/alem-do-espelho-2026/vaquinha/confirmar";

/**
 * O salto do LINK PESSOAL (V5): /…/confirmar?acesso=<token> → aqui → /…/confirmar
 *
 * Existe por uma razão técnica, não por desenho: um componente de servidor não
 * pode escrever cookies (só um Route Handler ou um Server Action pode), e o
 * link que a Vitória tem é a página. Então a página manda o pedido para cá, cá
 * grava-se o cookie e volta-se ao URL LIMPO — o token não fica no histórico do
 * telemóvel nem no ecrã depois do primeiro toque.
 *
 * Responde SEMPRE com o mesmo redirect, com token certo ou errado: quem não tem
 * o token cai na página e leva 404 como qualquer curioso, sem aprender nada
 * sobre o que falhou. Nada é registado em log (nem o token, nem o resultado).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("acesso") ?? "";
  await abrirSessao(token);
  return NextResponse.redirect(new URL(PAINEL, request.url));
}
