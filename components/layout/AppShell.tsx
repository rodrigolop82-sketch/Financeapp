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
  BarChart3, Wallet, CreditCard, Target, Receipt,
  MessageCircle, BookOpen, Clock, Users, Settings,
  Menu, LogOut, ArrowLeft, ShieldCheck,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { href: '/presupuesto', icon: Wallet, label: 'Presupuesto' },
  { href: '/deudas', icon: CreditCard, label: 'Deudas' },
  { href: '/plan', icon: Target, label: 'Plan' },
  { href: '/transacciones', icon: Receipt, label: 'Transacciones' },
  { href: '/chat', icon: MessageCircle, label: 'Zafi AI' },
  { href: '/aprende', icon: BookOpen, label: 'Aprende' },
  { href: '/historial', icon: Clock, label: 'Historial' },
  { href: '/familia', icon: Users, label: 'Familia' },
  { href: '/cuenta', icon: Settings, label: 'Cuenta' },
]

const ADMIN_NAV_ITEM = { href: '/admin', icon: ShieldCheck, label: 'Admin' }

interface AppShellProps {
  children: React.ReactNode
  title: string
  currentPath: string
  userName?: string
  userEmail?: string
  householdName?: string
}

export function AppShell({ children, title, currentPath, userName = '', userEmail = '', householdName = '' }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMaster, setIsMaster] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (userEmail) {
      setIsMaster(isMasterUser(userEmail))
    } else {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setIsMaster(isMasterUser(user.email))
      })
    }
  }, [userEmail])

  const navItems = isMaster ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-surface-bg">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 bg-navy/95 backdrop-blur-md border-b border-white/[0.08] px-4 py-3 flex items-center gap-3">
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
          className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-navy-deep border-r border-white/[0.08] z-50 transform transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 mb-8">
              <AppIcon size="sm" variant="electric" />
              <Wordmark variant="dark" size="sm" />
            </Link>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-medium transition-colors ${
                    item.href === currentPath
                      ? 'bg-electric/10 text-electric-pale'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          {userName && (
            <div className="absolute bottom-0 w-full p-4 border-t border-white/[0.08]">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 bg-electric/20 rounded-full flex items-center justify-center">
                  <span className="text-body-sm font-semibold text-electric-pale">
                    {userName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-white truncate">{userName}</p>
                  {householdName && <p className="text-caption text-white/40 truncate">{householdName}</p>}
                </div>
                <button onClick={handleLogout} className="text-white/30 hover:text-white/60">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
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
        <main className="flex-1">
          {/* Desktop header */}
          <div className="hidden lg:flex items-center gap-3 p-6 pb-2">
            <h1 className="font-serif text-title text-navy">{title}</h1>
          </div>
          <div className="p-4 lg:p-6 lg:pt-2 pb-24 lg:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <BottomNav />
    </div>
  )
}
