'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: 'grid' },
  { href: '/plan', label: 'Plan', icon: 'clock' },
  { href: '/transacciones', label: 'Agregar', icon: 'plus', isFab: true },
  { href: '/aprende', label: 'Aprende', icon: 'trend' },
  { href: '/cuenta', label: 'Cuenta', icon: 'user' },
]

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? '#2563EB' : '#94A3B8'

  const icons: Record<string, JSX.Element> = {
    grid: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
        <rect x="11" y="3" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
        <rect x="3" y="11" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
        <rect x="11" y="11" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5"/>
      </svg>
    ),
    clock: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5"/>
        <path d="M10 6v4l2.5 2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    plus: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 5v12M5 11h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    trend: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 14l4-4 3 3 7-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13 6h4v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
      background: 'white', borderTop: '0.5px solid #E2E8F0',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
        padding: '6px 8px 8px',
      }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href

          if (item.isFab) {
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, textDecoration: 'none', marginTop: -16,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: '#2563EB', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(37,99,235,.35)',
                }}>
                  <NavIcon icon={item.icon} active={false} />
                </div>
                <span style={{ fontSize: 9, color: '#64748B', fontWeight: 500 }}>
                  {item.label}
                </span>
              </Link>
            )
          }

          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, textDecoration: 'none', minWidth: 48,
            }}>
              <NavIcon icon={item.icon} active={active} />
              <span style={{
                fontSize: 9, fontWeight: 500,
                color: active ? '#2563EB' : '#94A3B8',
              }}>
                {item.label}
              </span>
              {active && (
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: '#2563EB', marginTop: -1,
                }} />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
