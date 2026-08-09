'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: 'grid' },
  { href: '/metas', label: 'Metas', icon: 'target' },
  { href: '/resumen', label: 'Resumen', icon: 'chart' },
  { href: '/cuenta', label: 'Cuenta', icon: 'user' },
]

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? 'var(--zafi-nav-active)' : 'var(--zafi-nav-inactive)'

  const icons: Record<string, React.ReactNode> = {
    grid: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
        <rect x="11" y="3" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
        <rect x="3" y="11" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
        <rect x="11" y="11" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
      </svg>
    ),
    target: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5"/>
        <circle cx="10" cy="10" r="4" stroke={color} strokeWidth="1.5"/>
        <circle cx="10" cy="10" r="1.5" fill={color}/>
      </svg>
    ),
    chart: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="11" width="3" height="6" rx="1" stroke={color} strokeWidth="1.5"/>
        <rect x="8.5" y="7" width="3" height="10" rx="1" stroke={color} strokeWidth="1.5"/>
        <rect x="14" y="3" width="3" height="14" rx="1" stroke={color} strokeWidth="1.5"/>
      </svg>
    ),
    user: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3" stroke={color} strokeWidth="1.5"/>
        <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  }

  return icons[icon] ?? null
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="lg:hidden" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: 'var(--zafi-bottomnav)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
        padding: '6px 8px 8px',
      }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', minWidth: 48 }}>
              <NavIcon icon={item.icon} active={active} />
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: active ? 'var(--zafi-nav-active)' : 'var(--zafi-nav-inactive)',
                letterSpacing: '0.02em',
              }}>
                {item.label}
              </span>
              {active && (
                <div style={{
                  width: 20, height: 2, borderRadius: 9999,
                  background: 'var(--zafi-nav-active)', marginTop: -1,
                }} />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
