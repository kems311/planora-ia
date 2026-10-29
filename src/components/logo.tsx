export function Logo({ compact = false }: { compact?: boolean }) {
  return <span className="brand">
    <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-label="Planora-IA">
      <path d="M5 25V7h11c6 0 10 3.2 10 8s-4 8-10 8h-5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 13h7M11 18h5" stroke="#ef7d22" strokeWidth="3" strokeLinecap="round"/>
    </svg>
    {!compact && <span>Planora-IA</span>}
  </span>
}
