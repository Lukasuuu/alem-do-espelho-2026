const { useRef, useEffect, useCallback } = React;
const { motion } = window.Motion;
const { Icon } = window.Icons;

/* ------------------------------------------------------------------
   Shared cursor spotlight hook — writes CSS variables, avoids re-render
   ------------------------------------------------------------------ */
function useSpotlight(ref, { damping = 0.12, active = true } = {}) {
  const rafRef = useRef(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);

  const setActive = useCallback((value) => {
    activeRef.current = value;
    if (!value && ref.current) {
      ref.current.style.setProperty('--spotlight-opacity', '0');
    }
  }, [ref]);

  const onMove = useCallback((e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    targetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, [ref]);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    const loop = () => {
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * damping;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * damping;

      if (el) {
        el.style.setProperty('--spotlight-x', `${currentRef.current.x.toFixed(1)}px`);
        el.style.setProperty('--spotlight-y', `${currentRef.current.y.toFixed(1)}px`);
        const opacity = activeRef.current
          ? Math.min(1, 0.25 + Math.hypot(currentRef.current.x - targetRef.current.x, currentRef.current.y - targetRef.current.y) / 120)
          : Math.max(0, currentRef.current.x === 0 ? 0 : 0.05);
        el.style.setProperty('--spotlight-opacity', opacity.toFixed(3));
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, damping, ref]);

  return { onMove, setActive };
}

/* ------------------------------------------------------------------
   PrimaryCTA — white luxury button
   ------------------------------------------------------------------ */
function PrimaryCTA({ href = '#inscricao', children, id, className = '' }) {
  const wrapperRef = useRef(null);
  const { onMove, setActive } = useSpotlight(wrapperRef, { damping: 0.14 });

  const handleEnter = useCallback(() => setActive(true), [setActive]);
  const handleLeave = useCallback(() => setActive(false), [setActive]);

  return (
    <motion.a
      id={id}
      ref={wrapperRef}
      href={href}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseMove={onMove}
      className={`group relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 md:px-6 py-2.5 md:py-3 text-sm font-body font-medium tracking-wide whitespace-nowrap bg-papel text-floresta focus-visible overflow-hidden transition-transform duration-300 ease-out shadow-[0_10px_42px_-12px_rgba(20,26,22,0.52),0_0_0_1px_rgba(194,177,129,0.28)_inset,0_2px_5px_-1px_rgba(255,255,255,0.45)_inset,0_0_24px_-8px_rgba(194,177,129,0.22)] hover:shadow-[0_18px_54px_-14px_rgba(20,26,22,0.58),0_0_0_1px_rgba(194,177,129,0.42)_inset,0_2px_6px_-1px_rgba(255,255,255,0.55)_inset,0_0_36px_-6px_rgba(194,177,129,0.32)] ${className}`}
      whileHover="hover"
      whileTap="tap"
      initial="initial"
      variants={{
        initial: { y: 0, scale: 1 },
        hover: { y: -2, scale: 1.02 },
        tap: { scale: 0.985 },
      }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Ambient golden bloom */}
      <motion.span
        className="pointer-events-none absolute -inset-5 rounded-full blur-3xl"
        style={{ background: 'rgba(194,177,129,0.35)' }}
        animate={{ opacity: [0.18, 0.32, 0.18] }}
        transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      />

      {/* Luxury shimmer sweep */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <motion.span
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0.75) 55%, transparent 100%)',
            backgroundSize: '40% 100%',
          }}
          initial={{ x: '-140%', opacity: 0 }}
          animate={{ x: ['-140%', '240%'], opacity: [0, 0.75, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 9.2, delay: 2.4, ease: 'easeInOut' }}
        />
      </span>

      {/* Glass reflection line at top */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/55 to-transparent rounded-full"
        aria-hidden="true"
      />

      {/* Inner bottom highlight */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(194,177,129,0.25), transparent)' }}
        aria-hidden="true"
      />

      {/* Cursor spotlight */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300"
        style={{
          opacity: 'var(--spotlight-opacity, 0)',
          background: 'radial-gradient(130px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(255,255,255,0.55), rgba(255,255,255,0.15) 55%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Hover golden tint */}
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-dourado/15 to-dourado/5"
        variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
        transition={{ duration: 0.3 }}
      />

      {/* Text + icon */}
      <motion.span
        className="relative z-10 flex items-center gap-2"
        variants={{
          initial: { filter: 'brightness(1)' },
          hover: { filter: 'brightness(1.08)' },
        }}
        transition={{ duration: 0.25 }}
      >
        {children}
        <motion.span
          variants={{ initial: { x: 0, y: 0 }, hover: { x: 1, y: -1 } }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <Icon name="ArrowUpRight" className="h-4 w-4" />
        </motion.span>
      </motion.span>
    </motion.a>
  );
}

/* ------------------------------------------------------------------
   SponsorCTA — premium transparent gold button
   ------------------------------------------------------------------ */
function SponsorCTA({ href = '#patrocinios', className = '' }) {
  const wrapperRef = useRef(null);
  const { onMove, setActive } = useSpotlight(wrapperRef, { damping: 0.12 });

  const handleEnter = useCallback(() => setActive(true), [setActive]);
  const handleLeave = useCallback(() => setActive(false), [setActive]);

  return (
    <motion.a
      ref={wrapperRef}
      href={href}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseMove={onMove}
      className={`group relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 md:px-6 py-2.5 md:py-3 text-sm font-body font-medium tracking-wide whitespace-nowrap bg-transparent text-papel/90 border border-dourado/55 shadow-[0_0_32px_-8px_rgba(194,177,129,0.35),0_0_0_1px_rgba(194,177,129,0.25)_inset,0_1px_1px_0_rgba(255,255,255,0.12)_inset] hover:border-dourado/90 hover:text-white hover:shadow-[0_0_50px_-6px_rgba(194,177,129,0.65),0_0_0_1px_rgba(194,177,129,0.45)_inset,0_1px_2px_0_rgba(255,255,255,0.18)_inset] focus-visible overflow-hidden transition-transform duration-300 ease-out ${className}`}
      whileHover="hover"
      whileTap="tap"
      initial="initial"
      variants={{
        initial: { y: 0, scale: 1 },
        hover: { y: -2, scale: 1.02 },
        tap: { scale: 0.985 },
      }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Ambient golden bloom */}
      <motion.span
        className="pointer-events-none absolute -inset-6 rounded-full blur-3xl bg-dourado/30"
        animate={{ opacity: [0.14, 0.28, 0.14] }}
        transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
      />

      {/* Floating ambient light */}
      <motion.span
        className="pointer-events-none absolute -inset-8 rounded-full blur-3xl bg-dourado/22"
        animate={{
          x: [0, 18, -10, 0],
          y: [0, -10, 8, 0],
          opacity: [0.08, 0.18, 0.08],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Rotating conic border glow */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0%, rgba(194,177,129,0.75) 22%, rgba(246,243,239,0.55) 48%, rgba(194,177,129,0.75) 78%, transparent 100%)',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        />
      </span>

      {/* Golden shimmer sweep */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <motion.span
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, transparent 0%, rgba(194,177,129,0.5) 45%, rgba(246,243,239,0.65) 55%, transparent 100%)',
            backgroundSize: '42% 100%',
            mixBlendMode: 'overlay',
          }}
          animate={{ x: ['-130%', '230%'], opacity: [0, 0.85, 0] }}
          transition={{ duration: 2.0, repeat: Infinity, repeatDelay: 8.0, delay: 0.8, ease: 'easeInOut' }}
        />
      </span>

      {/* Top glass reflection */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-dourado/60 to-transparent rounded-full"
        aria-hidden="true"
      />

      {/* Bottom gold highlight */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-dourado/50 to-transparent rounded-full"
        aria-hidden="true"
      />

      {/* Cursor spotlight */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300"
        style={{
          opacity: 'var(--spotlight-opacity, 0)',
          background:
            'radial-gradient(140px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(194,177,129,0.45), rgba(194,177,129,0.12) 55%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Hover golden tint */}
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full bg-dourado/18"
        variants={{ initial: { opacity: 0 }, hover: { opacity: 1 } }}
        transition={{ duration: 0.3 }}
      />

      {/* Text + sparkle */}
      <motion.span
        className="relative z-10 flex items-center gap-2"
        variants={{
          initial: { color: 'rgba(255, 255, 255, 0.95)', letterSpacing: '0.02em', filter: 'brightness(1)' },
          hover: { color: '#FFFFFF', letterSpacing: '0.06em', filter: 'brightness(1.12)' },
        }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        Quero patrocinar
        <span className="relative flex items-center">
          <motion.span
            variants={{ initial: { opacity: 0.9, rotate: 0 }, hover: { opacity: 1, rotate: 15 } }}
            transition={{ duration: 0.35 }}
          >
            <Icon name="Sparkle" className="w-4 h-4" />
          </motion.span>

          {/* Gold particles */}
          <motion.span
            className="absolute -top-1.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-dourado shadow-[0_0_6px_rgba(194,177,129,0.9)]"
            animate={{
              opacity: [0, 1, 0],
              scale: [0.2, 1.2, 0.2],
              y: [0, -14, -24],
              x: [0, 6, 12],
            }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.2, ease: 'easeOut' }}
          />
          <motion.span
            className="absolute -bottom-1.5 -right-2.5 w-1 h-1 rounded-full bg-dourado/95 shadow-[0_0_5px_rgba(194,177,129,0.85)]"
            animate={{
              opacity: [0, 0.9, 0],
              scale: [0.2, 1.1, 0.2],
              y: [0, 12, 22],
              x: [0, -5, -10],
            }}
            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.6, delay: 0.9, ease: 'easeOut' }}
          />
          <motion.span
            className="absolute top-0 -left-2.5 w-1 h-1 rounded-full bg-papel/90 shadow-[0_0_5px_rgba(246,243,239,0.8)]"
            animate={{
              opacity: [0, 0.85, 0],
              scale: [0.2, 1.1, 0.2],
              y: [0, -10, -18],
              x: [0, -6, -12],
            }}
            transition={{ duration: 2.9, repeat: Infinity, repeatDelay: 2.6, delay: 1.8, ease: 'easeOut' }}
          />
        </span>
      </motion.span>

      {/* Animated underline from center */}
      <span className="pointer-events-none absolute -bottom-1 left-0 right-0 h-px overflow-hidden">
        <motion.span
          className="absolute inset-y-0 left-1/2 bg-gradient-to-r from-transparent via-dourado to-transparent"
          variants={{
            initial: { width: 0, x: '-50%' },
            hover: { width: '100%', x: '-50%' },
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </span>
    </motion.a>
  );
}

window.CTA = { PrimaryCTA, SponsorCTA, useSpotlight };
