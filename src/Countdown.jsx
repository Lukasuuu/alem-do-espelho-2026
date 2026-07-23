const { useState, useEffect } = React;

function pad(n) {
  return String(n).padStart(2, '0');
}

function Countdown() {
  const target = new Date('2026-10-17T09:00:00+01:00');
  const [time, setTime] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
  const [reached, setReached] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) {
        setReached(true);
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const dias = Math.floor(totalSeconds / 86400);
      const horas = Math.floor((totalSeconds % 86400) / 3600);
      const minutos = Math.floor((totalSeconds % 3600) / 60);
      const segundos = totalSeconds % 60;
      setTime({ dias, horas, minutos, segundos });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  if (reached) {
    return (
      <div className="text-center">
        <p className="font-display uppercase tracking-[0.15em] text-white">O dia chegou.</p>
      </div>
    );
  }

  const blocks = [
    { value: time.dias, label: 'Dias' },
    { value: time.horas, label: 'Horas' },
    { value: time.minutos, label: 'Minutos' },
    { value: time.segundos, label: 'Segundos' },
  ];

  return (
    <div className="flex flex-wrap justify-center items-stretch gap-3 md:gap-4" aria-live="off">
      {blocks.map((b, i) => (
        <React.Fragment key={b.label}>
          <div className="liquid-glass rounded-[1rem] px-4 md:px-5 py-4 min-w-[78px] md:min-w-[92px] text-center">
            <div className="font-display font-light text-white text-4xl md:text-5xl leading-none tabular-nums">
              {pad(b.value)}
            </div>
            <div className="mt-2 font-body font-light uppercase tracking-[0.2em] text-[10px] text-white/70">
              {b.label}
            </div>
          </div>
          {i < blocks.length - 1 && (
            <div className="hidden sm:flex items-center text-white/30 text-2xl font-display">:</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

window.Countdown = Countdown;
