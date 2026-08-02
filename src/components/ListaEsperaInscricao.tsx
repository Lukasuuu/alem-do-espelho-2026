"use client";

import { Gift } from "lucide-react";
import WaitlistForm from "./WaitlistForm";
import Countdown from "./Countdown";
import { site } from "@/lib/site";

/**
 * Secção de pré-inscrição: o formulário vive aqui inline (em vez de modal),
 * com copy, benefícios e contagem, mesma linguagem visual do modal principal.
 */
export default function ListaEsperaInscricao() {
  return (
    <section id="inscricao" className="relative scroll-mt-24 overflow-hidden bg-vinho py-20 sm:py-24">
      {/* Glow decorativo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/3 left-1/4 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(242,205,186,0.15),transparent_62%)] blur-3xl" />
        <div className="absolute -bottom-1/3 right-0 h-[25rem] w-[25rem] rounded-full bg-[radial-gradient(circle,rgba(196,126,138,0.20),transparent_62%)] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Coluna esquerda, copy + benefícios + contagem */}
          <div className="flex flex-col items-start">
            <span className="eyebrow text-dourado-claro/70">Lista de espera</span>
            <h2 className="display mt-4 text-[2rem] leading-[1.05] text-creme sm:text-[2.5rem]">
              Seja um dos primeiros a receber
              <span className="mt-1 block italic text-blush">todas as novidades.</span>
            </h2>
            <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-creme/65">
              Quem está na lista recebe o aviso antes de todos, assim que as inscrições
              abrirem e escolhe o lugar em primeiro.
            </p>

            <ul className="mt-7 space-y-3">
              {[
                "Aviso por email e WhatsApp antes da abertura oficial",
                "Prioridade na escolha do lugar",
                "Condição especial de lançamento",
              ].map((texto) => (
                <li key={texto} className="flex items-start gap-3">
                  <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dourado-claro/50" />
                  <span className="text-[0.875rem] leading-relaxed text-creme/75">{texto}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <span className="eyebrow text-creme/35">
                {site.data.extenso} · {site.local.nome}, {site.local.cidade}
              </span>
              <div className="mt-3">
                <Countdown tom="claro" />
              </div>
            </div>
          </div>

          {/* Coluna direita, formulário inline */}
          <div>
            <WaitlistForm />
          </div>
        </div>
      </div>
    </section>
  );
}
