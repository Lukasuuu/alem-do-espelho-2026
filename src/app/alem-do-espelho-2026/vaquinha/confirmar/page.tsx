import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { lerDoacoesAdmin } from "@/lib/vaquinha-servidor";
import { sessaoValida } from "@/lib/vaquinha-sessao";
import PainelVoluntario from "@/components/PainelVoluntario";

/**
 * Painel da VITÓRIA — confirmar e anular contribuições (V5).
 *
 * É uma ferramenta interna: `noindex, nofollow`, fora de qualquer link público e
 * sem chrome do site — quem a usa está de telemóvel, sozinha, na app do MB Way e
 * no extrato, a despachar uma fila.
 *
 * SEM palavra-passe (14/10, D5 fechado): entra-se pelo LINK PESSOAL
 * `/alem-do-espelho-2026/vaquinha/confirmar?acesso=<token>`, com um token de 256
 * bits cujo sha256 vive na env `VAQUINHA_ACESSO_HASH`. O primeiro acesso grava o
 * cookie (até 20/11) e volta ao URL limpo, sem o token (ver a rota /sessao).
 *
 * Sem token e sem cookie a página NÃO EXISTE: 404, não um pedido de
 * palavra-passe. Não há nada para tentar adivinhar, e um formulário de entrada
 * só diria a quem lá chegasse que ali há uma ferramenta de administração.
 *
 * A chave admin (env server-only, diferente deste token) é que fala com as
 * RPCs, e o browser nunca a vê. A lista é lida no SERVIDOR no primeiro render; o
 * painel só a atualiza depois.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: { absolute: "Vaquinha · Confirmar contribuições" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function Page({
  searchParams,
}: {
  // No Next 15 o searchParams é uma promessa.
  searchParams: Promise<{ acesso?: string | string[] }>;
}) {
  const { acesso } = await searchParams;

  // Link pessoal: passa pelo Route Handler que grava o cookie e volta aqui sem
  // o token. (Um componente de servidor não pode escrever cookies.)
  if (typeof acesso === "string" && acesso.length > 0) {
    redirect(`/api/vaquinha/voluntario/sessao?acesso=${encodeURIComponent(acesso)}`);
  }

  if (!(await sessaoValida())) notFound();

  const lista = await lerDoacoesAdmin();
  return (
    <PainelVoluntario
      doacoesIniciais={lista?.doacoes ?? null}
      totaisIniciais={lista?.totais ?? null}
    />
  );
}
