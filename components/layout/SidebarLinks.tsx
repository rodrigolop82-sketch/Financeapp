'use client'

// Enlaces del menú lateral (escritorio): los usa AppShell y el esqueleto de
// carga, así el menú se ve desde el primer instante (C16).

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, Wallet, TrendingUp, MessageCircle, BookOpen, Landmark, Settings } from 'lucide-react'
import { SIDEBAR_GROUPS, sidebarActiveHref, type SidebarIcon } from '@/lib/navigation'
import { Wordmark } from '@/components/brand/Wordmark'
import { AppIcon } from '@/components/brand/AppIcon'

export interface NavItem {
  href: string
  icon: typeof Home
  label: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const ICONS: Record<SidebarIcon, typeof Home> = {
  inicio: Home,
  movimientos: List,
  plan: Wallet,
  resumen: TrendingUp,
  chat: MessageCircle,
  aprende: BookOpen,
  cuentas: Landmark,
  cuenta: Settings,
}

// Menú de 8 entradas (lib/navigation.ts). Salud financiera y Cerrar el mes
// viven en Cómo te fue; Familia y Enviar idea, en Cuenta.
export const NAV_GROUPS: NavGroup[] = SIDEBAR_GROUPS.map((g) => ({
  label: g.label,
  items: g.items.map((i) => ({ href: i.href, label: i.label, icon: ICONS[i.icon] })),
}))

export function SidebarLinks({ groups, activeHref }: { groups: NavGroup[]; activeHref: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
      {groups.map((group) => (
        <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            color: 'var(--zafi-sidebar-group)', padding: '0 12px 4px', textTransform: 'uppercase',
          }}>
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = item.href === activeHref
            const style: React.CSSProperties = {
              display: 'flex', alignItems: 'center', gap: 11, width: '100%',
              padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: isActive ? 'var(--zafi-sidebar-active)' : 'transparent',
              color: isActive ? '#fff' : 'var(--zafi-sidebar-text)',
              fontWeight: isActive ? 600 : 500,
              fontSize: '14.5px', textDecoration: 'none', textAlign: 'left',
              transition: 'background 0.15s, color 0.15s',
            }
            const hover = {
              onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = '#E2E8F0'
                }
              },
              onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--zafi-sidebar-text)'
                }
              },
            }
            const body = (
              <>
                <item.icon style={{ width: 17, height: 17, flexShrink: 0 }} />
                {item.label}
              </>
            )
            return (
              <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined} style={style} {...hover}>
                {body}
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Menú lateral mientras carga la página: logo y enlaces reales (sin datos). */
export function SidebarSkeleton() {
  const pathname = usePathname() ?? ''
  return (
    <aside
      className="hidden lg:flex lg:sticky top-0 left-0 h-screen z-50"
      style={{ width: 252, background: 'var(--zafi-sidebar)', flexDirection: 'column', flexShrink: 0 }}
    >
      <div style={{ padding: '22px 18px 12px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 16px', textDecoration: 'none' }}>
          <AppIcon size="sm" variant="electric" />
          <Wordmark variant="dark" size="sm" />
        </Link>
        <div aria-hidden className="zafi-skel animate-shimmer" style={{ height: 44, borderRadius: 14, marginBottom: 16, opacity: 0.4 }} />
        <SidebarLinks groups={NAV_GROUPS} activeHref={sidebarActiveHref(pathname)} />
      </div>
    </aside>
  )
}
