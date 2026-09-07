import { WhatsAppIcon } from "./icons";
import { MENSAGEM_CURIOSOS, SALON_WHATSAPP } from "@/lib/campanha";
import { linkWhatsApp } from "@/lib/site";

/**
 * H — Bolha WhatsApp flutuante (canto inferior direito), para curiosas e
 * potenciais clientes que chegam à página sem fluxo ativo.
 *
 * - Um só número: SALON_WHATSAPP (fonte única em campanha.ts), via linkWhatsApp.
 * - Token de cor existente: --color-whatsapp (#25d366, criado no Bloco B).
 *   text-white é o padrão do próprio ícone da marca WhatsApp sobre o verde.
 * - 56×56px (alvo de toque ≥44), z-40: abaixo do header (z-50) e das modais
 *   (overlay-top z-100) — nunca tapa CTA nem conteúdo; em mobile fica a
 *   bottom-4/right-4, descolada dos CTAs (verificado em Playwright).
 * - Pulsar leve via .bolha-pulsar (globals.css) — apenas transform+opacity;
 *   desligado em prefers-reduced-motion (regra explícita + regra global).
 * - Montado SÓ na página do evento (decisão do Lucas, 03/09).
 */
export default function BotaoWhatsApp() {
  return (
    <a
      href={linkWhatsApp(SALON_WHATSAPP, MENSAGEM_CURIOSOS)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a organização no WhatsApp (abre em nova janela)"
      className="bolha-pulsar fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg transition-transform duration-300 hover:scale-[1.06] focus-visible:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp/60 focus-visible:ring-offset-2 focus-visible:ring-offset-musgo sm:bottom-6 sm:right-6"
    >
      <WhatsAppIcon className="h-7 w-7" aria-hidden />
    </a>
  );
}