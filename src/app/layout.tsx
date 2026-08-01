import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";
import MotionProvider from "@/components/MotionProvider";
import "./globals.css";

const descricao = `A 2ª edição do ${site.nome} acontece a ${site.data.extenso}, no ${site.local.completo}. São ${site.vagas} lugares — entra na lista de espera e sê das primeiras a saber quando abrirem as inscrições.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.nome} — ${site.subtitulo} | Lista de espera`,
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
    title: `${site.nome} — ${site.subtitulo}`,
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
    title: `${site.nome} — ${site.subtitulo}`,
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
  name: `${site.nome} — ${site.subtitulo}`,
  description: descricao,
  startDate: site.data.iso,
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados) }}
        />
        <a
          href="#inscricao"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-rosa focus:px-5 focus:py-3 focus:text-sm focus:text-creme"
        >
          Saltar para a inscrição
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
