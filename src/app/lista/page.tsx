import type { Metadata } from "next";
import { site } from "@/lib/site";
import ListaEsperaPage from "@/components/ListaEsperaPage";

const titulo = `Lista de Espera — ${site.nome} · ${site.data.extenso} · ${site.local.cidade}`;

const descricao = `Entra na lista de espera do ${site.nome} e sê um dos primeiros a receber todas as novidades e a garantir prioridade na abertura das inscrições. A 2ª edição acontece a ${site.data.extenso}, no ${site.local.completo}.`;

export const metadata: Metadata = {
  // Título absoluto (bypass do template) — forte para busca e sem duplicar o nome do site.
  title: { absolute: titulo },
  description: descricao,
  // Canónico absoluto no domínio final — mesmo em preview/vercel.app, aponta para produção.
  alternates: { canonical: `${site.url}/lista` },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: `${site.url}/lista`,
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

export default function Page() {
  return <ListaEsperaPage />;
}
