const { useRef, useEffect, useCallback } = React;
const { motion } = window.Motion;
const { PrimaryCTA, SponsorCTA } = window.CTA || {};

function Hero() {
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: 'easeOut' },
  });

  return (
    <section id="topo" className="relative min-h-screen w-full overflow-hidden bg-tinta flex flex-col">
      {/* Hero photography — preserved exactly, no heavy filters */}
      <picture className="absolute inset-0 z-0">
        <source srcSet="public/assets/evento.webp" type="image/webp" />
        <img
          src="public/assets/evento.jpeg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-center"
        />
      </picture>

      {/* Minimal vignette only for legibility */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-0 inset-x-0 h-[24%] bg-gradient-to-b from-black/55 via-black/15 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-[34%] bg-gradient-to-t from-black/60 via-black/16 to-transparent" />
        <div className="absolute inset-0 bg-radial-vignette" />
      </div>

      {/* Content */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 pt-32 pb-20 md:pt-28 md:pb-24 text-center">
        {/* Date pill */}
        <motion.div
          {...fadeUp(0.3)}
          className="flex items-center gap-3 mb-6 md:mb-8"
        >
          <span className="bg-papel text-tinta px-3 py-1 text-[11px] font-body font-semibold rounded-full tracking-wide">
            2ª edição
          </span>
          <span className="text-xs md:text-sm font-body font-light text-white/90 tracking-wide">
            17 de Outubro de 2026 · INNSiDE by Meliá, Braga
          </span>
        </motion.div>

        {/* Main title — photo reveals through the letters */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
          className="pointer-events-none"
        >
          <h2 key="hero-title-mobile" className="hero-title md:hidden" aria-hidden="true">
            Além<br />de<br />Mim!
          </h2>
          <h2 key="hero-title-desktop" className="hero-title hidden md:block" aria-hidden="true">
            Além<br />de<br />Mim!
          </h2>
        </motion.div>

        {/* Hidden h1 for SEO / screen readers */}
        <h1 className="sr-only">Além do Espelho 2026 — Além de Mim!</h1>

        {/* Bottom seal + subtitle + CTAs */}
        <motion.div
          {...fadeUp(0.9)}
          className="flex flex-col items-center gap-5 mt-12 md:mt-20"
        >
          <div className="hero-seal">
            <span className="hero-seal-line" />
            <span className="hero-seal-ornament" />
            <span className="hero-seal-line" />
          </div>
          <p className="hero-eyebrow mb-0">Além do Espelho 2026</p>

          {/* CTAs — luxury primary + sponsor pair */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-7 mt-4 md:mt-6">
            <PrimaryCTA href="#inscricao" id="hero-primary-cta">
              Garantir o meu lugar
            </PrimaryCTA>
            <SponsorCTA />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

window.Hero = Hero;
