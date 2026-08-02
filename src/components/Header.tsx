"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Calendar, MapPin, Menu } from "lucide-react";
import { site } from "@/lib/site";

type Props = {
  abrirModal: () => void;
};

export default function Header({ abrirModal }: Props) {
  const [descolado, setDescolado] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const aoRolar = () => setDescolado(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        descolado
          ? "bg-musgo/90 backdrop-blur-xl border-b border-creme/10 py-3"
          : "bg-transparent border-b border-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        {/* Logo */}
        <a href="#topo" className="flex items-center gap-3" aria-label={site.nome}>
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

        {/* Desktop */}
        <div className="hidden items-center gap-6 sm:flex">
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
          <button
            onClick={abrirModal}
            className="rounded-full bg-rosa px-6 py-2.5 text-[0.8125rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_8px_28px_-8px_rgba(196,126,138,0.6)]"
          >
            Quero fazer parte
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuAberto(!menuAberto)}
          className="flex items-center gap-2 rounded-full border border-creme/20 px-4 py-2 text-[0.8125rem] text-creme/70 sm:hidden"
          aria-label="Menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile menu */}
      {menuAberto && (
        <div className="border-t border-creme/10 bg-musgo/95 backdrop-blur-xl sm:hidden">
          <div className="flex flex-col gap-4 px-5 py-6">
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
            <button
              onClick={() => {
                abrirModal();
                setMenuAberto(false);
              }}
              className="w-full rounded-full bg-rosa px-6 py-3 text-[0.875rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro"
            >
              Quero fazer parte
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
