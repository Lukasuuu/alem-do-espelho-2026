const { useState, useEffect, useRef, useCallback } = React;

function FadingImage({
  sources,
  holdMs = 5200,
  fadeMs = 500,
  className = '',
  imgClassName = '',
  kenBurns = true,
}) {
  const [indexA, setIndexA] = useState(0);
  const [indexB, setIndexB] = useState(1 % Math.max(sources.length, 1));
  const [active, setActive] = useState('a');
  const aRef = useRef(null);
  const bRef = useRef(null);
  const rafRef = useRef(null);
  const timeoutRef = useRef(null);
  const prefersReduced = useRef(false);

  const setOpacity = useCallback((el, value) => {
    if (el) el.style.opacity = String(value);
  }, []);

  const restartKenBurns = useCallback((el) => {
    if (!el || !kenBurns || prefersReduced.current) return;
    const inner = el.querySelector('.kb-inner');
    if (!inner) return;
    inner.classList.remove('kenburns');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inner.classList.add('kenburns');
      });
    });
  }, [kenBurns]);

  const fadeTo = useCallback((el, target, duration) => {
    if (!el) return;
    const start = parseFloat(el.style.opacity) || (target === 1 ? 0 : 1);
    const startTime = performance.now();
    cancelAnimationFrame(rafRef.current);

    const step = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      const value = start + (target - start) * p;
      setOpacity(el, value);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [setOpacity]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReduced.current = m.matches;
    const onChange = (e) => { prefersReduced.current = e.matches; };
    if (m.addEventListener) m.addEventListener('change', onChange);
    else m.addListener(onChange);
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', onChange);
      else m.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    if (sources.length <= 1) {
      if (aRef.current) {
        setOpacity(aRef.current, 1);
      }
      return;
    }

    if (prefersReduced.current) {
      setOpacity(aRef.current, 1);
      setOpacity(bRef.current, 0);
      return;
    }

    // preload next image
    const preload = (idx) => {
      const img = new Image();
      img.src = sources[idx];
    };

    const tick = () => {
      const nextActive = active === 'a' ? 'b' : 'a';
      const elActive = active === 'a' ? aRef.current : bRef.current;
      const elNext = nextActive === 'a' ? aRef.current : bRef.current;

      fadeTo(elActive, 0, fadeMs);
      fadeTo(elNext, 1, fadeMs);

      timeoutRef.current = setTimeout(() => {
        setActive(nextActive);
        const nextIdx = (sources.indexOf(sources[nextActive === 'a' ? indexA : indexB]) + 2) % sources.length;
        if (nextActive === 'a') setIndexA(nextIdx);
        else setIndexB(nextIdx);
        preload(nextIdx);
        restartKenBurns(nextActive === 'a' ? aRef.current : bRef.current);
        timeoutRef.current = setTimeout(tick, holdMs);
      }, fadeMs);
    };

    timeoutRef.current = setTimeout(tick, holdMs);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [sources, holdMs, fadeMs, active, indexA, indexB, fadeTo, restartKenBurns, setOpacity]);

  const renderLayer = (src, ref, z, key) => {
    const isA = key === 'layer-a';
    const visible = (isA && active === 'a') || (!isA && active === 'b');
    return (
      <div key={key} ref={ref} className="absolute inset-0" style={{ opacity: visible ? 1 : 0, zIndex: z }}>
        <div className={`absolute inset-0 ${kenBurns ? 'kb-inner' : ''}`}>
          <img
            src={src}
            alt=""
            loading={isA ? 'eager' : 'lazy'}
            decoding="async"
            className={imgClassName}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {renderLayer(sources[indexA], aRef, active === 'a' ? 2 : 1, 'layer-a')}
      {sources.length > 1 && renderLayer(sources[indexB], bRef, active === 'b' ? 2 : 1, 'layer-b')}
    </div>
  );
}

window.FadingImage = FadingImage;
