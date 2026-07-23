const { Icon } = window.Icons;

function ProjetoCard({ icon, title, tags, text, delay }) {
  return (
    <Reveal delay={delay}>
      <div className="glass-card rounded-[1.25rem] p-6 min-h-[360px] flex flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="bg-floresta/60 border border-dourado/25 w-11 h-11 rounded-[0.75rem] flex items-center justify-center shrink-0">
            <Icon name={icon} className="w-6 h-6 text-dourado" />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
            {tags.map((t) => (
              <span key={t} className="bg-papel/10 border border-papel/15 rounded-full px-3 py-1 text-[11px] text-papel/90 font-body font-light whitespace-nowrap">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <div className="mt-6">
          <h3 className="font-display font-light uppercase text-papel text-3xl md:text-4xl tracking-[0.05em] leading-none">
            {title}
          </h3>
          <p className="mt-3 text-sm text-papel/90 font-body font-light leading-relaxed max-w-[34ch]">
            {text}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

function Projeto() {
  return (
    <section id="projeto" className="relative min-h-screen bg-tinta overflow-hidden">
      {/* Background with crossfade */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <FadingImage
          sources={['public/assets/grupo.webp', 'public/assets/Grupo.png']}
          holdMs={5200}
          kenBurns={true}
          imgClassName="w-full h-full object-cover photo-tinted"
          className="absolute inset-0"
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-floresta/80 via-floresta/60 to-tinta/90" />
        <div className="absolute inset-0 z-20 bg-marsala/15 mix-blend-overlay" />
      </div>

      <div className="relative z-30 px-8 md:px-16 lg:px-20 pt-28 pb-16 flex flex-col min-h-screen">
        <div className="mb-auto">
          <p className="text-sm font-body font-light tracking-[0.24em] uppercase text-dourado/75 mb-6">// O Projeto</p>
          <h2 className="font-display font-light uppercase text-papel text-6xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-[0.04em]">
            Beleza que
            <br />
            começa por dentro
          </h2>
          <p className="mt-8 max-w-2xl text-base text-papel/85 font-body font-light leading-relaxed">
            O Além do Espelho é um projeto do Essence of Beauty que desenvolve mulheres por dentro para que revelem a sua melhor versão por fora. Nasceu para ajudar cada mulher a reencontrar a sua identidade e cresceu até se tornar uma rede de mulheres que ajudam mulheres.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <ProjetoCard
            icon="Mirror"
            title="Identidade"
            tags={['Autoestima', 'Autoconhecimento', 'Imagem', 'Voz']}
            text="Antes da imagem vem a identidade. Trabalhamos quem a mulher é, para que aquilo que ela mostra ao mundo seja coerente com a sua verdadeira essência."
            delay={0}
          />
          <ProjetoCard
            icon="Users"
            title="Conexão"
            tags={['Networking', 'Painéis', 'Mentoria', 'Comunidade']}
            text="Uma sala com 100 mulheres que se escutam. Palestras, painéis e dinâmicas que transformam desconhecidas numa rede de apoio real."
            delay={0.12}
          />
          <ProjetoCard
            icon="Globe"
            title="Propósito"
            tags={['ONG Atos', 'Angola', '500 produtos', 'Impacto']}
            text="Cada inscrição alimenta a recolha de produtos de higiene feminina enviados para mulheres em situação de vulnerabilidade em Angola."
            delay={0.24}
          />
        </div>
      </div>
    </section>
  );
}

window.Projeto = Projeto;
