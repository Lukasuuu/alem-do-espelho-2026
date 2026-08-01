"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { InstagramIcon, MailIcon, WhatsAppIcon } from "./icons";
import TermosModal from "./TermosModal";
import PrivacidadeModal from "./PrivacidadeModal";
import { linkWhatsApp, site } from "@/lib/site";

type Props = {
  abrirModal: () => void;
};

export default function Footer({ abrirModal }: Props) {
  const [termosAberto, setTermosAberto] = useState(false);
  const [privacidadeAberto, setPrivacidadeAberto] = useState(false);

  return (
    <footer className="bg-musgo pt-10 pb-5 sm:pt-12">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Colunas: logo+desc | contactos | legal — empilham centradas em mobile.
            Contactos fica mais largo para os 3 links caberem numa linha em desktop. */}
        <div className="grid gap-8 md:grid-cols-[1.2fr_2fr_1fr]">
          {/* Logo + descrição */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <Image
              src="/brand/logo-offwhite.webp"
              alt={site.nome}
              width={680}
              height={548}
              className="h-12 w-auto sm:h-14"
            />
            <p className="mt-3 max-w-xs text-[0.875rem] italic leading-relaxed text-creme/55">
              {site.tagline}
            </p>
            <button
              onClick={abrirModal}
              className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-creme/20 px-6 py-3 text-[0.8125rem] font-medium text-creme/80 transition-all duration-300 hover:border-creme/40 hover:bg-creme/5"
            >
              Entrar na lista
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Contactos — email, WhatsApp e Instagram numa linha quando há espaço;
              quebram para a linha seguinte em ecrãs mais pequenos (flex-wrap). */}
          <div id="contactos" className="flex scroll-mt-28 flex-col items-center text-center md:items-start md:text-left">
            <h3 className="eyebrow text-creme/35">Contactos</h3>
            <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[0.875rem] text-creme/60 md:justify-start">
              <li>
                <a
                  href={`mailto:${site.contacto.email}`}
                  aria-label={`Enviar email para ${site.contacto.email}`}
                  className="inline-flex min-h-11 items-center gap-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  <MailIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  {site.contacto.email}
                </a>
              </li>
              <li>
                <a
                  href={linkWhatsApp(
                    site.contacto.whatsapp.numero,
                    "Olá Vitória! Vim pela página do Além do Espelho."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Falar com Vitória Gomes no WhatsApp (abre em nova janela)"
                  className="inline-flex min-h-11 items-center gap-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  <WhatsAppIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  Vitória Gomes
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/vitaasilva/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram do evento (abre em nova janela)"
                  className="inline-flex min-h-11 items-center gap-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  <InstagramIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          {/* Legal — modais em vez de texto estático */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <h3 className="eyebrow text-creme/35">Legal</h3>
            <ul className="mt-3 space-y-1 text-[0.8125rem]">
              <li>
                <button
                  type="button"
                  onClick={() => setTermosAberto(true)}
                  className="inline-flex min-h-11 items-center text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  Termos de Serviço
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setPrivacidadeAberto(true)}
                  className="inline-flex min-h-11 items-center text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  Política de Privacidade
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Marca Essence — clicável para o Instagram, centralizada acima da linha */}
        <div className="mt-8 flex justify-center">
          <a
            href="https://www.instagram.com/essenceofbeauty.salon/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Essence of Beauty no Instagram (abre em nova janela)"
            className="rounded-sm transition-opacity duration-300 hover:opacity-75 focus-visible:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-creme/50"
          >
            <Image
              src="/logo/eb-marca-papel.png"
              alt="Essence of Beauty"
              width={1180}
              height={453}
              quality={95}
              className="h-9 w-auto sm:h-10"
            />
          </a>
        </div>

        {/* Barra única — centrada, com quebra de linha em ecrãs pequenos */}
        <div className="mt-4 border-t border-creme/10 pt-3">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[0.8125rem] text-creme/45">
            <span>© {new Date().getFullYear()} Além do Espelho</span>
            <span aria-hidden>•</span>
            <span>Essence of Beauty</span>
            <span aria-hidden>•</span>
            <span>{site.subtitulo} — {site.edicao}</span>
          </p>
        </div>
      </div>

      {/* Modais legais */}
      <TermosModal aberto={termosAberto} fechar={() => setTermosAberto(false)} />
      <PrivacidadeModal aberto={privacidadeAberto} fechar={() => setPrivacidadeAberto(false)} />
    </footer>
  );
}
