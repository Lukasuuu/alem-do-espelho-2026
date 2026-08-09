import type { Metadata } from "next";
import { site } from "@/lib/site";
import { inscricaoAtiva } from "@/lib/cutover";
import CausaSocialPage from "@/components/CausaSocialPage";

/**
 * Render dinâmico por request: a secção de patrocinadores (dentro de CausaSocial)
 * é gated pela fase de inscrição (10/08 10:00 Lisboa). Sem isto, o build estático
 * congelaria o gate e a vitrine não apareceria pós-10/08 sem um novo deploy.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  // Gate de patrocinadores pelo relógio do servidor (override incluído).
  const faseInscricaoAtiva = inscricaoAtiva();
  return <CausaSocialPage faseInscricaoAtiva={faseInscricaoAtiva} />;
}
