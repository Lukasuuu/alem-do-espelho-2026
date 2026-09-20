import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import { capitulos } from "@/lib/cronograma";
import { horarioEvento, site } from "@/lib/site";

/**
 * H.2 — Cronograma do Dia (Mapa do Dia público) — r3 (set 2026).
 *
 * Posição: entre o fecho da causa social ("Transformando mulheres em Portugal /
 * Impactando vidas em Angola") e a faixa REALIZAÇÃO · ORGANIZAÇÃO · APOIO.
 * NUNCA atrás de gate de fase — é informação do evento, não conversão: aparece
 * em todas as fases (ao contrário da vitrine de patrocinadores, gated).
 *
 * r3: faixa VERDE FLORESTA full-bleed (o musgo do hero/rodapé, #3D4A40) em
 * vez do vinho — fecha o ritmo de cor creme → vinho → verde → creme → verde.
 * O section vive DENTRO do contentor max-w-6xl da Realização; para sangrar
 * até às margens da viewport usa o truque left-1/2 + w-screen (o body tem
 * overflow-x:hidden, que engole os ~7px da scrollbar). Coluna ÚNICA em todas
 * as larguras — as 2 colunas partiam a ordem temporal do dia.
 *
 * Conteúdo: SÓ o Mapa do Dia público (hora · experiência · foco) de
 * lib/cronograma.ts — nada do PDF interno (condução, pontes, "a confirmar").
 * Dados do cabeçalho vêm SEMPRE de lib/site.ts (fonte única). Cartões:
 * número Recline blush à esquerda (alinhado ao fio vertical contínuo),
 * separador ténue ≥sm, hora + título (Recline creme) + foco. CTA final
 * reutiliza abrirModal (o mesmo abrirFluxo gated da navbar/hero).
 */

type Props = {
  abrirModal: () => void;
};

export default function MapaDia({ abrirModal }: Props) {
  return (
    <section
      id="cronograma"
      aria-label="Cronograma do dia do evento"
      className="relative left-1/2 w-screen -translate-x-1/2 bg-musgo py-20 md:py-28"
    >
      <div className="mx-auto max-w-[58rem] px-4 sm:px-6">
        {/* Cabeçalho */}
        <Reveal>
          <div className="text-center">
            <span className="eyebrow block text-creme/55">Além do Espelho 2026</span>
            <span className="eyebrow mt-2 block text-blush">O que vais viver no dia</span>
            <h2 className="display mt-5 text-[clamp(1.875rem,4.2vw,3.25rem)] leading-[1.06] text-creme">
              Cronograma do Dia
            </h2>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-creme/65 sm:text-[1rem]">
              {site.data.extenso} · {site.local.nome}, {site.local.cidade} · {horarioEvento()}
            </p>
          </div>
        </Reveal>

        {/* Capítulos — cabeçalho com fio à esquerda + fio até ao fim da linha */}
        {capitulos.map((capitulo, ci) => (
          <div key={capitulo.pergunta} className="mt-12">
            <Reveal>
              <h3 className="mb-4 flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-blush">
                <span aria-hidden className="h-px w-6 shrink-0 bg-creme/20" />
                {`Capítulo ${ci + 1} · ${capitulo.pergunta}`}
                <span aria-hidden className="h-px min-w-6 flex-1 bg-creme/20" />
              </h3>
            </Reveal>

            {/* Coluna única — o dia lê-se por ordem temporal. O fio contínuo
                atrás dos números atravessa os espaços entre cartões (z-1 nos
                cartões para o fio não cruzar a superfície deles). */}
            <ul className="relative grid gap-3">
              <span
                aria-hidden
                className="absolute bottom-7 left-[2.25rem] top-7 w-px bg-creme/14 sm:bottom-8 sm:left-10 sm:top-8"
              />
              {capitulo.momentos.map((momento, mi) => (
                <Reveal
                  as="li"
                  key={momento.n}
                  delay={Math.min(mi * 0.05, 0.3)}
                  className="cartao-mapa relative z-[1] grid grid-cols-[auto_1fr] gap-3 rounded-2xl px-5 py-4 sm:grid-cols-[auto_1px_1fr] sm:px-6 sm:py-5"
                >
                  {/* Número do dia — Recline blush, centrado sobre o fio */}
                  <span
                    aria-hidden
                    className="w-8 shrink-0 text-center text-[1.5rem] leading-none text-blush tabular-nums"
                  >
                    {String(momento.n).padStart(2, "0")}
                  </span>

                  <span aria-hidden className="hidden w-px bg-creme/16 sm:block" />

                  <div className="min-w-0">
                    <span className="text-[0.75rem] font-medium tracking-wide text-creme/60 tabular-nums">
                      {momento.hora}
                    </span>
                    <span className="display mt-1 block text-[1.0625rem] leading-snug text-creme">
                      {momento.titulo}
                    </span>
                    <span className="mt-1.5 block text-[0.8125rem] leading-relaxed text-creme/60">
                      {momento.foco}
                    </span>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        ))}

        {/* CTA final — mesmo fluxo de inscrição da navbar/hero (gate de fase intacto) */}
        <Reveal>
          <div className="mt-14 text-center sm:mt-16">
            <button
              onClick={abrirModal}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-rosa px-8 py-4 text-[0.9375rem] font-medium text-creme transition-all duration-300 hover:bg-rosa-escuro hover:shadow-[0_12px_40px_-12px_rgba(196,126,138,0.7)]"
            >
              Quero garantir o meu lugar
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}