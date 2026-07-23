const { useState, useEffect, useRef } = React;
const { motion, AnimatePresence } = window.Motion;
const { Icon } = window.Icons;
const { PrimaryCTA } = window.CTA || {};

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('');
  const menuBtnRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Secção activa visível no viewport
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const sections = ['topo', 'projeto', 'anfitria', 'experiencia', 'angola', 'patrocinios', 'inscricao'];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const links = [
    { href: '#projeto', label: 'O Projeto' },
    { href: '#anfitria', label: 'A Anfitriã' },
    { href: '#experiencia', label: 'A Experiência' },
    { href: '#angola', label: 'Missão Angola' },
    { href: '#patrocinios', label: 'Patrocínios' },
  ];

  const linkClasses = (href) => {
    const id = href.replace('#', '');
    const isActive = active === id;
    return `px-3.5 py-2 text-sm font-body font-light tracking-wide transition-colors duration-200 border-b ${
      isActive
        ? 'text-dourado border-dourado'
        : 'text-papel/80 hover:text-papel border-transparent hover:border-dourado/60'
    }`;
  };

  return (
    <nav className={`fixed inset-x-0 z-50 px-4 md:px-8 transition-all duration-300 ${scrolled ? 'top-2' : 'top-4'}`}>
      <div
        className={`mx-auto max-w-7xl rounded-full flex items-center justify-between gap-6 pl-5 md:pl-6 pr-2 transition-all duration-300 ${
          scrolled
            ? 'glass-nav py-1.5'
            : 'bg-black/15 backdrop-blur-md border border-white/10 py-2'
        }`}
      >
        {/* Logótipo lockup */}
        <a href="#topo" aria-label="Essence of Beauty — início" className="shrink-0 focus-visible">
          <img
            src="public/assets/logo/eb-marca-papel.png"
            alt="Essence of Beauty"
            width="1180"
            height="453"
            className="h-9 md:h-12 w-auto object-contain"
          />
        </a>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={linkClasses(l.href)}>
              {l.label}
            </a>
          ))}
        </div>

        {/* CTA + menu mobile */}
        <div className="flex items-center gap-2">
          <PrimaryCTA>Garantir o meu lugar</PrimaryCTA>

          <button
            ref={menuBtnRef}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden rounded-full bg-papel/10 text-papel p-2.5 flex items-center justify-center focus-visible"
          >
            <Icon name={menuOpen ? 'X' : 'Menu'} className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-x-4 top-20 z-50 glass-panel rounded-[1.5rem] p-8 flex flex-col items-center gap-4"
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="text-lg font-body font-light text-papel/90 hover:text-papel focus-visible"
              >
                {l.label}
              </a>
            ))}
            <div onClick={() => setMenuOpen(false)} className="mt-2">
              <PrimaryCTA>Garantir o meu lugar</PrimaryCTA>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

window.Navbar = Navbar;
