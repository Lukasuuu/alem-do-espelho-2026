import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";
import MotionProvider from "@/components/MotionProvider";
import SaltarParaInscricao from "@/components/SaltarParaInscricao";
import "./globals.css";

const descricao = `A 2ª edição do Além do Espelho acontece a ${site.data.extenso}, no ${site.local.nome}, em ${site.local.cidade}. Um dia de desenvolvimento pessoal feminino, autoestima e networking para mulheres que querem voltar a encontrar-se. As inscrições estão abertas — 100 lugares, garantidos por ordem de pagamento.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.nome} · ${site.subtitulo} | Inscrições abertas`,
    template: `%s | ${site.nome}`,
  },
  description: descricao,
  keywords: [
    "Além do Espelho",
    "evento feminino Braga",
    "desenvolvimento pessoal mulheres",
    "Vitória Gomes",
    "Essence of Beauty",
    "evento mulheres Portugal 2026",
    "INNSiDE by Meliá Braga",
  ],
  authors: [{ name: site.anfitria.nome }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: site.url,
    siteName: site.nome,
    title: `${site.nome} · ${site.subtitulo}`,
    description: descricao,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${site.nome} · ${site.data.extenso}, ${site.local.completo}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.nome} · ${site.subtitulo}`,
    description: descricao,
    images: ["/og-image.jpg"],
  },
  icons: { icon: "/icon.png", apple: "/icon.png" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2E3A33",
  width: "device-width",
  initialScale: 1,
};

const dadosEstruturados = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: `${site.nome} · ${site.subtitulo}`,
  description: descricao,
  startDate: site.data.iso,
  endDate: site.data.fim,
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: site.local.nome,
    address: {
      "@type": "PostalAddress",
      addressLocality: site.local.cidade,
      addressCountry: "PT",
    },
  },
  organizer: {
    "@type": "Organization",
    name: "Essence of Beauty",
    url: site.url,
  },
  performer: { "@type": "Person", name: site.anfitria.nome },
  image: [`${site.url}/og-image.jpg`],
  offers: {
    "@type": "Offer",
    price: "40",
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    url: `${site.url}/alem-do-espelho-2026`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados) }}
        />
        <SaltarParaInscricao />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
