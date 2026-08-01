import Image from "next/image";
import { Sparkles, BookOpen } from "lucide-react";
import Reveal from "./Reveal";

export default function Gallery() {
  return (
    <section className="relative overflow-hidden bg-creme py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <span className="eyebrow text-rosa">NA PRIMEIRA EDIÇÃO</span>
          <h2 className="display mt-5 max-w-xl text-[2.25rem] leading-[1.06] text-vinho sm:text-5xl">
            O dia que abriu o caminho.
          </h2>
        </Reveal>

        {/* Grid editorial assimétrico — destaque na 1ª edição */}
        <div className="mt-16 grid gap-6 lg:grid-cols-[0.85fr_1fr] lg:items-start">
          {/* ── Coluna esquerda — 1ª edição ── */}
          <Reveal>
            <figure className="group relative mx-auto w-full max-w-[40rem] overflow-hidden rounded-sm">
              <Image
                src="/brand/edicao-1.webp"
                alt="1ª edição do Além do Espelho — o evento que marcou a transformação da vida de muitas mulheres"
                width={642}
                height={856}
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="aspect-[3/4] h-auto w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-carvao/60 via-carvao/10 to-transparent" />
              <figcaption className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                <div className="flex items-center gap-2 text-dourado-claro/80">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="eyebrow text-[0.625rem] tracking-[0.25em]">1ª EDIÇÃO</span>
                </div>
                <p className="mt-2 text-[0.9375rem] font-medium leading-snug text-creme">
                  1ª edição do Evento que marcou a transformação da vida de muitas mulheres
                </p>
              </figcaption>
            </figure>
          </Reveal>

          {/* ── Coluna direita — autoras + citação ── */}
          <div className="flex flex-col gap-6">
            <Reveal delay={0.08}>
              <figure className="group relative overflow-hidden rounded-sm">
                <Image
                  src="/brand/autoras.webp"
                  alt="Autoras do livro «Princípios para o Sucesso do Cristão Empreendedor»"
                  width={1600}
                  height={1066}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="aspect-[3/2] h-auto w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-carvao/55 via-carvao/10 to-transparent" />
                <figcaption className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                  <div className="flex items-center gap-2 text-blush/80">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span className="eyebrow text-[0.625rem] tracking-[0.25em]">AUTORAS</span>
                  </div>
                  <p className="mt-2 text-[0.9375rem] font-medium leading-snug text-creme">
                    Autoras do livro «Princípios para o Sucesso do Cristão Empreendedor»
                  </p>
                </figcaption>
              </figure>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="flex items-center justify-center rounded-sm border border-vinho/10 bg-creme-profundo/70 px-6 py-10 sm:py-12">
                <p className="max-w-md text-center text-[0.9375rem] italic leading-relaxed text-carvao/60">
                  &ldquo;Não é uma conferência onde te sentas e ouves. É uma sala de cem mulheres
                  a fazer o mesmo trabalho ao mesmo tempo.&rdquo;
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
