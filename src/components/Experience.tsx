import Image from "next/image";
import { Flower2, Globe, UserRound } from "lucide-react";
import Reveal from "./Reveal";

/**
 * G.2 — "O que vais viver" (id o-que-te-espera).
 *
 * REESCRITA set 2026 (anexo 3 substitui o anexo 4): a grelha de 4 cartões com
 * ícones saiu — o conteúdo é superseded pelos 3 pilares do banner. A prosa
 * introdutória e a frase de fecho preservam-se no fundo creme; entre elas
 * entra a faixa vinho full-bleed (.faixa-vinho, mesmo fundo do Cronograma do
 * Dia). Fundos com grau/grao: ver classes em globals.css.
 *
 * Contraste AA sobre vinho-profundo: números em creme sobre rosa-escuro/sage
 * (≥4:1); chips com fundo a 24% + borda na cor do pilar e texto creme-neon
 * (≥7:1). Títulos Recline; chips Jost em maiúsculas. Números dos círculos e
 * ícones são decorativos (aria-hidden) — a leitura está na pergunta.
 */

const pilares = [
  {
    pergunta: "Como eu me vejo?",
    temas: "Identidade · Mentalidade · Posicionamento",
    icone: UserRound,
    circulo: "bg-rosa-escuro",
    chip: "border-rosa bg-rosa/25",
  },
  {
    pergunta: "O que eu expresso e deixo no mundo?",
    temas: "Marca pessoal · Etiqueta · Finanças · Impacto · Cultura · Saúde",
    icone: Globe,
    circulo: "bg-sage",
    chip: "border-sage bg-sage/25",
  },
  {
    pergunta: "O que permanece quando o espelho deixa de ser suficiente?",
    temas: "Espiritualidade · Superação · Verdadeira beleza",
    icone: Flower2,
    circulo: "bg-rosa-escuro",
    chip: "border-rosa bg-rosa/25",
  },
] as const;

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

      {/* Prosa introdutória — preservada, fundo creme */}
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <span className="eyebrow text-rosa">O que vais viver</span>
          <h2 className="display mt-5 max-w-xl text-[2.25rem] leading-[1.06] text-vinho sm:text-5xl">
            O que vais viver no Além do Espelho
          </h2>
          <p className="mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-carvao/65">
            Um dia inteiro para olhares para dentro, sem estares sozinha.
          </p>

          {/* Manifesto: continua a abertura do hero, no lugar do parágrafo de introdução */}
          <div className="mt-8 max-w-lg text-[1.0625rem] leading-relaxed text-carvao/65">
            <p>
              Talvez tenhas passado anos a cuidar de todos, a cumprir expectativas e a ser
              forte. Mas, em algum lugar no caminho, deixaste de te reconhecer.
            </p>
            <p className="mt-4">
              Um dia inteiro pensado para te ajudar a recuperar a tua voz, a tua confiança, a
              tua feminilidade e a mulher que sempre existiu dentro de ti.
            </p>
            <p className="mt-4">
              Porque quando uma mulher muda a forma como se vê, muda a forma como vive.
            </p>
          </div>
        </Reveal>
      </div>

      {/* ── Faixa vinho full-bleed: os 3 pilares do dia (anexo 3) ── */}
      <div className="faixa-vinho relative mt-16 overflow-hidden sm:mt-20">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <Reveal>
            <div className="text-center">
              <span className="eyebrow text-rosa-suave">2ª Edição · Além de Mim</span>
              <h2 className="display mt-5 text-[2.25rem] leading-[1.06] text-creme-neon sm:text-5xl">
                O que vais viver?
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-[0.9375rem] leading-relaxed text-creme/65 sm:text-[1rem]">
                A nossa imersão em 12 momentos que respondem a três perguntas que ecoam no
                nosso interior:
              </p>
            </div>
          </Reveal>

          {/* Pilares: 3 colunas ≥md com separadores ténues; empilham no mobile */}
          <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-0 sm:mt-14">
            {pilares.map((pilar, i) => {
              const Icone = pilar.icone;
              return (
                <Reveal
                  key={pilar.pergunta}
                  delay={i * 0.1}
                  className={`flex flex-col items-center text-center md:px-8 ${
                    i > 0 ? "md:border-l md:border-creme-neon/14" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-[1.0625rem] font-semibold text-creme-neon ${pilar.circulo}`}
                    >
                      {i + 1}
                    </span>
                    <Icone aria-hidden className={`h-5 w-5 ${i === 1 ? "text-sage" : "text-rosa"}`} />
                  </div>
                  <h3 className="display mt-5 max-w-[22rem] text-[1.375rem] leading-snug text-creme-neon sm:text-[1.5rem]">
                    {pilar.pergunta}
                  </h3>
                  <span
                    className={`mt-4 inline-flex max-w-full rounded-full border px-4 py-2 text-[0.6875rem] font-medium uppercase leading-relaxed tracking-[0.14em] text-creme-neon ${pilar.chip}`}
                  >
                    {pilar.temas}
                  </span>
                </Reveal>
              );
            })}
          </div>

          {/* Fecho manuscrito da faixa */}
          <Reveal>
            <p className="display mt-12 text-center text-[1.375rem] italic leading-snug text-rosa-manuscrito sm:mt-14 sm:text-[1.5rem]">
              Mais do que um evento, uma jornada de dentro para fora.
            </p>
          </Reveal>
        </div>
      </div>

      {/* Fecho da secção — preservado, fundo creme */}
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <p className="display mx-auto mt-20 max-w-xl text-center text-[1.75rem] leading-[1.15] text-vinho sm:text-[2rem]">
            Toda a transformação começa quando decides olhar para ti.
          </p>
        </Reveal>
      </div>
    </section>
  );
}