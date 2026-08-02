/**
 * Ícones de marca como SVG inline, herdam `currentColor`, pelo que mudam de
 * cor com o texto no hover. Usados apenas como links para os respetivos perfis,
 * sempre monocromáticos e sem distorção.
 */

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.25" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.82c2.16 0 4.19.84 5.72 2.37a8.04 8.04 0 0 1 2.37 5.72c0 4.46-3.63 8.09-8.1 8.09a8.2 8.2 0 0 1-4.13-1.13l-.3-.18-3.07.81.82-3-.19-.31a8.04 8.04 0 0 1-1.24-4.3c0-4.46 3.63-8.09 8.1-8.09Z" />
      <path d="M9.35 7.13c-.18-.4-.36-.41-.53-.42l-.45-.01c-.16 0-.41.06-.63.29-.21.24-.82.8-.82 1.96s.84 2.27.96 2.43c.12.16 1.63 2.61 4.01 3.56 1.98.78 2.38.62 2.81.58.43-.04 1.39-.57 1.58-1.11.2-.55.2-1.01.14-1.11-.06-.1-.22-.16-.45-.28-.24-.12-1.4-.69-1.61-.77-.22-.08-.38-.12-.53.12-.16.24-.61.77-.75.93-.14.16-.28.18-.51.06-.24-.12-1-.37-1.9-1.17-.7-.63-1.18-1.4-1.31-1.64-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.53-1.29-.72-1.76Z" />
    </svg>
  );
}

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="4.75" width="19" height="14.5" rx="3" />
      <path d="M3.4 7.2 10.6 12a2.6 2.6 0 0 0 2.8 0l7.2-4.8" />
    </svg>
  );
}
