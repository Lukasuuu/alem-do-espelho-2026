function CountdownStrip() {
  return (
    <section className="relative z-40 px-6 lg:px-16 pt-10 pb-24 bg-tinta">
      <div className="liquid-glass-strong rounded-[1.75rem] px-8 py-10 max-w-5xl mx-auto">
        <p className="text-center font-body uppercase tracking-[0.28em] text-[11px] text-white/60 mb-6">Faltam</p>
        <Countdown />
        <p className="mt-8 text-center text-sm text-white/70 font-body font-light">
          Inscrições limitadas a 120 lugares · INNSiDE by Meliá Braga Centro
        </p>
      </div>
    </section>
  );
}

window.CountdownStrip = CountdownStrip;
