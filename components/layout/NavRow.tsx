import Link from 'next/link'

interface NavRowProps {
  href: string
  emoji: string
  name: string
  description: string
  /** La última fila de una tarjeta no lleva divisor. */
  last?: boolean
}

/** Fila de navegación de 58px: emoji, nombre, descripción y chevron. */
export function NavRow({ href, emoji, name, description, last }: NavRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 h-[58px] no-underline transition-colors hover:bg-[var(--zafi-hover)]"
      style={{ borderBottom: last ? 'none' : '1px solid var(--zafi-border-light)' }}
    >
      <span aria-hidden className="w-6 text-center" style={{ fontSize: 19 }}>{emoji}</span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="truncate text-ink-900 dark:text-ink-100" style={{ fontSize: 15, fontWeight: 600 }}>{name}</span>
        <span className="truncate" style={{ fontSize: 12.5, color: 'var(--zafi-text-secondary)' }}>{description}</span>
      </span>
      <span aria-hidden style={{ fontSize: 18, color: 'var(--zafi-text-muted)' }}>›</span>
    </Link>
  )
}

/** Tarjeta blanca que agrupa filas de navegación. */
export function NavCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden border border-navy/[0.08] dark:border-white/[0.06]"
      style={{ background: 'var(--zafi-card)', borderRadius: 16 }}
    >
      {children}
    </div>
  )
}
