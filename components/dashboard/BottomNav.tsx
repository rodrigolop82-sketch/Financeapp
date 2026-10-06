'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, List, Plus, Wallet, MoreHorizontal } from 'lucide-react'
import { activeTabFor, type TabKey } from '@/lib/navigation'

const TABS: { key: TabKey; href: string; label: string; icon: typeof Home }[] = [
  { key: 'inicio', href: '/dashboard', label: 'Inicio', icon: Home },
  { key: 'movimientos', href: '/transacciones', label: 'Movimientos', icon: List },
  { key: 'plan', href: '/plan', label: 'Plan', icon: Wallet },
  { key: 'mas', href: '/mas', label: 'Más', icon: MoreHorizontal },
]

/** Abre la hoja global de agregar (components/add/AddSheet). */
export function openAddSheet() {
  window.dispatchEvent(new CustomEvent('zafi:open-add'))
}

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
  const color = active ? 'var(--zafi-nav-active)' : 'var(--zafi-nav-inactive)'
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="flex flex-col items-center justify-center min-w-[60px] min-h-[44px] transition-transform duration-150 active:scale-90"
      style={{ gap: 3, textDecoration: 'none' }}
    >
      {/* La pestaña activa rebota al llegar (1 → .82 → 1.15 → 1). */}
      <Icon size={22} strokeWidth={1.7} color={color} aria-hidden className={active ? 'animate-bounce-tab' : undefined} />
      <span style={{ fontSize: 11, fontWeight: 600, color, transition: 'color .2s ease' }}>{label}</span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const activeTab = activeTabFor(pathname ?? '')
  const [inicio, movimientos, plan, mas] = TABS

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden flex justify-around items-center"
      style={{
        background: 'var(--zafi-bottomnav)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 10px calc(16px + env(safe-area-inset-bottom))',
      }}
    >
      <Tab {...inicio} active={activeTab === 'inicio'} />
      <Tab {...movimientos} active={activeTab === 'movimientos'} />
      <button
        type="button"
        aria-label="Agregar"
        onClick={openAddSheet}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-electric border-4 -mt-[26px] p-0 cursor-pointer transition-transform duration-200 ease-spring active:scale-[0.88] active:rotate-90"
        style={{
          borderColor: 'var(--zafi-bg)',
          boxShadow: '0 8px 20px rgba(37,99,235,0.45)',
        }}
      >
        <Plus size={24} strokeWidth={2.4} color="#FFFFFF" aria-hidden />
      </button>
      <Tab {...plan} active={activeTab === 'plan'} />
      <Tab {...mas} active={activeTab === 'mas'} />
    </nav>
  )
}
