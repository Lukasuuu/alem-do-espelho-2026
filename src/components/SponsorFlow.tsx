"use client";

import { useState } from "react";
import Modal from "./Modal";
import WaitlistForm from "./WaitlistForm";
import { linkWhatsApp, site } from "@/lib/site";

/**
 * Fluxo "Quero Patrocinar":
 *  botão → formulário (reusa WaitlistForm variant="sponsor") → confirmação.
 *
 * No sucesso, o formulário fecha e abre o modal de confirmação com o atalho
 * "Falar com Vitória" — o mesmo número do footer, mensagem pré-preenchida.
 */
export default function SponsorFlow() {
  const [formAberto, setFormAberto] = useState(false);
  const [sucessoAberto, setSucessoAberto] = useState(false);

  function aoSucesso() {
    setFormAberto(false);
    setSucessoAberto(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFormAberto(true)}
        className="group mt-8 inline-flex items-center gap-2 rounded-full bg-vinho px-8 py-4 text-sm font-medium text-creme transition-colors duration-300 hover:bg-rosa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 focus-visible:ring-offset-2 focus-visible:ring-offset-creme"
      >
        Quero Patrocinar
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </button>

      {/* Formulário de patrocínio — o mesmo WaitlistForm, com variant="sponsor" */}
      <Modal
        aberto={formAberto}
        fechar={() => setFormAberto(false)}
        titulo="Quero Patrocinar"
        larguraMax="30rem"
      >
        <p className="text-[0.9375rem] leading-relaxed text-creme/70">
          Obrigado pelo teu interesse. Deixa os teus dados — a nossa equipa entra em contacto
          para partilhar as oportunidades de patrocínio.
        </p>
        <div className="mt-6">
          <WaitlistForm variant="sponsor" onSucesso={aoSucesso} />
        </div>
      </Modal>

      {/* Confirmação — "Falar com Vitória" abre o WhatsApp com mensagem pronta */}
      <Modal
        aberto={sucessoAberto}
        fechar={() => setSucessoAberto(false)}
        titulo="Pedido enviado com sucesso!"
        larguraMax="26rem"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-blush/40 bg-blush/10">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              className="h-6 w-6 text-blush"
              aria-hidden
            >
              <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <p className="mt-5 max-w-[24rem] text-[0.9375rem] leading-relaxed text-creme/70">
            Recebemos o teu interesse. A nossa equipa vai contactar-te em breve — se preferires,
            fala já connosco.
          </p>

          <a
            href={linkWhatsApp(site.contacto.whatsapp.numero, site.contacto.whatsapp.mensagemSponsor)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-colors duration-300 hover:bg-rosa-escuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosa/50 focus-visible:ring-offset-2 focus-visible:ring-offset-vinho"
          >
            Falar com Vitória
            <span aria-hidden>→</span>
          </a>

          <button
            type="button"
            onClick={() => setSucessoAberto(false)}
            className="mt-4 text-[0.875rem] text-creme/50 transition-colors duration-300 hover:text-creme/80"
          >
            Fechar
          </button>
        </div>
      </Modal>
    </>
  );
}
