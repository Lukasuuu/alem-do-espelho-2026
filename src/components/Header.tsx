"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, MapPin, Menu, X } from "lucide-react";
import { site } from "@/lib/site";
import { travarScroll, destravarScroll } from "@/lib/scroll-lock";

type Props = {
  abrirModal: () => void;
  /** Gate do servidor (page.tsx → cutover.inscricaoAtiva): false → a vitrine de
   *  patrocinadores não existe na página e o link PATROCINADORES sai da navbar. */
  faseInscricaoAtiva?: boolean;
  /** Links âncora da navbar (o mapa da página onde renderiza). Omissão →
   *  mapa do evento. A ListaEsperaPage passa a sua própria lista. */
  links?: Link[];
};

type Link = { href: string; rotulo: string };

/**
 * Navbar direcional do evento (Bloco A).
 *
 * Continua FIXED (não sticky): visualmente equivalente para uma barra que sai
 * do hero e evita compensar padding do Hero. Ganha fundo musgo/blur ao descolar
 * (já existia) + env(safe-area-inset-top) no wrapper, para notches.
 *
 * Mapa do evento: links âncora com scroll-spy (IntersectionObserver, banda no
 * meio do ecrã) + aria-current. O offset do salto vive no CSS global
 * (--navbar-h + section[id] scroll-margin-top) e a smooth scroll já é do html.
 *
 * CTA reutiliza abrirModal (abrirFluxo do EventoPage — gate de fase intacto,
 * nada de link novo). PATROCINADORES aparece só com faseInscricaoAtiva.
 *
 * Mobile (<lg): painel lateral (dialog) com os mesmos links + CTA; Esc, clique
 * fora, fecho ao escolher link, trap de foco e scroll do corpo travado pelo
 * helper partilhado @/lib/scroll-lock (contador, empilha com modais).
 *
 * Data/local mantidos: ≥xl na barra; <lg dentro do painel. Nunca apagados.
 */
