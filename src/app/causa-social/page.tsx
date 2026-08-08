import type { Metadata } from "next";
import { site } from "@/lib/site";
import CausaSocialPage from "@/components/CausaSocialPage";

const ROTA = "/causa-social";

const titulo = "Causa Social";

const descricao =
  "Além do Espelho 2026 — muito mais do que uma inscrição. Ao inscrever-te, apoias a criação de kits de solidariedade (higiene feminina) para mulheres em vulnerabilidade em Angola, em parceria com a ONG Atos. Cada gesto transforma vidas em dois continentes.";

export const metadata: Metadata = {
  title: { absolute: `${titulo} · ${site.nome}` },
  description: descricao,
  alternates: { canonical: `${site.url}${ROTA}` },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: `${site.url}${ROTA}`,
    siteName: site.nome,
    title: `${titulo} · ${site.nome}`,
    description: descricao,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${site.nome} — Causa Social: kits de solidariedade para mulheres em Angola`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${titulo} · ${site.nome}`,
    description: descricao,
    images: ["/og-image.jpg"],
  },
};

export default function Page() {
  return <CausaSocialPage />;
}
