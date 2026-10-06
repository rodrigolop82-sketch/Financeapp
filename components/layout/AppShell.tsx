'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { isMasterUser } from '@/lib/master-user'
import { isRootPath, parentFor } from '@/lib/navigation'
import { Wordmark } from '@/components/brand/Wordmark'
import { AppIcon } from '@/components/brand/AppIcon'
import { BottomNav, openAddSheet } from '@/components/dashboard/BottomNav'
import { AddSheet } from '@/components/add/AddSheet'
import { PushOfferSheet } from '@/components/avisos/PushOfferSheet'
import { ScoreWatcher } from '@/components/score/ScoreWatcher'
import { signalAppReady } from '@/components/motion/Splash'
import { FeedbackSheet } from '@/components/feedback/FeedbackSheet'
import {
  Home, List, Wallet, TrendingUp, HeartPulse, ClipboardCheck,
  MessageCircle, BookOpen, Landmark, Users, Settings, ShieldCheck,
  ChevronLeft, Plus, Lightbulb, LogOut,
} from 'lucide-react'

interface NavItem {
  href: string
  icon: typeof Home
  label: string
  /** Acción en la misma página en vez de navegar (p. ej. la hoja de feedback). */
  action?: 'feedback'
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Mismos grupos que la página "Más" (lib/navigation.ts), más las pestañas principales.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: Home, label: 'Inicio' },
      { href: '/transacciones', icon: List, label: 'Movimientos' },
      { href: '/plan', icon: Wallet, label: 'Plan' },
    ],
  },
  {
    label: 'Tu dinero',
    items: [
      { href: '/resumen', icon: TrendingUp, label: 'Cómo te fue' },
      { href: '/score', icon: HeartPulse, label: 'Tu salud financiera' },
      { href: '/cierre-mes', icon: ClipboardCheck, label: 'Cerrar el mes' },
    ],
  },
  {
    label: 'Ayuda',
    items: [
      { href: '/chat', icon: MessageCircle, label: 'Pregúntale a Zafi' },
      { href: '/aprende', icon: BookOpen, label: 'Aprende' },
      { href: '#feedback', icon: Lightbulb, label: 'Envíanos tu idea', action: 'feedback' },
    ],
  },
  {
    label: 'Tu cuenta',
    items: [
      { href: '/mis-fuentes', icon: Landmark, label: 'Mis bancos' },
      { href: '/familia', icon: Users, label: 'Familia' },
      { href: '/cuenta', icon: Settings, label: 'Cuenta y privacidad' },
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
  /** En las pestañas raíz, en móvil: elemento a la derecha del título. */
  titleRight?: React.ReactNode
  /** En las pestañas raíz, en móvil: reemplaza el bloque del título. */
  mobileHeader?: React.ReactNode
  /** Fuera de las pestañas raíz, en móvil: la página pinta su propio encabezado. */
  hideMobileBar?: boolean
}

export function AppShell({ children, title, currentPath, userName = '', userEmail = '', householdName = '', headerRight, titleRight, mobileHeader, hideMobileBar = false }: AppShellProps) {
  const [isMaster, setIsMaster] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // Nombre del pie del sidebar: el de la página o, si no lo pasa, el del perfil.
  const [loadedName, setLoadedName] = useState('')
  const displayName = userName || loadedName
  const router = useRouter()
  const pathname = usePathname() ?? currentPath
  const isRoot = isRootPath(pathname)
  const parent = parentFor(pathname)

  // La página ya tiene sus datos (pinta AppShell): el splash puede salir.
  useEffect(() => { signalAppReady() }, [])

  useEffect(() => {
    if (userEmail) setIsMaster(isMasterUser(userEmail))
    if (userEmail && userName) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: { id: string; email?: string } | null } }) => {
      if (!user) return
      if (user.email) setIsMaster(isMasterUser(user.email))
      if (userName) return
      const { data } = await supabase.from('users').select('full_name').eq('id', user.id).maybeSingle()
      const full = ((data?.full_name as string | undefined) ?? '').trim()
      setLoadedName(full ? full.split(/\s+/)[0] : (user.email ?? '').split('@')[0])
    })
  }, [userEmail, userName])

  const navGroups = isMaster
    ? NAV_GROUPS.map((g, i) =>
        i === NAV_GROUPS.length - 1
          ? { ...g, items: [...g.items, ADMIN_ITEM] }
          : g
      )
    : NAV_GROUPS

  function goBack() {
    // Si se entró directo a esta ruta no hay historial: se va al padre.
    if (window.history.length > 1) router.back()
    else router.push(parent.href)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--zafi-bg)' }}>
      {/* Mobile header — solo fuera de las pestañas raíz */}
      {!isRoot && !hideMobileBar && (
        <header
          className="lg:hidden sticky top-0 z-30 backdrop-blur-md grid items-center px-2"
          style={{
            gridTemplateColumns: '1fr auto 1fr',
            background: 'var(--zafi-bg)',
            paddingTop: 'env(safe-area-inset-top)',
            minHeight: 'calc(52px + env(safe-area-inset-top))',
          }}
        >
          <button
            type="button"
            onClick={goBack}
            className="justify-self-start flex items-center min-h-[44px] px-2 truncate max-w-full"
            style={{ fontSize: 15, color: 'var(--zafi-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ChevronLeft className="w-5 h-5 flex-shrink-0 -ml-1" aria-hidden />
            <span className="truncate">{parent.label}</span>
          </button>
          <h1 className="truncate text-center text-ink-900 dark:text-ink-100" style={{ fontSize: 16, fontWeight: 600, margin: 0, maxWidth: '50vw' }}>
            {title}
          </h1>
          <span aria-hidden />
        </header>
      )}

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside
          className="hidden lg:flex lg:sticky top-0 left-0 h-screen z-50"
          style={{
            width: 252,
            background: 'var(--zafi-sidebar)',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '22px 18px 12px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Logo */}
            <Link href="/dashboard" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '4px 10px 16px', textDecoration: 'none',
            }}>
              <AppIcon size="sm" variant="electric" />
              <Wordmark variant="dark" size="sm" />
            </Link>

            <button
              type="button"
              onClick={() => openAddSheet()}
              className="btn-primary w-full"
              style={{ marginBottom: 16, borderRadius: 14 }}
            >
              <Plus className="w-4 h-4" aria-hidden />
              Agregar
            </button>

            {/* Nav groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              {navGroups.map((group) => (
                <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                    color: 'var(--zafi-sidebar-group)', padding: '0 12px 4px', textTransform: 'uppercase',
                  }}>
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const isActive = item.href === currentPath
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
                    return item.action === 'feedback' ? (
                      <button key={item.href} type="button" onClick={() => setFeedbackOpen(true)} style={style} {...hover}>
                        {body}
                      </button>
                    ) : (
                      <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined} style={style} {...hover}>
                        {body}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Pie: quién está conectado y cerrar sesión */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '10px 18px 12px 28px', borderTop: `1px solid var(--zafi-sidebar-border)`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--zafi-sidebar-active)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, color: '#fff',
              flexShrink: 0,
            }}>
              {displayName ? displayName[0]?.toUpperCase() : ''}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              {householdName && (
                <div style={{ fontSize: '11.5px', color: 'var(--zafi-sidebar-group)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {householdName}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-white/5"
              style={{ color: 'var(--zafi-sidebar-text)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
            >
              <LogOut style={{ width: 15, height: 15 }} aria-hidden />
              Salir
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Desktop header */}
          <div className="hidden lg:flex items-baseline justify-between" style={{ padding: '44px 52px 0' }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color: 'var(--zafi-text)', margin: 0 }}>
              {title}
            </h1>
            {headerRight}
          </div>
          {/* En las pestañas raíz (móvil) el título va dentro del contenido, sin barra */}
          {isRoot && (
            <div
              className="lg:hidden flex items-center justify-between gap-3"
              style={{ padding: 'calc(16px + env(safe-area-inset-top)) 20px 0' }}
            >
              {mobileHeader ?? (
                <>
                  <h1 className="font-serif text-ink-900 dark:text-ink-100" style={{ fontSize: 30, lineHeight: 1.15, margin: 0 }}>
                    {title}
                  </h1>
                  {titleRight}
                </>
              )}
            </div>
          )}
          {/* Los hijos se pintan una sola vez: sus hojas y toasts no se duplican */}
          <div className={`px-4 pb-28 lg:px-[52px] lg:pt-2 lg:pb-[60px] ${isRoot ? 'pt-3' : 'pt-2'}`}>
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <BottomNav />

      {/* Hoja global de agregar (botón + y ?action=) */}
      <AddSheet />
      <PushOfferSheet />
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ScoreWatcher />
    </div>
  )
}
