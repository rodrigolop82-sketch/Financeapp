'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { isMasterUser } from '@/lib/master-user'
import { isRootPath, parentFor, sidebarActiveHref } from '@/lib/navigation'
import { NAV_GROUPS, SidebarLinks, type NavItem } from '@/components/layout/SidebarLinks'
import { Wordmark } from '@/components/brand/Wordmark'
import { AppIcon } from '@/components/brand/AppIcon'
import { BottomNav, openAddSheet } from '@/components/dashboard/BottomNav'
import { AddSheet } from '@/components/add/AddSheet'
import { ViewOnlySheet } from '@/components/premium/ViewOnlySheet'
import { useViewOnly } from '@/lib/hooks/useEffectivePlan'
import { PushOfferSheet } from '@/components/avisos/PushOfferSheet'
import { ScoreWatcher } from '@/components/score/ScoreWatcher'
import { signalAppReady } from '@/components/motion/Splash'
import { ShieldCheck, ChevronLeft, Plus, LogOut } from 'lucide-react'

const ADMIN_ITEM: NavItem = { href: '/admin', icon: ShieldCheck, label: 'Admin' }

// Cada pantalla monta su propio AppShell: el nombre del pie se pide una vez
// por carga de la app, no en cada cambio de menú.
let cachedName: { userId: string; name: string } | null = null

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
  const viewOnly = useViewOnly()
  // Nombre del pie del sidebar: el de la página o, si no lo pasa, el del perfil.
  const [loadedName, setLoadedName] = useState('')
  const displayName = userName || loadedName
  const router = useRouter()
  const pathname = usePathname() ?? currentPath
  const isRoot = isRootPath(pathname)
  const activeHref = sidebarActiveHref(pathname) ?? currentPath
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
      if (cachedName?.userId === user.id) { setLoadedName(cachedName.name); return }
      const { data } = await supabase.from('users').select('full_name').eq('id', user.id).maybeSingle()
      const full = ((data?.full_name as string | undefined) ?? '').trim()
      const name = full ? full.split(/\s+/)[0] : (user.email ?? '').split('@')[0]
      cachedName = { userId: user.id, name }
      setLoadedName(name)
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

            {!viewOnly && (
              <button
                type="button"
                onClick={() => openAddSheet()}
                className="btn-primary w-full"
                style={{ marginBottom: 16, borderRadius: 14 }}
              >
                <Plus className="w-4 h-4" aria-hidden />
                Agregar
              </button>
            )}

            {/* Nav groups */}
            <SidebarLinks groups={navGroups} activeHref={activeHref} />
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
      <ViewOnlySheet />
      <PushOfferSheet />
      <ScoreWatcher />
    </div>
  )
}
