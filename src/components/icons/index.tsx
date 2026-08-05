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

/**
 * Ícones transparentes dos métodos de pagamento (FASE4): contorno fino,
 * herdam currentColor, sem preenchimento — consistentes com os restantes.
 */

export function SumUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Terminal de pagamento SumUp */}
      <rect x="4" y="3.5" width="16" height="12" rx="2.5" />
      <path d="M7.5 8h9" />
      <path d="M9.5 11.5h5" />
      <path d="M8.5 19h7" />
      <path d="M12 15.5V19" />
    </svg>
  );
}

export function MbWayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Telemóvel com sinal de pagamento */}
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 17.5h2" />
      <path d="M15.5 9a2.5 2.5 0 0 1 0 4" />
      <path d="M17.5 7a5 5 0 0 1 0 8" />
    </svg>
  );
}

export function TransferenciaIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Edifício de banco, transferência */}
      <path d="M4.5 10.5 12 5l7.5 5.5" />
      <path d="M6 10.5V19h12v-8.5" />
      <path d="M9.5 10.5V19M14.5 10.5V19" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Globo terrestre — multi-plataforma de pagamento */}
      <circle cx="12" cy="12" r="9.5" />
      <ellipse cx="12" cy="12" rx="4" ry="9.5" />
      <path d="M2.5 12h19" />
      <path d="M4.5 7h15" />
      <path d="M4.5 17h15" />
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
