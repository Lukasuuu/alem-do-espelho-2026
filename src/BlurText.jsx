const { useState, useEffect, useRef } = React;
const { motion } = window.Motion;

function BlurText({ text, as: Tag = 'p', className = '', delay = 0 }) {
  const [start, setStart] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setStart(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStart(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const words = text.split(' ').filter(Boolean);

  const stepDuration = 0.35;
  const totalDuration = stepDuration * 2;

  return (
    <Tag
      ref={ref}
      className={`flex flex-wrap justify-center ${className}`}
      style={{ rowGap: '0.1em' }}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block"
          style={{ marginRight: '0.28em' }}
          initial={
            start
              ? { filter: 'blur(0px)', opacity: 1, y: 0 }
              : { filter: 'blur(10px)', opacity: 0, y: 50 }
          }
          animate={start ? {
            filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'],
            opacity: [0, 0.5, 1],
            y: [50, -5, 0],
          } : {}}
          transition={{
            duration: totalDuration,
            delay: delay + i * 0.1,
            times: [0, 0.5, 1],
            ease: 'easeOut',
          }}
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}

window.BlurText = BlurText;
