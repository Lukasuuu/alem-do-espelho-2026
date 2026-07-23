function Anfitria() {
  return (
    <section id="anfitria" className="relative bg-papel text-floresta py-28 px-6 md:px-16 lg:px-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
        {/* Portrait */}
        <div className="lg:col-span-5">
          <Reveal delay={0}>
            <div className="relative">
              <div className="absolute -inset-3 rounded-[1.75rem] border border-marsala/25" />
              <div className="absolute -inset-6 rounded-[2rem] border border-dourado/20" />
              <picture className="relative block rounded-[1.5rem] overflow-hidden">
                <source srcSet="public/assets/Vitoria.webp" type="image/webp" />
                <img
                  src="public/assets/Vitoria.jpg"
                  alt="Vitória Gomes, fundadora do Essence of Beauty"
                  width="1365"
                  height="2048"
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-[2/3] object-cover"
                />
              </picture>
            </div>
          </Reveal>
        </div>

        {/* Text */}
        <div className="lg:col-span-7">
          <p className="font-body uppercase tracking-[0.24em] text-[11px] text-salvia">Conheça a anfitriã</p>
          <h2 className="font-display font-light uppercase text-5xl md:text-6xl tracking-[0.05em] mt-4 text-floresta">
            Vitória Gomes
          </h2>
          <div className="w-24 h-px bg-marsala mt-5" />
          <p className="mt-4 text-sm font-body font-light text-floresta/70">
            Empresária · Escritora · Beauty Stylist · Ativista Social Feminina
            <br />
            CEO e Fundadora do Essence of Beauty
          </p>

          <div className="mt-8 space-y-4 text-base font-body font-light leading-relaxed text-floresta/85 max-w-[62ch]">
            <p>Acredito que toda a mulher possui uma força extraordinária dentro de si, mas muitas vezes precisa de reencontrar a sua identidade para florescer.</p>
            <p>Há mais de uma década que me dedico à transformação feminina através da beleza, da imagem, do desenvolvimento pessoal e da valorização da autoestima.</p>
            <p>Como empresária, escritora e ativista social, a minha missão é ajudar mulheres a reconhecerem o seu valor, a fortalecerem a sua voz e a assumirem o protagonismo das suas próprias histórias.</p>
          </div>

          <blockquote className="mt-10 pl-6 border-l-2 border-marsala font-script text-3xl md:text-4xl text-marsala leading-snug">
            Quando uma mulher descobre quem realmente é, ela transforma tudo ao seu redor.
          </blockquote>
        </div>
      </div>
    </section>
  );
}

window.Anfitria = Anfitria;
