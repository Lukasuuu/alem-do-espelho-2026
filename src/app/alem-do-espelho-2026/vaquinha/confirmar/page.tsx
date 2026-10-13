import type { Metadata } from "next";
import { lerDoacoesAdmin } from "@/lib/vaquinha-servidor";
import { sessaoValida } from "@/lib/vaquinha-sessao";
import LoginVoluntario from "@/components/LoginVoluntario";
import PainelVoluntario from "@/components/PainelVoluntario";

/**
 * Página do VOLUNTÁRIO que confirma as doações (V5).
 *
 * É uma ferramenta interna: `noindex, nofollow`, fora de qualquer link público e
 * sem chrome do site (nem navbar nem rodapé) — quem a usa está de telemóvel, na
 * app do MB Way e no extrato, a despachar uma fila.
 *
 * O acesso é uma palavra-passe própria do voluntário, DIFERENTE da chave admin:
 * a chave (env server-only) é que fala com as RPCs, e o browser nunca a vê. A
 * lista é lida no SERVIDOR no primeiro render; o painel só a atualiza depois.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: { absolute: "Vaquinha · Confirmar contribuições" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function Page() {
  if (!(await sessaoValida())) {
    return <LoginVoluntario />;
  }
  const lista = await lerDoacoesAdmin();
  return (
    <PainelVoluntario
      doacoesIniciais={lista?.doacoes ?? null}
      totaisIniciais={lista?.totais ?? null}
    />
  );
}
