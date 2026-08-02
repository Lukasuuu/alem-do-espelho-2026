import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { site } from "@/lib/site";
import { isDepoisDoCorte } from "@/lib/cutover";
import EventoPage from "@/components/EventoPage";

/**
 * Versão do evento — página ativa DEPOIS do corte (03/08/2026 10:00 Lisboa).
 * Antes do corte: 308 para a lista de espera, para nunca existirem duas
 * versões indexáveis em paralelo (conteúdo duplicado).
 *
 * Render dinâmico por request: o build estático não pode congelar a virada.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROTA_LISTA = "/alem-do-espelho-2026/lista";
const ROTA_EVENTO = "/alem-do-espelho-2026";

const titulo = `${site.nome} — ${site.subtitulo} · ${site.data.extenso} · ${site.local.cidade}`;

const descricao = `O ${site.nome} — ${site.subtitulo} acontece a ${site.data.extenso}, no ${site.local.completo}. ${site.tagline}`;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: titulo },
    description: descricao,
    alternates: { canonical: `${site.url}${ROTA_EVENTO}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "pt_PT",
      url: `${site.url}${ROTA_EVENTO}`,
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
  // Antes do corte, a página ativa é a lista de espera.
  if (!(await isDepoisDoCorte())) permanentRedirect(ROTA_LISTA);
  return <EventoPage />;
}
