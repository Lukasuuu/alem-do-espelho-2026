const { Icon } = window.Icons;

function Plano({ name, price, vagas, accent, benefits, destacado, plano, delay }) {
  const accentClasses = {
    salvia: 'text-salvia border-salvia',
    floresta: 'text-floresta border-floresta',
    dourado: 'text-dourado border-dourado',
  };

  const [main] = accentClasses[accent].split(' ');
  const border = accentClasses[accent].split(' ')[1];

  return (
    <Reveal delay={delay}>
      <div className={`liquid-glass-dark rounded-[1.5rem] p-8 flex flex-col ${destacado ? 'ring-1 ring-dourado/50 md:-translate-y-4' : ''}`}>
        {destacado && (
          <div className="mb-4">
            <span className="inline-block bg-marsala text-papel text-[10px] font-body uppercase tracking-[0.16em] rounded-full px-3 py-1">Mais procurado</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className={`font-display font-light uppercase text-3xl tracking-[0.08em] ${main}`}>{name}</h3>
          <span className="liquid-glass-dark rounded-full px-3 py-1 text-[11px] font-body uppercase tracking-[0.16em]">{vagas}</span>
        </div>

        <div className="mt-6 font-display text-6xl font-light tabular-nums text-marsala">
          {price}
          <span className="align-super text-3xl">€</span>
        </div>

        <div className={`mt-6 h-px w-full ${border.replace('border-', 'bg-')}`} />

        <ul className="mt-6 space-y-3 text-sm font-body font-light text-floresta/80 flex-1">
          {benefits.map((b) => (
            <li key={b} className="flex gap-3">
              <Icon name="Check" className={`h-4 w-4 mt-0.5 shrink-0 ${main}`} />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <a
          href={`#inscricao?plano=${plano}`}
          className={`mt-8 w-full rounded-full py-3 text-sm font-body font-medium text-center block transition-colors focus-visible ${
            destacado
              ? 'bg-marsala text-papel hover:bg-floresta'
              : `border border-marsala/40 text-marsala hover:bg-marsala hover:text-papel`
          }`}
        >
          Quero este plano
        </a>
      </div>
    </Reveal>
  );
}

function Patrocinios() {
  return (
    <section id="patrocinios" className="relative bg-papel text-floresta py-28 px-6 md:px-16 lg:px-20">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-body font-light tracking-[0.24em] uppercase text-salvia mb-6">// Patrocínios</p>
        <h2 className="font-display font-light uppercase text-5xl md:text-7xl tracking-[0.05em]">
          Associe a sua marca a esta causa
        </h2>
        <p className="mt-6 max-w-2xl text-base font-body font-light text-floresta/75">
          Doze empresas vão estar ao lado de 100 mulheres em Braga e de 250 mulheres em Angola. As vagas são limitadas por categoria.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-16 items-stretch">
          <Plano
            name="Bronze"
            price="75"
            vagas="5 vagas"
            accent="salvia"
            plano="bronze"
            benefits={[
              'Exposição da marca nos materiais oficiais do evento',
              'Divulgação nas redes sociais do evento',
              'Espaço para networking com participantes e parceiros',
              'Associação à causa social do Além do Espelho 2026',
            ]}
            delay={0}
          />
          <Plano
            name="Prata"
            price="150"
            vagas="4 vagas"
            accent="floresta"
            plano="prata"
            benefits={[
              'Tudo o que o Bronze inclui, mais:',
              'Espaço de exposição durante o evento (stand, mesa ou ponto de divulgação)',
              'Destaque ampliado nas redes sociais',
              'Logomarca em posição de maior evidência nos materiais oficiais',
            ]}
            delay={0.12}
          />
          <Plano
            name="Ouro"
            price="200"
            vagas="3 vagas"
            accent="dourado"
            plano="ouro"
            destacado={true}
            benefits={[
              'Tudo o que o Prata inclui, mais:',
              'Fala institucional de até 5 minutos no palco principal',
              'Logomarca em destaque máximo em todos os materiais de divulgação',
              'Menção especial pelo mestre de cerimónias durante o evento',
              'Destaque como patrocinador oficial nas campanhas de divulgação',
              'Prioridade nas ações de relacionamento e networking',
            ]}
            delay={0.24}
          />
        </div>
      </div>
    </section>
  );
}

window.Patrocinios = Patrocinios;
