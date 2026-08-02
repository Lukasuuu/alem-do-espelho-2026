import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { site } from "@/lib/site";
import { isDepoisDoCorte } from "@/lib/cutover";
import ListaEsperaPage from "@/components/ListaEsperaPage";

/**
 * Lista de espera — página ativa ATÉ ao corte (03/08/2026 10:00 Lisboa).
 * No corte e depois: 308 para a versão do evento (/alem-do-espelho-2026).
 *
 * Render dinâmico por request: o build estático não pode congelar a virada.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROTA_LISTA = "/alem-do-espelho-2026/lista";
const ROTA_EVENTO = "/alem-do-espelho-2026";

const titulo = `Lista de Espera — ${site.nome} · ${site.data.extenso} · ${site.local.cidade}`;

const descricao = `Entra na lista de espera do ${site.nome} e sê um dos primeiros a receber todas as novidades e a garantir prioridade na abertura das inscrições. A 2ª edição acontece a ${site.data.extenso}, no ${site.local.completo}.`;

export async function generateMetadata(): Promise<Metadata> {
  // Canónico da fase pré-corte. Depois do corte a rota devolve 308 para o
  // evento, que carrega o canónico da fase pós-corte — nunca em conflito.
  return {
    // Título absoluto (bypass do template) — forte para busca e sem duplicar o nome do site.
    title: { absolute: titulo },
    description: descricao,
    alternates: { canonical: `${site.url}${ROTA_LISTA}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "pt_PT",
      url: `${site.url}${ROTA_LISTA}`,
      siteName: site.nome,
      title: titulo,
      description: descricao,
      images: [
        {
          url: "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: `${site.nome} — ${site.data.extenso}, ${site.local.completo}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descricao,
      images: ["/og-image.jpg"],
    },
  };
}

export default async function Page() {
  if (await isDepoisDoCorte()) permanentRedirect(ROTA_EVENTO);
  return <ListaEsperaPage />;
}
