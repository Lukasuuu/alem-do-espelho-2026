"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { InstagramIcon, MailIcon, WhatsAppIcon } from "./icons";
import { site } from "@/lib/site";

type Props = {
  abrirModal: () => void;
};

export default function Footer({ abrirModal }: Props) {
  return (
    <footer className="bg-musgo py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Colunas: logo+desc | contactos | social | legal */}
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Logo + descrição */}
          <div>
            <Image
              src="/brand/logo-offwhite.webp"
              alt={site.nome}
              width={680}
              height={548}
              className="h-14 w-auto sm:h-16"
            />
            <p className="mt-5 max-w-xs text-[0.9375rem] italic leading-relaxed text-creme/55">
              {site.tagline}
            </p>
            <button
              onClick={abrirModal}
              className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-creme/20 px-6 py-3 text-[0.8125rem] font-medium text-creme/80 transition-all duration-300 hover:border-creme/40 hover:bg-creme/5"
            >
              Entrar na lista
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Contactos */}
          <div id="contactos" className="scroll-mt-28">
            <h3 className="eyebrow text-creme/35">Contactos</h3>
            <ul className="mt-5 space-y-3 text-[0.875rem] text-creme/60">
              <li>
                <a
                  href="mailto:essenceofbeauty.pt@gmail.com"
                  aria-label="Enviar email para essenceofbeauty.pt@gmail.com"
                  className="group inline-flex min-h-11 items-center gap-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  <MailIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  essenceofbeauty.pt@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/351939009874?text=Ol%C3%A1%20Vit%C3%B3ria!%20Vim%20pela%20p%C3%A1gina%20do%20Al%C3%A9m%20do%20Espelho."
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Falar com Vitória Gomes no WhatsApp (abre em nova janela)"
                  className="group inline-flex min-h-11 items-center gap-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  <WhatsAppIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  Vitória Gomes
                </a>
              </li>
              <li className="inline-flex min-h-11 items-center">{site.data.extenso}</li>
              <li className="inline-flex min-h-11 items-center">
                {site.local.nome}, {site.local.cidade}
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="eyebrow text-creme/35">Social</h3>
            <ul className="mt-5 space-y-3 text-[0.875rem] text-creme/60">
              <li>
                <a
                  href="https://www.instagram.com/vitaasilva/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram do evento (abre em nova janela)"
                  className="group inline-flex min-h-11 items-center gap-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  <InstagramIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="eyebrow text-creme/35">Legal</h3>
            <ul className="mt-5 space-y-3 text-[0.8125rem] text-creme/50">
              <li>© {new Date().getFullYear()} Além do Espelho</li>
              <li>Essence of Beauty</li>
              <li>{site.subtitulo} — {site.edicao}</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
