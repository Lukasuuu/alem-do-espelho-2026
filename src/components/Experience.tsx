import Image from "next/image";
import { Sparkles, Heart, Users, Music } from "lucide-react";
import Reveal from "./Reveal";
import { experiencia } from "@/lib/site";

const icones = [Sparkles, Heart, Users, Music];

export default function Experience() {
  return (
    <section id="o-que-te-espera" className="grau relative overflow-hidden bg-creme py-24 sm:py-28">
      {/* Marca d'água decorativa */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-1/2 hidden -translate-y-1/2 opacity-[0.04] lg:block"
      >
        <Image
          src="/brand/logo-verde.webp"
          alt=""
          width={680}
          height={548}
          className="w-[34rem]"
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <span className="eyebrow text-rosa">O que te espera</span>
          <h2 className="display mt-5 max-w-xl text-[2.25rem] leading-[1.06] text-vinho sm:text-5xl">
            Um dia inteiro a olhar para dentro — acompanhada.
          </h2>
          <p className="mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-carvao/65">
            Não é uma conferência onde te sentas e ouves. É uma sala de cem mulheres a fazer o
            mesmo trabalho ao mesmo tempo.
          </p>
        </Reveal>

        {/* Grid de 4 diferenciais com ícones */}
        <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {experiencia.map((item, i) => {
            const Icone = icones[i] ?? Sparkles;
            return (
              <Reveal as="li" key={item.titulo} delay={i * 0.08}>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-rosa/10">
                  <Icone className="h-5 w-5 text-rosa" />
                </div>
                <h3 className="display text-[1.5rem] leading-tight text-vinho sm:text-[1.75rem]">
                  {item.titulo}
                </h3>
                <p className="mt-3.5 max-w-sm text-[0.9375rem] leading-relaxed text-carvao/65">
                  {item.texto}
                </p>
              </Reveal>
            );
          })}
        </ul>

      </div>
    </section>
  );
}
