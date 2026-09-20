import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import { capitulos } from "@/lib/cronograma";
import { horarioEvento, site } from "@/lib/site";

/**
 * H.2 — Cronograma do Dia (Mapa do Dia público).
 *
 * Posição: entre o fecho da causa social ("Transformando mulheres em Portugal /
 * Impactando vidas em Angola") e a faixa REALIZAÇÃO · ORGANIZAÇÃO · APOIO.
 * NUNCA atrás de gate de fase — é informação do evento, não conversão: aparece
 * em todas as fases (ao contrário da vitrine de patrocinadores, gated).
 *
 * Conteúdo: SÓ o Mapa do Dia público (hora · experiência · foco) de
 * lib/cronograma.ts — nada do PDF interno (condução, pontes, "a confirmar").
 * Fundo = o mesmo vinho profundo do banner dos 3 pilares (.faixa-vinho),
 * para os dois blocos lerem como uma só narrativa. Dados do cabeçalho vêm
 * SEMPRE de lib/site.ts (fonte única), como no Cronograma G.1.
 *
 * Cartões: número grande à esquerda (rosa-suave, tabular-nums), separador
 * vertical, hora + título (Recline) + foco. 1 coluna em mobile; ≥lg em 2
 * colunas mantendo a ordem de leitura. CTA final reutiliza abrirModal
 * (o mesmo abrirFluxo gated da navbar/hero — nada de link novo).
 */

type Props = {
  abrirModal: () => void;
};

/** Cor do capítulo → token da marca (rosa nos pilares 1/3, verde no pilar 2). */
const COR_CAPITULO = {
  rosa: "text-rosa",
  verde: "text-sage",
} as const;

export default function MapaDia({ abrirModal }: Props) {
  return (
    <section
      id="cronograma"
      aria-label="Cronograma do dia do evento"
      className="faixa-vinho relative overflow-hidden py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Cabeçalho */}
        <Reveal>
          <div className="text-center">
            <span className="eyebrow text-rosa-suave">Além do Espelho 2026</span>
            <span className="eyebrow mt-2 block text-creme/45">O que vais viver no dia</span>
            <h2 className="display mt-5 text-[2.25rem] leading-[1.06] text-creme-neon sm:text-5xl">
              Cronograma do Dia
            </h2>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-creme/65 sm:text-[1rem]">
              {site.data.extenso} · {site.local.nome}, {site.local.cidade} · {horarioEvento()}
            </p>
          </div>
        </Reveal>

        {/* Capítulos — o fio condutor do banner dos 3 pilares */}
        {capitulos.map((capitulo, ci) => (
          <div key={capitulo.pergunta} className={ci === 0 ? "mt-14" : "mt-14 sm:mt-16"}>
            <Reveal>
              <h3
                className={`eyebrow flex items-center gap-3 ${COR_CAPITULO[capitulo.cor]}`}
              >
                <span aria-hidden className="h-px w-8 shrink-0 bg-current opacity-50" />
                {`Capítulo ${ci + 1} · ${capitulo.pergunta}`}
              </h3>
            </Reveal>

            <ul
              className={`grid gap-3 sm:gap-4 ${
                capitulo.cor === "verde" ? "mt-6 lg:grid-cols-2" : "mt-6"
              }`}
            >
              {capitulo.momentos.map((momento, mi) => (
                <Reveal
                  as="li"
                  key={momento.n}
                  delay={Math.min(mi * 0.05, 0.3)}
                  className="cartao-mapa flex items-stretch gap-4 rounded-2xl px-5 py-4 sm:gap-5 sm:px-6 sm:py-5"
                >
                  {/* Número do dia — tabular para alinhar a coluna */}
                  <span
                    aria-hidden
                    className="mt-0.5 w-8 shrink-0 text-[1.375rem] font-medium leading-none text-rosa-suave tabular-nums sm:w-10 sm:text-[1.625rem]"
                  >
                    {String(momento.n).padStart(2, "0")}
                  </span>

                  <span aria-hidden className="w-px shrink-0 bg-creme-neon/12" />

                  <div className="min-w-0">
                    <span className="text-[0.8125rem] font-medium tracking-wide text-creme/70 tabular-nums">
                      {momento.hora}
                    </span>
                    <span className="display mt-1 block text-[1.25rem] leading-snug text-creme-neon sm:text-[1.375rem]">
                      {momento.titulo}
                    </span>
                    <span className="mt-1.5 block text-[0.875rem] leading-relaxed text-creme/60">
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