import Image from "next/image";
import Reveal from "./Reveal";

/**
 * G.2 — "O que vais viver" (id o-que-te-espera) — r2 (set 2026).
 *
 * A secção INTEIRA é vinho (.faixa-pilares: chão #411618 + vinheta central
 * + blush nos cantos) — já não existe parte creme. O rosto em linha do
 * banner sangra no canto superior direito (≥768px). A prosa é apoio: 2
 * frases por baixo do título, com um <details> "Ler mais" que guarda o
 * resto do texto original (decisão do Lucas). O foco são o título e os
 * 3 pilares; ícones dispensados (o número domina). "Toda a transformação
 * começa quando decides olhar para ti." sai da secção (r2 à letra).
 *
 * Contraste AA sobre vinho: número em Recline creme sobre círculos
 * rosa/sage — texto grande, ≥3:1 ✓. Nos chips (13px = texto normal, exige
 * 4.5:1) o rosa #BA7984 com creme fica a 3.2:1 — falha; usam rosa-escuro
 * #AD6672 (6.1:1), mesmo tom de família; o sage passa como está (4.7:1).
 *
 * TODO(r2): a folhagem do banner entra no canto inferior esquerdo quando
 * o recorte public/banner/banner-folhas.webp for fornecido (o slot está
 * marcado abaixo) — os recortes já têm o esbatimento feito, NÃO recriar.
 */

const pilares = [
  {
    pergunta: "Como eu me vejo?",
    temas: "Identidade · Mentalidade · Posicionamento",
    circulo: "bg-rosa",
    chip: "bg-rosa-escuro",
  },
  {
    pergunta: "O que eu expresso e deixo no mundo?",
    temas: "Marca pessoal · Etiqueta · Finanças · Impacto · Cultura · Saúde",
    circulo: "bg-sage",
    chip: "bg-sage",
  },
  {
    pergunta: "O que permanece quando o espelho deixa de ser suficiente?",
    temas: "Espiritualidade · Superação · Verdadeira beleza",
    circulo: "bg-rosa",
    chip: "bg-rosa-escuro",
  },
] as const;

export default function Experience() {
  return (
    <section
      id="o-que-te-espera"
      className="faixa-pilares relative select-none overflow-hidden py-20 sm:py-24 md:py-28"
    >
      {/* Decorativos do banner: rosto em linha (canto superior direito) e,
          quando o recorte chegar, folhagem no inferior esquerdo. aria-hidden,
          sem pointer events e sem seleção — nunca competem com o texto. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
        <Image
          src="/banner/banner-rosto.webp"
          alt=""
          width={283}
          height={508}
          loading="lazy"
          decoding="async"
          className="absolute right-0 top-0 hidden h-auto w-[clamp(110px,17vw,290px)] md:block"
        />
        {/* TODO(r2): banner-folhas.webp — absolute left-0 bottom-0 h-auto
            w-[clamp(90px,26vw,150px)] md:w-[clamp(120px,18vw,300px)] */}
      </div>

      <div className="relative z-[1] mx-auto max-w-6xl px-5 sm:px-8">
        {/* Cabeçalho: eyebrow com hairlines → script → título (o foco) → prosa de apoio */}
        <Reveal>
          <div className="text-center">
            <span className="eyebrow flex items-center justify-center gap-4 text-rosa-suave">
              <span aria-hidden className="h-px w-10 bg-current opacity-60 sm:w-16" />
              2ª Edição
              <span aria-hidden className="h-px w-10 bg-current opacity-60 sm:w-16" />
            </span>
            <p className="display mt-6 text-[clamp(1.625rem,3vw,2.75rem)] italic leading-none text-rosa-manuscrito">
              Além de mim
            </p>
            <h2 className="display mt-4 text-[clamp(2.125rem,5.4vw,4.75rem)] leading-[1.04] text-balance text-creme-neon">
              O que vais viver?
            </h2>
            <p className="mx-auto mt-6 max-w-[64ch] text-[clamp(0.9375rem,1.15vw,1.0625rem)] leading-relaxed text-creme/70">
              Um dia inteiro para olhares para dentro, sem estares sozinha — pensado
              para te ajudar a recuperar a tua voz, a tua confiança e a mulher que
              sempre existiu dentro de ti.
            </p>
            <p className="mx-auto mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-creme/55">
              A nossa imersão em 12 momentos que respondem a três perguntas que ecoam
              no nosso interior:
            </p>
          </div>
        </Reveal>

        {/* Ler mais: o resto do texto original, disponível sem dominar a secção */}
        <Reveal delay={0.06}>
          <details className="group mx-auto mt-4 max-w-[64ch] text-center">
            <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center justify-center gap-2 text-[0.8125rem] font-medium uppercase tracking-[0.14em] text-creme/55 transition-colors duration-300 hover:text-creme [&::-webkit-details-marker]:hidden">
              Ler mais
              <span
                aria-hidden
                className="transition-transform duration-300 group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <div className="mt-4 space-y-3 text-left text-[0.9375rem] leading-relaxed text-creme/65">
              <p>
                Talvez tenhas passado anos a cuidar de todos, a cumprir expectativas e
                a ser forte. Mas, em algum lugar no caminho, deixaste de te
                reconhecer.
              </p>
              <p>
                Um dia inteiro pensado para te ajudar a recuperar a tua voz, a tua
                confiança, a tua feminilidade e a mulher que sempre existiu dentro de
                ti.
              </p>
            </div>
          </details>
        </Reveal>

        {/* 3 pilares — o foco visual. Separadores ténues só ≥md; empilham no mobile. */}
        <div className="mt-14 grid gap-12 sm:mt-16 md:grid-cols-3 md:gap-0">
          {pilares.map((pilar, i) => (
            <Reveal
              key={pilar.pergunta}
              delay={i * 0.1}
              className={`flex flex-col items-center text-center md:px-8 ${
                i > 0 ? "md:border-l md:border-creme-neon/14" : ""
              }`}
            >
              <span
                aria-hidden
                className={`flex h-14 w-14 items-center justify-center rounded-full text-creme-neon sm:h-16 sm:w-16 ${pilar.circulo}`}
              >
                <span className="display text-[1.5rem] sm:text-[1.75rem]">{i + 1}</span>
              </span>
              <h3 className="display mt-5 max-w-[24rem] text-[clamp(1.125rem,1.5vw,1.5625rem)] leading-snug text-balance text-creme-neon">
                {pilar.pergunta}
              </h3>
              <span
                className={`mt-5 inline-flex max-w-[22rem] items-center justify-center rounded-full px-6 py-3 text-center text-[0.8125rem] font-medium uppercase leading-relaxed tracking-[0.08em] text-creme-neon ${pilar.chip}`}
              >
                {pilar.temas}
              </span>
            </Reveal>
          ))}
        </div>

        {/* Fecho manuscrito */}
        <Reveal>
          <p className="display mt-14 text-center text-[clamp(1.1875rem,2.2vw,1.875rem)] italic leading-snug text-rosa-manuscrito sm:mt-16">
            Mais do que um evento, uma jornada de dentro para fora.
          </p>
        </Reveal>
      </div>
    </section>
  );
}