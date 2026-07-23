const { motion } = window.Motion;

function Angola({ raisedPercent = 18 }) {
  return (
    <section id="angola" className="relative bg-tinta text-white py-28 px-6 md:px-16 lg:px-20">
      <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
        <div>
          <p className="text-sm font-body font-light tracking-[0.24em] uppercase text-white/70 mb-6">// Missão Angola</p>
          <h2 className="font-display font-light uppercase text-5xl md:text-6xl tracking-[0.05em]">
            500 gestos que atravessam o mar
          </h2>
          <p className="mt-6 text-base font-body font-light text-white/85 max-w-[52ch]">
            Milhares de meninas em Angola enfrentam dificuldades de acesso a produtos básicos de higiene feminina. Cada participante do Além do Espelho leva consigo um contributo — e todos juntos chegam a 250 mulheres.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {['Absorventes', 'Sabonetes', 'Escovas de dentes', 'Pasta dentífrica'].map((c) => (
              <span key={c} className="liquid-glass rounded-full px-4 py-2 text-sm font-body font-light">
                {c}
              </span>
            ))}
          </div>
        </div>

        <Reveal delay={0.15}>
          <div className="liquid-glass rounded-[1.5rem] p-8 md:p-10">
            <p className="font-body uppercase tracking-[0.22em] text-[11px] text-white/60">Meta de recolha</p>
            <p className="font-display font-light text-7xl md:text-8xl leading-none mt-3 tabular-nums">500</p>
            <p className="text-sm text-white/70 font-body font-light">itens · destino: comunidade feminina vulnerável em Angola</p>

            <div className="mt-8">
              <div className="h-1.5 w-full rounded-full bg-floresta border border-dourado/15">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-marsala to-rosa"
                  initial={{ width: '0%' }}
                  whileInView={{ width: `${raisedPercent}%` }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                />
              </div>
              <p className="mt-3 text-xs text-white/60">
                {raisedPercent}% recolhidos · atualizar manualmente antes de publicar
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-4">
              <img
                src="public/assets/ongpatrocinio.png"
                alt="Logo da ONG Atos"
                width="86"
                height="86"
                loading="lazy"
                className="h-14 w-14 object-contain rounded-lg bg-white p-1.5"
              />
              <div>
                <p className="text-sm font-body font-light text-white/80">Parceira social</p>
                <p className="font-display uppercase tracking-[0.08em] text-base text-white">ONG Atos</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

window.Angola = Angola;
