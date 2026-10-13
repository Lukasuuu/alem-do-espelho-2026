import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";
import MotionProvider from "@/components/MotionProvider";
import SaltarParaInscricao from "@/components/SaltarParaInscricao";
import { estadoEvento, inscricoesEncerradas } from "@/lib/vaquinha-fase";
import "./globals.css";

const descricao = `A 2ª edição do Além do Espelho acontece a ${site.data.extenso}, no ${site.local.nome}, em ${site.local.cidade}. Um dia de desenvolvimento pessoal feminino, autoestima e networking para mulheres que querem voltar a encontrar-se. As inscrições estão abertas — 100 lugares, garantidos por ordem de pagamento.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    // Sem fase no título por omissão: «| Inscrições abertas» caduca a 17/10 e
    // este é o título das páginas que não definem o seu. Não afirma nada.
    default: `${site.nome} · ${site.subtitulo}`,
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

/**
 * D7: com as inscrições fechadas, os dados estruturados NÃO podem continuar a
 * dizer que estão abertas nem que há lugares — é o que o Google mostra nos
 * resultados enriquecidos de eventos, e passaria a ser falso a partir de sábado.
 * Calculado dentro do componente (por pedido), não numa constante de módulo.
 */
function dadosEstruturadosVaquinha() {
  const encerradas = inscricoesEncerradas();
  const estado = estadoEvento();
  const descricaoEvento =
    estado === "antes"
      ? descricao
      : estado === "durante"
        ? `O ${site.nome} está a acontecer hoje, no ${site.local.nome}, em ${site.local.cidade}. As inscrições estão encerradas. Agora, juntos por Angola.`
        : `A 2ª edição do ${site.nome} aconteceu a ${site.data.extenso}, no ${site.local.nome}, em ${site.local.cidade}. Obrigada a todas as que estiveram connosco. Agora, juntos por Angola.`;
  return {
  "@context": "https://schema.org",
  "@type": "Event",
  name: `${site.nome} · ${site.subtitulo}`,
  description: descricaoEvento,
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
    availability: encerradas ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      url: `${site.url}/alem-do-espelho-2026`,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturadosVaquinha()) }}
        />
        {/* D7: é o layout que decide — o skip-link aponta para onde há algo
            para fazer. */}
        <SaltarParaInscricao paraVaquinha={inscricoesEncerradas()} />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