export default function Header({ abrirModal, faseInscricaoAtiva = false, links: linksProp }: Props) {
  const [descolado, setDescolado] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [ativo, setAtivo] = useState<string | null>(null);

  const painelRef = useRef<HTMLDivElement>(null);
  const botaoMenuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const aoRolar = () => setDescolado(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  // ── Links âncora — mapa do evento por omissão; PATROCINADORES segue o gate. ──
  const links = useMemo<Link[]>(() => {
    if (linksProp) return linksProp;
    const base: Link[] = [
      { href: "#o-evento", rotulo: "O evento" },
      { href: "#o-que-te-espera", rotulo: "O que vais viver" },
      { href: "#cronograma", rotulo: "Cronograma" },
    ];
    if (faseInscricaoAtiva) {
      base.push({ href: "#patrocinadores", rotulo: "Patrocinadores" });
    }
    base.push({ href: "#missao", rotulo: "Missão" });
    return base;
  }, [linksProp, faseInscricaoAtiva]);

  // ── Scroll-spy: a secção sob a banda central fica ativa. ──
  useEffect(() => {
    const elementos = links
      .map((l) => document.getElementById(l.href.slice(1)))
      .filter((el): el is HTMLElement => el !== null);
    if (!elementos.length || typeof IntersectionObserver === "undefined") return;

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setAtivo(`#${entrada.target.id}`);
            return;
          }
        }
      },
      // Secção ativa quando cruza o meio do ecrã (banda de 5%).
      { rootMargin: "-45% 0px -50% 0px" }
    );
    elementos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [links]);

  // ── Painel mobile: scroll-lock, foco, trap e Esc. ──
  useEffect(() => {
    if (!menuAberto) return;
    travarScroll();

    const antesFocado = document.activeElement as HTMLElement | null;
    const primeiro = painelRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])");
    primeiro?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuAberto(false);
        return;
      }
      if (e.key !== "Tab" || !painelRef.current) return;
      const focaveis = Array.from(
        painelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
      );
      if (!focaveis.length) return;
      const primeiroEl = focaveis[0];
      const ultimoEl = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiroEl) {
        e.preventDefault();
        ultimoEl.focus();
      } else if (!e.shiftKey && document.activeElement === ultimoEl) {
        e.preventDefault();
        primeiroEl.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      destravarScroll();
      // Devolve o foco ao hambúrguer (no-unmount o ref já é null — no-op).
      botaoMenuRef.current?.focus();
      void antesFocado;
    };
  }, [menuAberto]);

  // Link do painel: fecha primeiro (destrava o scroll no cleanup) e depois
  // salta — o scroll-margin-top do CSS global trata do offset da barra.
  const irParaSecao = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMenuAberto(false);
    window.setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  const informacoes = (
    <div className="flex items-center gap-4 text-[0.8125rem] text-creme/60">
      <span className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5" />
        {site.data.curta}
      </span>
      <span className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" />
        {site.local.cidade}
      </span>
    </div>
  );

  return (
    <div
      className="fixed inset-x-0 top-0 z-50"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <header
        className={`transition-all duration-500 ${
          descolado
            ? "border-b border-creme/10 bg-musgo/90 py-2 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent py-4"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          {/* Logo */}
          <a href="#topo" className="flex min-h-[44px] items-center gap-3" aria-label={site.nome}>
            <Image
              src="/brand/logo-offwhite.webp"
              alt={site.nome}
              width={680}
              height={548}
              priority
              className={`w-auto transition-all duration-500 ${descolado ? "h-9" : "h-11 sm:h-12"}`}
            />
            <span className="sr-only">{site.nome}</span>
          </a>

          {/* Desktop ≥lg: mapa do evento + CTA (informações ≥xl para caber) */}
          <div className="hidden items-center gap-2 lg:flex">
            <nav aria-label="Navegação do evento" className="flex items-center">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={ativo === link.href ? "true" : undefined}
                  className={`inline-flex min-h-[44px] flex-col items-center justify-center px-2.5 text-[0.75rem] font-medium uppercase tracking-[0.14em] transition-colors duration-300 xl:px-3 ${
                    ativo === link.href ? "text-creme-neon" : "text-creme/65 hover:text-creme"
                  }`}
                >
                  {link.rotulo}
                  <span
                    aria-hidden
                    className={`mt-0.5 h-1 w-1 rounded-full bg-rosa transition-opacity duration-300 ${
                      ativo === link.href ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </a>
              ))}
            </nav>

            <div className="hidden xl:block">{informacoes}</div>

            <button
              onClick={abrirModal}
              className="group ml-3 inline-flex items-center justify-center gap-2 rounded-full bg-rosa px-5 py-2.5 text-[0.8125rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_8px_28px_-8px_rgba(196,126,138,0.6)] xl:px-6"
            >
              Quero garantir o meu lugar
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>

          {/* Mobile <lg: hambúrguer (data/local vivem no painel) */}
          <button
            ref={botaoMenuRef}
            onClick={() => setMenuAberto(!menuAberto)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-creme/20 text-creme/70 lg:hidden"
            aria-expanded={menuAberto}
            aria-controls="menu-evento"
            aria-label={menuAberto ? "Fechar menu do evento" : "Abrir menu do evento"}
          >
            {menuAberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ── Painel mobile <lg: dialog full-width com os mesmos links + CTA ── */}
      {menuAberto && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          {/* Fundo: clique fora fecha */}
          <div className="absolute inset-0 bg-carvao/70 backdrop-blur-sm" onClick={() => setMenuAberto(false)} aria-hidden />

          <div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu do evento"
            className="absolute inset-y-0 right-0 flex w-full max-w-[24rem] flex-col overflow-y-auto bg-musgo shadow-[0_0_80px_-20px_rgba(0,0,0,0.6)]"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="flex items-center justify-between px-6 pb-4 pt-5">
              <Image
                src="/brand/logo-offwhite.webp"
                alt=""
                width={680}
                height={548}
                className="h-9 w-auto"
              />
              <button
                onClick={() => setMenuAberto(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-creme/20 text-creme/70"
                aria-label="Fechar menu do evento"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 pb-2 pt-2">{informacoes}</div>

            <nav aria-label="Navegação do evento" className="flex flex-col px-2 py-2">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => irParaSecao(e, link.href)}
                  aria-current={ativo === link.href ? "true" : undefined}
                  className={`flex min-h-[44px] items-center gap-3 rounded-sm px-4 text-[0.875rem] font-medium uppercase tracking-[0.14em] transition-colors duration-300 ${
                    ativo === link.href
                      ? "text-creme-neon"
                      : "text-creme/70 hover:bg-creme/5 hover:text-creme"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full bg-rosa transition-opacity duration-300 ${
                      ativo === link.href ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {link.rotulo}
                </a>
              ))}
            </nav>

            <div className="mt-auto px-6 pb-8 pt-4">
              <button
                onClick={() => {
                  abrirModal();
                  setMenuAberto(false);
                }}
                className="group inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-rosa px-6 py-3 text-[0.875rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro"
              >
                Quero garantir o meu lugar
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}