import Image from "next/image";
import { Heart, Sparkles, BookOpen } from "lucide-react";
import Reveal from "./Reveal";
import { site } from "@/lib/site";

export default function Gallery() {
  return (
    <section id="o-que-te-espera" className="relative overflow-hidden bg-creme py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
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

        {/* Grid editorial assimétrico */}
        <div className="mt-16 grid gap-4 sm:grid-cols-3 sm:grid-rows-[auto_auto_auto]">
          {/* ── Card 1 — Grande, grupo ── */}
          <Reveal className="sm:col-span-2 sm:row-span-2">
            <div className="group relative h-full min-h-[18rem] overflow-hidden rounded-sm sm:min-h-[24rem]">
              <Image
                src="/brand/grupo.webp"
                alt="Mulheres no Além do Espelho — edição anterior"
                width={2400}
                height={1600}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 66vw"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-carvao/50 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                <div className="flex items-center gap-2 text-blush/80">
                  <Heart className="h-3.5 w-3.5" />
                  <span className="eyebrow text-[0.625rem] tracking-[0.25em]">CONEXÃO</span>
                </div>
                <p className="mt-2 text-[0.9375rem] font-medium leading-snug text-creme">
                  Cem mulheres na mesma sala a fazer o mesmo trabalho ao mesmo tempo.
                </p>
              </div>
            </div>
          </Reveal>

          {/* ── Card 2 — Vertical, decoração ── */}
          <Reveal delay={0.05} className="sm:col-span-1 sm:row-span-2">
            <div className="group relative h-full min-h-[18rem] overflow-hidden rounded-sm sm:min-h-[24rem]">
              <Image
                src="/brand/WhatsApp Image 2026-07-21 at 19.20.03.jpeg"
                alt="Decoração do evento Além do Espelho"
                width={1365}
                height={2048}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-carvao/50 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                <div className="flex items-center gap-2 text-dourado-claro/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="eyebrow text-[0.625rem] tracking-[0.25em]">BELEZA</span>
                </div>
                <p className="mt-2 text-[0.875rem] font-medium leading-snug text-creme">
                  O cuidado com cada detalhe.
                </p>
              </div>
            </div>
          </Reveal>

          {/* ── Card 3 — Grupo.png (autoras) ── */}
          <Reveal delay={0.1} className="sm:col-span-1">
            <div className="group relative h-52 overflow-hidden rounded-sm sm:h-56">
              <Image
                src="/brand/Grupo.png"
                alt="Grupo de mulheres autoras"
                width={642}
                height={856}
                sizes="(max-width: 640px) 100vw, 33vw"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-carvao/40 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 text-blush/70">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="eyebrow text-[0.625rem] tracking-[0.25em]">AUTORAS</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ── Card 4 — Texto editorial ── */}
          <Reveal delay={0.15} className="sm:col-span-2">
            <div className="flex h-52 items-center justify-center rounded-sm bg-creme-profundo/70 border border-vinho/10 px-6 sm:h-56">
              <p className="max-w-md text-center text-[0.9375rem] italic leading-relaxed text-carvao/60">
                &ldquo;Não é uma conferência onde te sentas e ouves. É uma sala de cem mulheres
                a fazer o mesmo trabalho ao mesmo tempo.&rdquo;
              </p>
            </div>
          </Reveal>
        </div>

        {/* ── Menção subtil ao livro ── */}
        <Reveal delay={0.2}>
          <div className="mx-auto mt-14 max-w-2xl border-t border-vinho/10 pt-10 text-center">
            <p className="mx-auto max-w-lg text-[0.9375rem] italic leading-relaxed text-carvao/55">
              Vitória conheceu grandes empreendedoras graças ao livro que partilharam — e agora
              quer trazer esse ensino para um dia transformador, onde cada mulher se reconecta
              consigo mesma.
            </p>
          </div>
        </Reveal>

        {/* ── Bloco da Anfitriã ── */}
        <Reveal delay={0.25}>
          <div className="mt-20 grid items-center gap-12 sm:grid-cols-[1fr_1.2fr] sm:gap-16">
            {/* Foto com moldura */}
            <div className="w-fit rounded-sm bg-white p-3 shadow-[0_8px_32px_-12px_rgba(46,58,51,0.25)] ring-1 ring-vinho/5">
              <Image
                src="/brand/vitoria.webp"
                alt={`${site.anfitria.nome}, anfitriã do ${site.nome}`}
                width={820}
                height={1230}
                sizes="(max-width: 640px) 80vw, 35vw"
                className="w-full max-w-[22rem] rounded-sm object-cover"
              />
            </div>

            {/* Texto */}
            <div>
              <span className="eyebrow text-rosa">A ANFITRIÃ</span>
              <p className="display mt-6 text-[1.75rem] leading-snug text-vinho sm:text-[2.25rem]">
                &ldquo;Quando uma mulher descobre quem realmente é, ela transforma tudo ao seu
                redor.&rdquo;
              </p>
              <p className="mt-6 text-[0.9375rem] font-medium text-carvao">
                {site.anfitria.nome}
              </p>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-carvao/60">
                {site.anfitria.papel}
                <br />
                {site.anfitria.empresa}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
