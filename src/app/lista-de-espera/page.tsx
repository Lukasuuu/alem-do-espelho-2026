import type { Metadata } from "next";
import { site } from "@/lib/site";
import ListaEsperaPage from "@/components/ListaEsperaPage";

const descricao = `Entra na lista de espera do ${site.nome} e sê um dos primeiros a receber todas as novidades e a garantir prioridade na abertura das inscrições. A 2ª edição acontece a ${site.data.extenso}, no ${site.local.completo}.`;

export const metadata: Metadata = {
  title: "Lista de Espera — Pré-inscrição",
  description: descricao,
  // Canónico absoluto — resolve para o domínio atual via NEXT_PUBLIC_SITE_URL,
  // para que a página viva no domínio principal ou no secundário sem duplicar.
  alternates: { canonical: `${site.url}/lista-de-espera` },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Lista de espera — ${site.nome} — ${site.subtitulo}`,
    description: descricao,
  },
};

export default function Page() {
  return <ListaEsperaPage />;
}
