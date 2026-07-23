function Continentes() {
  return (
    <section className="relative bg-tinta text-white py-28 px-6 md:px-16 lg:px-20 overflow-hidden">
      <div className="absolute -right-40 top-1/4 w-[520px] h-[520px] rounded-full border border-dourado/15" />
      <div className="absolute -left-52 bottom-0 w-[420px] h-[420px] rounded-full border border-dourado/15" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <p className="text-center text-sm font-body font-light tracking-[0.24em] uppercase text-dourado/75 mb-6">// Nossa Missão</p>
        <h2 className="text-center font-display font-light uppercase text-5xl md:text-7xl tracking-[0.05em]">
          Transformar vidas em dois continentes
        </h2>

        <div className="grid md:grid-cols-2 gap-6 mt-16">
          <Reveal delay={0}>
            <div className="liquid-glass rounded-[1.25rem] p-8 md:p-10">
              <div className="flex items-center gap-4">
                <div className="w-1 h-6 bg-salvia" />
                <h3 className="font-display uppercase text-2xl tracking-[0.08em]">Em Portugal</h3>
              </div>
              <p className="mt-5 text-base font-body font-light text-white/85">
                Desenvolver e ligar <strong className="font-medium text-white">100 mulheres</strong> na cidade de Braga, num dia de imersão, palestras e networking.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="liquid-glass rounded-[1.25rem] p-8 md:p-10">
              <div className="flex items-center gap-4">
                <div className="w-1 h-6 bg-marsala" />
                <h3 className="font-display uppercase text-2xl tracking-[0.08em]">Em Angola</h3>
              </div>
              <p className="mt-5 text-base font-body font-light text-white/85">
                Recolher e enviar produtos de higiene feminina para <strong className="font-medium text-white">250 mulheres</strong> em situação de vulnerabilidade.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.24}>
          <div className="mt-10 liquid-glass rounded-full px-6 py-4 text-center text-sm font-body font-light text-white/80">
            O projeto nasce para gerar transformação local e impacto global.
          </div>
        </Reveal>
      </div>
    </section>
  );
}

window.Continentes = Continentes;
