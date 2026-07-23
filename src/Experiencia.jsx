const { Icon } = window.Icons;
const { motion } = window.Motion;

function Experiencia() {
  const programacao = [
    'Receção e networking',
    'Abertura artística',
    'Palestras inspiradoras',
    'Dinâmicas de desenvolvimento pessoal',
    'Painéis de mulheres inspiradoras',
    'Momentos de conexão',
    'Apresentação da missão social',
    'Encerramento',
  ];

  const especiais = [
    { icon: 'Violin', title: 'Música ao vivo', subtitle: 'Violino' },
    { icon: 'Ballet', title: 'Bailarina clássica', subtitle: 'Performance' },
    { icon: 'Brush', title: 'Pintura ao vivo', subtitle: 'Obra criada no dia' },
  ];

  return (
    <section id="experiencia" className="relative bg-papel text-floresta py-28 px-6 md:px-16 lg:px-20">
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-body font-light tracking-[0.24em] uppercase text-salvia mb-6">// A Experiência</p>
        <h2 className="font-display font-light uppercase text-5xl md:text-7xl tracking-[0.05em]">
          Um dia, oito momentos
        </h2>

        {/* Cronologia */}
        <div className="mt-14 max-w-3xl">
          {programacao.map((item, i) => (
            <Reveal key={item} delay={i * 0.06}>
              <div className="grid grid-cols-[auto_1fr] gap-6 items-baseline py-5 border-b border-floresta/10">
                <span className="font-display text-2xl text-marsala/70 tabular-nums w-10">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-body font-normal text-lg tracking-wide">{item}</span>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Experiências especiais */}
        <div className="mt-16">
          <p className="text-xs font-body font-light uppercase tracking-[0.24em] text-salvia mb-6">Experiências especiais</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {especiais.map((e, i) => (
              <Reveal key={e.title} delay={i * 0.08}>
                <div className="liquid-glass-dark rounded-[1.25rem] p-6 text-center">
                  <div className="flex justify-center">
                    <Icon name={e.icon} className="h-6 w-6 text-marsala" />
                  </div>
                  <h3 className="mt-4 font-display uppercase text-xl tracking-[0.06em]">{e.title}</h3>
                  <p className="mt-1 text-xs font-body font-light uppercase tracking-[0.18em] text-floresta/55">{e.subtitle}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

window.Experiencia = Experiencia;
