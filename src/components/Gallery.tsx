import Image from "next/image";
import { Sparkles, BookOpen } from "lucide-react";
import Reveal from "./Reveal";

export default function Gallery() {
  return (
    <section className="relative overflow-hidden bg-creme py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <span className="eyebrow text-rosa">Na primeira edição</span>
          <h2 className="display mt-5 max-w-xl text-[2.25rem] leading-[1.06] text-vinho sm:text-5xl">
            A tua história ainda pode ganhar um novo capítulo.
          </h2>
        </Reveal>

        {/* Grid editorial assimétrico: 1ª edição à esquerda, autoras + citação à direita.
            O bloco de citação é o terceiro retângulo e fecha a grelha na base. */}
        <div className="mt-16 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          {/* 1ª edição, ocupa as duas linhas */}
          <Reveal className="lg:row-span-2">
            <figure className="group relative mx-auto w-full max-w-[40rem] overflow-hidden rounded-sm">
              <Image
                src="/brand/edicao-1.webp"
                alt="1ª edição do Além do Espelho, o evento que marcou a transformação da vida de muitas mulheres"
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
                  A 1ª edição, o dia que mudou a forma como muitas mulheres se veem.
                </p>
              </figcaption>
            </figure>
          </Reveal>

          {/* Autoras, linha 1 */}
          <Reveal delay={0.08}>
            <figure className="group relative overflow-hidden rounded-sm">
              <Image
                src="/brand/grupo.webp"
                alt="Autoras do livro «Princípios para o Sucesso do Cristão Empreendedor»"
                width={1079}
                height={720}
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
                <p className="mt-1 text-[0.8125rem] tracking-[0.08em] text-creme/70">
                  Editora Florecer
                </p>
              </figcaption>
            </figure>
          </Reveal>

          {/* Citação, linha 2, estica até à base da foto da 1ª edição */}
          <Reveal delay={0.15}>
            <div className="flex h-full flex-col justify-end gap-5 rounded-sm border border-vinho/10 bg-blush/25 p-8 sm:p-10 lg:min-h-[13rem]">
              <span className="fio block w-16 text-vinho" aria-hidden />
              <p className="display text-left text-[1.35rem] leading-[1.3] text-vinho sm:text-[1.6rem]">
                Umas recomeçaram.
                <br />
                Outras escreveram um livro.
                <br />
                <em className="italic text-rosa">Algumas passaram por esta sala.</em>
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
