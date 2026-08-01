"use client";

import Image from "next/image";
import Reveal from "./Reveal";
import { site } from "@/lib/site";

export default function Anfitria() {
  return (
    <section className="grao relative overflow-hidden bg-[#FFF7E9] py-24 sm:py-32">
      {/* Marca d'água — símbolo a espreitar por um lado */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/2 -z-10 -translate-y-1/2 opacity-[0.06]"
      >
        <Image
          src="/brand/logo-verde.webp"
          alt=""
          width={680}
          height={548}
          className="w-[42rem]"
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-[0.85fr_1fr]">
          {/* Retrato — moldura de espelho */}
          <Reveal delay={0.1}>
            <div className="relative mx-auto w-fit">
              <div className="-rotate-1 rounded-sm bg-creme p-3 shadow-[0_30px_80px_-40px_rgba(46,58,51,0.45)] ring-1 ring-vinho/12">
                <Image
                  src="/brand/vitoria.webp"
                  alt={`${site.anfitria.nome}, anfitriã do ${site.nome}`}
                  width={900}
                  height={1350}
                  sizes="(max-width: 640px) 90vw, 40vw"
                  className="aspect-[2/3] h-auto w-full max-w-[24rem] rounded-sm object-cover sm:max-w-[26rem]"
                />
              </div>

              {/* Moldura pequena com a foto sentada — só em ≥sm */}
              <div className="absolute -bottom-8 -right-8 hidden w-40 rotate-2 rounded-sm bg-creme p-2 shadow-[0_20px_50px_-20px_rgba(46,58,51,0.5)] ring-1 ring-vinho/12 sm:block sm:w-52">
                <Image
                  src="/brand/vitoria-sentada.webp"
                  alt=""
                  width={700}
                  height={1050}
                  sizes="13rem"
                  className="aspect-[2/3] h-auto w-full rounded-sm object-cover"
                />
              </div>
            </div>
          </Reveal>

          {/* Texto */}
          <Reveal>
            <Image
              src="/brand/logo-verde.webp"
              alt=""
              width={680}
              height={548}
              className="h-10 w-auto"
            />
            <span className="eyebrow mt-5 block text-rosa">A ANFITRIÃ</span>
            <p className="display mt-6 text-[2rem] leading-[1.1] text-vinho sm:text-[2.5rem]">
              <span className="text-rosa">&ldquo;</span>Quando uma mulher descobre quem
              realmente é, ela transforma tudo ao seu redor.
              <span className="text-rosa">&rdquo;</span>
            </p>
            <p className="mt-6 text-[0.9375rem] font-medium text-carvao">{site.anfitria.nome}</p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-carvao/60">
              {site.anfitria.papel}
              <br />
              {site.anfitria.empresa}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
