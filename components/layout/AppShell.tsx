'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { isMasterUser } from '@/lib/master-user'
import { Wordmark } from '@/components/brand/Wordmark'
import { AppIcon } from '@/components/brand/AppIcon'
import { BottomNav } from '@/components/dashboard/BottomNav'
import {
  BarChart3, TrendingUp, Wallet, CreditCard, Target, Receipt,
  MessageCircle, BookOpen, Users, Settings,
  Menu, ArrowLeft, ShieldCheck, Trophy, Landmark, ClipboardCheck,
  ChevronRight,
} from 'lucide-react'

interface NavItem {
  href: string
  icon: typeof BarChart3
  label: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: BarChart3, label: 'Dashboard' },
      { href: '/resumen', icon: TrendingUp, label: 'Resumen' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/presupuesto', icon: Wallet, label: 'Presupuesto' },
      { href: '/metas', icon: Trophy, label: 'Metas' },
      { href: '/deudas', icon: CreditCard, label: 'Deudas' },
      { href: '/plan', icon: Target, label: 'Plan' },
      { href: '/mis-fuentes', icon: Landmark, label: 'Mis Fuentes' },
      { href: '/cierre-mes', icon: ClipboardCheck, label: 'Cierre de mes' },
    ],
  },
  {
    label: 'Actividad',
    items: [
      { href: '/transacciones', icon: Receipt, label: 'Transacciones' },
      { href: '/chat', icon: MessageCircle, label: 'Zafi AI' },
      { href: '/aprende', icon: BookOpen, label: 'Aprende' },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { href: '/familia', icon: Users, label: 'Familia' },
      { href: '/cuenta', icon: Settings, label: 'Cuenta' },
    ],
  },
]

const ADMIN_ITEM: NavItem = { href: '/admin', icon: ShieldCheck, label: 'Admin' }

interface AppShellProps {
  children: React.ReactNode
  title: string
  currentPath: string
  userName?: string
  userEmail?: string
  householdName?: string
  headerRight?: React.ReactNode
}

export function AppShell({ children, title, currentPath, userName = '', userEmail = '', householdName = '', headerRight }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMaster, setIsMaster] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (userEmail) {
      setIsMaster(isMasterUser(userEmail))
    } else {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }: { data: { user: { email?: string } | null } }) => {
        if (user?.email) setIsMaster(isMasterUser(user.email))
      })
    }
  }, [userEmail])

  const navGroups = isMaster
    ? NAV_GROUPS.map((g, i) =>
        i === NAV_GROUPS.length - 1
          ? { ...g, items: [...g.items, ADMIN_ITEM] }
          : g
      )
    : NAV_GROUPS

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--zafi-bg)' }}>
      {/* Mobile header */}
      <header
        className="lg:hidden sticky top-0 z-40 backdrop-blur-md border-b border-white/[0.08] px-4 py-3 flex items-center gap-3"
        style={{ background: 'var(--zafi-header)' }}
      >
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="w-5 h-5 text-white/60" />
        </button>
        <button onClick={() => router.back()} className="text-white/40 hover:text-white/70">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-body-sm font-semibold text-white flex-1">{title}</h1>
        <AppIcon size="xs" variant="electric" />
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen z-50 transform transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{
            width: 252,
            background: 'var(--zafi-sidebar)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '28px 18px 20px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Logo */}
            <Link href="/dashboard" onClick={() => setSidebarOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px 26px', textDecoration: 'none',
            }}>
              <AppIcon size="sm" variant="electric" />
              <Wordmark variant="dark" size="sm" />
            </Link>

            {/* Nav groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', flex: 1 }}>
              {navGroups.map((group) => (
                <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                    color: 'var(--zafi-sidebar-group)', padding: '0 12px 8px', textTransform: 'uppercase',
                  }}>
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const isActive = item.href === currentPath
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 11,
                          padding: '10px 12px', borderRadius: 10,
                          background: isActive ? 'var(--zafi-sidebar-active)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--zafi-sidebar-text)',
                          fontWeight: isActive ? 600 : 500,
                          fontSize: '14.5px', textDecoration: 'none',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                            e.currentTarget.style.color = '#E2E8F0'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--zafi-sidebar-text)'
                          }
                        }}
                      >
                        <item.icon style={{ width: 17, height: 17, flexShrink: 0 }} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* User footer */}
          {userName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '12px 28px', borderTop: `1px solid var(--zafi-sidebar-border)`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--zafi-sidebar-active)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13, color: '#fff',
                flexShrink: 0,
              }}>
                {userName[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userName}
                </div>
                {householdName && (
                  <div style={{ fontSize: '11.5px', color: 'var(--zafi-sidebar-group)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {householdName}
                  </div>
                )}
              </div>
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <ChevronRight style={{ width: 16, height: 16, color: 'var(--zafi-sidebar-group)' }} />
              </button>
            </div>
          )}
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Desktop header */}
          <div className="hidden lg:flex items-baseline justify-between" style={{ padding: '44px 52px 0' }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color: 'var(--zafi-text)', margin: 0 }}>
              {title}
            </h1>
            {headerRight}
          </div>
          <div className="lg:hidden">
            {/* Mobile content gets less padding */}
            <div className="p-4 pb-24">
              {children}
            </div>
          </div>
          <div className="hidden lg:block" style={{ padding: '8px 52px 60px' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <BottomNav />
    </div>
  )
}
