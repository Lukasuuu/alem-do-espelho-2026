"use client";

import Image from "next/image";
import { Calendar, Clock, MapPin } from "lucide-react";
import { useState } from "react";
import { InstagramIcon, MailIcon, WhatsAppIcon } from "./icons";
import TermosModal from "./TermosModal";
import PrivacidadeModal from "./PrivacidadeModal";
import { horarioEvento, linkWhatsApp, site } from "@/lib/site";

/**
 * Âncoras de navegação por omissão — as da página do EVENTO. As outras
 * páginas (lista de espera, causa social) passam a sua lista pela prop
 * `navegacao`: nem todas as âncoras existem em todas as páginas (#o-evento
 * só existe aqui; #inscricao só na lista) e uma âncora morta é bug.
 */
const NAVEGACAO_EVENTO = [
  { rotulo: "Início", href: "#topo" },
  { rotulo: "O evento", href: "#o-evento" },
  { rotulo: "Experiência", href: "#o-que-te-espera" },
  { rotulo: "Causa social", href: "#alem-de-mim" },
  { rotulo: "Contactos", href: "#contactos" },
] as const;

type ItemNavegacao = { rotulo: string; href: string };

type Props = {
  abrirModal: () => void;
  /** Âncoras da coluna Navegação — por omissão, as da página do evento. */
  navegacao?: ReadonlyArray<ItemNavegacao>;
};

/**
 * G.2 — Footer adaptado ao padrão "Informações · Navegação · Redes · Legal"
 * (Beauty Business Summit), inteiramente nos tokens do Além do Espelho —
 * nenhuma cor importada. Coluna Contactos mantém os mesmos links de sempre
 * (dados de produção: email, WhatsApp, Instagram) com os seus ícones, e
 * recebe a Essence of Beauty como 4.ª rede. Os links legais passam para a
 * barra final (mesmos modais TermosModal/PrivacidadeModal de sempre).
 */
export default function Footer({ abrirModal, navegacao = NAVEGACAO_EVENTO }: Props) {
  const [termosAberto, setTermosAberto] = useState(false);
  const [privacidadeAberto, setPrivacidadeAberto] = useState(false);

  const infos = [
    { icon: Calendar, texto: site.data.extenso },
    { icon: Clock, texto: horarioEvento() },
    { icon: MapPin, texto: site.local.completo },
  ] as const;

  return (
    <footer className="bg-musgo pt-10 pb-5 sm:pt-12">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Colunas: logo+desc | informações | navegação | redes — 2×2 em tablet, empilham em mobile */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          {/* Logo + descrição (como antes) */}
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
              className="group mt-4 inline-flex items-center gap-2.5 rounded-full border border-creme/20 px-6 py-3 text-[0.8125rem] font-medium text-creme/80 transition-all duration-300 hover:border-creme/40 hover:bg-creme/5"
            >
              Fazer parte
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>

          {/* Informações do evento — mesma fonte de verdade do Cronograma (lib/site) */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <h3 className="eyebrow text-creme/35">O evento</h3>
            <ul className="mt-3 space-y-2.5 text-[0.875rem] text-creme/60">
              {infos.map((info) => (
                <li key={info.texto} className="flex items-start justify-center gap-3 md:justify-start">
                  <info.icon className="mt-0.5 h-[1.15rem] w-[1.15rem] shrink-0 text-dourado-claro/70" aria-hidden />
                  <span className="text-creme/60">{info.texto}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Navegação — âncoras reais da página em que o footer renderiza */}
          <nav aria-label="Navegação do rodapé" className="flex flex-col items-center text-center md:items-start md:text-left">
            <h3 className="eyebrow text-creme/35">Navegação</h3>
            <ul className="mt-1 space-y-0.5 text-[0.875rem]">
              {navegacao.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex min-h-11 items-center px-3 -mx-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                  >
                    {item.rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contactos + redes — os mesmos links de sempre (com ícones) + Essence */}
          <div id="contactos" className="flex scroll-mt-28 flex-col items-center text-center md:items-start md:text-left">
            <h3 className="eyebrow text-creme/35">Contactos</h3>
            <ul className="mt-1 space-y-0.5 text-[0.875rem] text-creme/60">
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
                  aria-label="Instagram de Vitória Gomes (abre em nova janela)"
                  className="inline-flex min-h-11 items-center gap-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  <InstagramIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  Vitória Gomes
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/essenceofbeauty.salon/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Essence of Beauty no Instagram (abre em nova janela)"
                  className="inline-flex min-h-11 items-center gap-3 text-creme/70 transition-colors duration-300 hover:text-creme focus-visible:text-creme"
                >
                  <InstagramIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  Essence of Beauty
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Marca Essence, clicável para o Instagram, centralizada acima da linha */}
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

        {/* Barra única, centrada: © + linha legal (modais Termos/Privacidade) */}
        <div className="mt-4 border-t border-creme/10 pt-3">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[0.8125rem] text-creme/45">
            <span>© {new Date().getFullYear()} Além do Espelho</span>
            <span aria-hidden>·</span>
            <span>Essence of Beauty</span>
            <span aria-hidden>·</span>
            <span>{site.subtitulo} · {site.edicao}</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => setTermosAberto(true)}
              className="inline-flex min-h-11 items-center px-1 text-creme/45 underline-offset-4 transition-colors duration-300 hover:text-creme hover:underline focus-visible:text-creme"
            >
              Termos de Serviço
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => setPrivacidadeAberto(true)}
              className="inline-flex min-h-11 items-center px-1 text-creme/45 underline-offset-4 transition-colors duration-300 hover:text-creme hover:underline focus-visible:text-creme"
            >
              Política de Privacidade
            </button>
          </p>
        </div>
      </div>

      {/* Modais legais */}
      <TermosModal aberto={termosAberto} fechar={() => setTermosAberto(false)} />
      <PrivacidadeModal aberto={privacidadeAberto} fechar={() => setPrivacidadeAberto(false)} />
    </footer>
  );
}