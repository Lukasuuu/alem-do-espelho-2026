"use client";

import Image from "next/image";
import { Camera, Mail, ChevronRight } from "lucide-react";
import { site } from "@/lib/site";

type Props = {
  abrirModal: () => void;
};

export default function Footer({ abrirModal }: Props) {
  return (
    <footer className="bg-musgo py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <Image
            src="/brand/logo-offwhite.webp"
            alt={site.nome}
            width={680}
            height={548}
            className="h-14 w-auto sm:h-18"
          />

          <p className="mt-6 max-w-sm text-[0.9375rem] italic leading-relaxed text-creme/55">
            {site.tagline}
          </p>

          {/* Botão no footer */}
          <button
            onClick={abrirModal}
            className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-creme/20 px-6 py-3 text-[0.8125rem] font-medium text-creme/80 transition-all duration-300 hover:border-creme/40 hover:bg-creme/5"
          >
            Entrar na lista
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          {/* Fio */}
          <div className="fio mt-12 w-full max-w-md text-creme/25" aria-hidden />

          {/* Logos realização */}
          <div className="mt-10">
            <span className="eyebrow text-creme/25">Realização</span>
            <div className="mt-5 flex items-center justify-center gap-10 sm:gap-14">
              <Image
                src="/brand/essence-claro.webp"
                alt="Essence of Beauty"
                width={420}
                height={420}
                className="h-12 w-auto opacity-60 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0 sm:h-14"
              />
              <Image
                src="/brand/atos.webp"
                alt="Atos"
                width={420}
                height={418}
                className="h-12 w-auto opacity-60 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0 sm:h-14"
              />
            </div>
          </div>

          {/* Links sociais */}
          <div className="mt-10 flex items-center gap-6">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[0.8125rem] text-creme/40 transition-colors hover:text-creme/70"
              aria-label="Instagram"
            >
              <Camera className="h-4 w-4" />
              Instagram
            </a>
            <span className="text-creme/15">|</span>
            <a
              href="mailto:ola@alemdoespelho.pt"
              className="flex items-center gap-2 text-[0.8125rem] text-creme/40 transition-colors hover:text-creme/70"
              aria-label="Email"
            >
              <Mail className="h-4 w-4" />
              ola@alemdoespelho.pt
            </a>
          </div>

          {/* Fio */}
          <div className="fio mt-10 w-full max-w-md text-creme/25" aria-hidden />

          {/* Créditos */}
          <div className="mt-10 flex flex-col items-center gap-1.5 text-[0.75rem] text-creme/35">
            <span>
              {site.data.extenso} · {site.local.nome}, {site.local.cidade}
            </span>
            <span>© {new Date().getFullYear()} Além do Espelho · Essence of Beauty</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
