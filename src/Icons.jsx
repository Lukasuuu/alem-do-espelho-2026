const Icon = ({ name, className = 'w-6 h-6', ...props }) => {
  const icons = {
    ArrowUpRight: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M7 17L17 7" />
        <path d="M7 7h10v10" />
      </svg>
    ),
    Sparkle: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      </svg>
    ),
    Mirror: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <ellipse cx="12" cy="10" rx="6" ry="7.5" />
        <path d="M12 17.5v4" />
        <path d="M9 21.5h6" />
      </svg>
    ),
    Users: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
        <circle cx="10" cy="7" r="3.2" />
        <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
        <path d="M15.5 4.2a3.2 3.2 0 0 1 0 6.2" />
      </svg>
    ),
    Heart: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 20.3l-1.3-1.2C6.1 14.9 3.2 12.3 3.2 9.1 3.2 6.6 5.2 4.6 7.7 4.6c1.4 0 2.8.7 3.7 1.8h1.2c.9-1.1 2.3-1.8 3.7-1.8 2.5 0 4.5 2 4.5 4.5 0 3.2-2.9 5.8-7.5 10z" />
      </svg>
    ),
    Globe: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
      </svg>
    ),
    Check: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 12.5l5 5L20 6.5" />
      </svg>
    ),
    Violin: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14 3l-2.5 2.5" />
        <path d="M9.5 8.5a4 4 0 1 0-3 6.8c1 1.6 3.4 2 5-.2a4 4 0 0 0 .3-5.4z" />
        <path d="M11 6.5l6.5-3.5" />
      </svg>
    ),
    Ballet: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="4.5" r="2" />
        <path d="M12 6.5v6" />
        <path d="M12 12.5l-4 8" />
        <path d="M12 12.5l4 8" />
        <path d="M7 9h10" />
      </svg>
    ),
    Brush: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M15 4l5 5-8.5 8.5a3 3 0 0 1-4.2 0 3 3 0 0 1 0-4.2z" />
        <path d="M6.5 17.5c-1.5 1.5-1 3.5-3.5 4 1-2 .5-3 2-4" />
      </svg>
    ),
    Clock: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
    Menu: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    ),
    X: (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      </svg>
    ),
  };
  return icons[name] || null;
};

window.Icons = { Icon };
