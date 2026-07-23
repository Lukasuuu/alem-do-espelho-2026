const { useEffect, useState, useRef } = React;
const { motion, useMotionValue, useTransform, animate } = window.Motion;

function AnimatedNumber({ value, suffix = '', prefix = '' }) {
  const nodeRef = useRef(null);
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(prefix + '0' + suffix);
  const reduced = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  useEffect(() => {
    if (reduced) {
      setDisplay(prefix + value + suffix);
      return;
    }
    const unsubscribe = motionValue.on('change', (latest) => {
      setDisplay(prefix + Math.round(latest).toLocaleString('pt-PT') + suffix);
    });
    return () => unsubscribe();
  }, [motionValue, value, suffix, prefix, reduced]);

  return (
    <motion.span
      ref={nodeRef}
      onViewportEnter={() => {
        if (!reduced) {
          animate(motionValue, value, { duration: 1.6, ease: 'easeOut' });
        }
      }}
      viewport={{ once: true, amount: 0.5 }}
      className="font-display font-light text-5xl md:text-6xl tabular-nums text-dourado"
    >
      {display}
    </motion.span>
  );
}

function Metas() {
  const social = [
    { value: 100, label: 'Mulheres transformadas' },
    { value: 500, label: 'Produtos arrecadados' },
    { value: 250, label: 'Mulheres beneficiadas em Angola' },
  ];
  const empresarial = [
    { value: 12, label: 'Patrocinadores' },
    { value: 20, label: 'Empresas apoiadoras' },
    { value: 50000, label: 'Alcance digital', suffix: '+' },
  ];

  return (
    <section className="relative bg-floresta text-papel py-24 px-6 md:px-16 lg:px-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-center font-display font-light uppercase text-4xl md:text-5xl tracking-[0.06em] text-papel">
          Metas do projeto
        </h2>

        <div className="mt-14 rounded-[1.25rem] overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-dourado/20">
            {[...social, ...empresarial].map((m) => (
              <div key={m.label} className="bg-tinta p-8 text-center">
                <AnimatedNumber value={m.value} suffix={m.suffix || ''} />
                <p className="mt-3 text-xs font-body font-light uppercase tracking-[0.18em] text-papel/60">
                  {m.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

window.Metas = Metas;
