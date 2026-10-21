import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { site } from "@/lib/site";
import { isDepoisDoCorte, inscricaoAtiva } from "@/lib/cutover";
import { VAQUINHA_INICIO_ISO } from "@/lib/vaquinha";
import { estadoEvento, inscricoesEncerradas, vaquinhaIniciada } from "@/lib/vaquinha-fase";
import { lerTotaisVaquinha } from "@/lib/vaquinha-servidor";
import { CAMBIO_RECURSO, obterCambio } from "@/lib/cambio";
import EventoPage from "@/components/EventoPage";
import IrParaVaquinha from "@/components/IrParaVaquinha";

/**
 * Rota da VAQUINHA — existe por causa da PARTILHA, não por causa da navegação.
 *
 * O cartão da vaquinha vive no hero do evento e tem âncora #vaquinha, mas
 * partilhar `…/alem-do-espelho-2026#vaquinha` não serve: o `#` não muda o que as
 * redes mostram, porque quem monta a pré-visualização do link lê os metadados da
 * PÁGINA. O WhatsApp e o Facebook mostrariam a imagem e o título do evento.
 *
 * Daí uma rota a sério, com metadados próprios. E sem redirect (307/308): os
 * robôs das redes seguem redirects e leem os metadados do destino — voltava a
 * aparecer o evento. Renderiza a MESMA página (mesmo componente, mesmo gate
 * server-side) e faz scroll até ao cartão ao montar.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROTA = "/alem-do-espelho-2026/vaquinha";
const ROTA_LISTA = "/alem-do-espelho-2026/lista";

const TITULO = "Juntos por Angola — Vaquinha solidária da ONG Atos";
const DESCRICAO =
  "Contribui a partir de 5 € e ajuda as mulheres apoiadas pela ONG Atos, em Angola.";
/** Imagem gerada a partir de docs/vaquinha/referencia-visual/07-partilha-og.html,
    1200×630 e sem valores dinâmicos: as redes guardam-na em cache durante dias
    e um número que entretanto mudasse ficaria desatualizado. */
const IMAGEM = `${site.url}/vaquinha/og-partilha.png`;

export const metadata: Metadata = {
  title: { absolute: TITULO },
  description: DESCRICAO,
  alternates: { canonical: `${site.url}${ROTA}` },
  // É a mesma página noutro endereço: não se indexa (a canónica é a do evento),
  // mas segue-se os links. Não afeta o robô que monta a pré-visualização.
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: `${site.url}${ROTA}`,
    siteName: site.nome,
    title: TITULO,
    description: DESCRICAO,
    images: [{ url: IMAGEM, width: 1200, height: 630, alt: "Vaquinha solidária da ONG Atos — Juntos por Angola" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
    images: [IMAGEM],
  },
};

export default async function Page() {
  // Mesmo gate de rota da landing: antes do corte histórico, a página ativa é a
  // lista de espera.
  if (!(await isDepoisDoCorte())) permanentRedirect(ROTA_LISTA);

  const vaquinhaAberta = vaquinhaIniciada(VAQUINHA_INICIO_ISO);
  const totaisVaquinha = vaquinhaAberta ? await lerTotaisVaquinha() : null;
  // Câmbio dos canais Wise/Pix: lido no servidor, com cache de 6 h, e nunca
  // bloqueia — obterCambio() devolve a taxa de recurso se o BCE falhar. Só se
  // vai ao BCE quando o cartão vai mesmo aparecer.
  const cambio = vaquinhaAberta ? await obterCambio() : CAMBIO_RECURSO;

  return (
    <>
      <IrParaVaquinha />
      <EventoPage
        faseInscricaoAtiva={inscricaoAtiva()}
        vaquinhaAberta={vaquinhaAberta}
        totaisVaquinha={totaisVaquinha}
        inscricoesEncerradas={inscricoesEncerradas()}
        estadoEvento={estadoEvento()}
        cambio={cambio}
      />
    </>
  );
}
