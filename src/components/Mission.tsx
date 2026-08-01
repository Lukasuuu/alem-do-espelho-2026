import Reveal from "./Reveal";

const metas = [
  { numero: "100", rotulo: "mulheres em Braga" },
  { numero: "500", rotulo: "produtos angariados" },
  { numero: "250", rotulo: "mulheres apoiadas em Angola" },
] as const;

export default function Mission() {
  return (
    <section className="relative overflow-hidden bg-sage py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,247,233,0.16),transparent_60%)]"
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-20">
          <Reveal>
            <span className="eyebrow text-creme/60">A missão</span>
            <h2 className="display mt-5 max-w-lg text-[2rem] leading-[1.1] text-creme sm:text-[2.5rem]">
              O teu lugar nesta sala também chega a Angola.
            </h2>
            <p className="mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-creme/75">
              Enquanto trabalhamos autoestima e identidade em Braga, angariamos produtos de
              higiene feminina para mulheres em situação de vulnerabilidade em Angola. Uma coisa
              não acontece sem a outra.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <dl className="flex flex-wrap gap-x-10 gap-y-7 lg:flex-col lg:gap-y-6">
              {metas.map((meta) => (
                <div key={meta.rotulo}>
                  <dt className="sr-only">{meta.rotulo}</dt>
                  <dd>
                    <span className="display block text-4xl text-creme tabular-nums sm:text-5xl">
                      {meta.numero}
                    </span>
                    <span className="mt-1.5 block max-w-[11rem] text-[0.8125rem] leading-snug text-creme/60">
                      {meta.rotulo}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
