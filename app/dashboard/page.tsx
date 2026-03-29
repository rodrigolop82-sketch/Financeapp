'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { StatusHero } from '@/components/dashboard/StatusHero'
import { QuickAddBar } from '@/components/dashboard/QuickAddBar'
import { SummaryRow } from '@/components/dashboard/SummaryRow'
import { SmartAlert, buildSmartAlert, type AlertData } from '@/components/dashboard/SmartAlert'
import { TransactionsList } from '@/components/dashboard/TransactionsList'
import { StreakCard } from '@/components/dashboard/StreakCard'
import { TransactionPreview } from '@/components/voice/TransactionPreview'
import type { VoiceExtractionResult, ExtractedTransaction, Transaction, BudgetCategory, FinancialProfile, Household } from '@/types'
import {
  BarChart3, Wallet, CreditCard, Target, Receipt,
  MessageCircle, BookOpen, Clock, Users, Settings,
  Menu, LogOut, Loader2,
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

interface EnrichedTransaction {
  id: string
  description: string | null
  category: string
  amount: number
  date: string
  source: 'manual' | 'voice' | 'ocr' | 'csv'
}

interface DashboardData {
  profile: FinancialProfile | null
  household: Household
  userName: string
  enrichedTransactions: EnrichedTransaction[]
  spentMonth: number
  spentToday: number
  spentWeek: number
  todayCount: number
  daysLeft: number
  daysInMonth: number
  alert: AlertData | null
  weekDayStatus: ('done' | 'today' | 'miss')[]
  currentStreak: number
  budget: number
  householdId: string
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  useEffect(() => { loadDashboardData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDashboardData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    // Get household (owner)
    const { data: household } = await supabase
      .from('households')
      .select('*')
      .eq('owner_id', user.id)
      .limit(1)
      .single()

    if (!household) {
      router.push('/onboarding')
      return
    }

    const hid = household.id as string

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    const [profileRes, txMonthRes, categoriesRes] = await Promise.all([
      supabase.from('financial_profiles').select('*').eq('household_id', hid).order('updated_at', { ascending: false }).limit(1).single(),
      supabase.from('transactions').select('*').eq('household_id', hid).gte('date', monthStart).order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('household_id', hid),
    ])

    const profile = profileRes.data as FinancialProfile | null
    const txMonth = (txMonthRes.data ?? []) as Transaction[]
    const categories = (categoriesRes.data ?? []) as BudgetCategory[]

    // Build category lookup map
    const categoryMap: Record<string, string> = {}
    categories.forEach((c) => { categoryMap[c.id] = c.name })

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysLeft = daysInMonth - now.getDate()

    const spentMonth = txMonth.reduce((s, t) => s + Number(t.amount), 0)
    const spentToday = txMonth.filter((t) => t.date === today).reduce((s, t) => s + Number(t.amount), 0)
    const spentWeek  = txMonth.filter((t) => t.date >= weekStart).reduce((s, t) => s + Number(t.amount), 0)
    const todayCount = txMonth.filter((t) => t.date === today).length

    // Enrich transactions with category name for display
    const enrichedTransactions: EnrichedTransaction[] = txMonth.map((t) => ({
      id: t.id,
      description: t.description,
      category: categoryMap[t.category_id] ?? 'Otros',
      amount: Number(t.amount),
      date: t.date,
      source: t.source ?? 'manual',
    }))

    // Calcular categoría más sobregirada
    const spentByCat: Record<string, number> = {}
    txMonth.forEach((t) => { spentByCat[t.category_id] = (spentByCat[t.category_id] ?? 0) + Number(t.amount) })
    let topOver: { name: string; spent: number; limit: number; pctOver: number } | undefined = undefined
    categories.forEach((c) => {
      const s = spentByCat[c.id] ?? 0
      const over = c.budgeted_amount > 0 ? (s - c.budgeted_amount) / c.budgeted_amount * 100 : 0
      if (over > 20 && (!topOver || over > topOver.pctOver)) {
        topOver = { name: c.name, spent: s, limit: c.budgeted_amount, pctOver: Math.round(over) }
      }
    })

    // Días sin registrar (para alerta)
    const lastTxDate = txMonth[0]?.date
    const daysSinceLast = lastTxDate
      ? Math.floor((now.getTime() - new Date(lastTxDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
      : 999

    // Calcular racha de días consecutivos registrando gastos
    const txDates = new Set(txMonth.map((t) => t.date))
    let currentStreak = 0
    const checkDate = new Date(now)
    if (!txDates.has(today)) {
      checkDate.setDate(checkDate.getDate() - 1)
    }
    while (true) {
      const ds = checkDate.toISOString().split('T')[0]
      if (txDates.has(ds)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    // Días de la semana para racha visual
    const weekDayStatus: ('done' | 'today' | 'miss')[] = Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(now)
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
      dayDate.setDate(now.getDate() - dayOfWeek + i)
      const ds = dayDate.toISOString().split('T')[0]
      if (ds === today) return 'today'
      if (txDates.has(ds)) return 'done'
      if (ds < today) return 'miss'
      return 'miss'
    })

    const budget = profile?.total_income ? Number(profile.total_income) * 0.8 : 4000

    const alert = buildSmartAlert({
      spent: spentMonth,
      budget,
      daysLeft,
      daysInMonth,
      topOverBudgetCategory: topOver,
      daysSinceLastTransaction: daysSinceLast,
    })

    setData({
      profile,
      household: household as Household,
      userName: userProfile?.full_name?.split(' ')[0] || 'Usuario',
      enrichedTransactions, spentMonth, spentToday, spentWeek, todayCount,
      daysLeft, daysInMonth, alert, weekDayStatus, currentStreak, budget,
      householdId: hid,
    })
  }

  async function handleQuickAdd(text: string) {
    if (!data) return
    const match = text.match(/^Q?\s*(\d+(?:\.\d+)?)\s+(.+)$/i)
    if (!match) return
    const amount = parseFloat(match[1])
    const description = match[2].trim()
    const supabase = createClient()
    await supabase.from('transactions').insert({
      household_id: data.householdId, amount, description,
      date: new Date().toISOString().split('T')[0], source: 'manual',
    })
    setSuccessMsg(`Q ${amount} "${description}" guardado`)
    setTimeout(() => setSuccessMsg(null), 3000)
    loadDashboardData()
  }

  async function handleVoiceConfirm(transactions: ExtractedTransaction[]) {
    if (!data || transactions.length === 0) return
    const supabase = createClient()

    const rows = transactions.map((t) => ({
      household_id: data.householdId,
      amount: t.amount,
      description: t.description,
      category_id: t.category_id ?? null,
      date: t.date || new Date().toISOString().split('T')[0],
      source: 'voice' as const,
      voice_raw_text: voiceResult?.raw_text ?? null,
    }))
    await supabase.from('transactions').insert(rows)

    setVoiceResult(null)
    const count = transactions.length
    setSuccessMsg(`${count} gasto${count > 1 ? 's' : ''} guardado${count > 1 ? 's' : ''}`)
    setTimeout(() => setSuccessMsg(null), 3000)
    loadDashboardData()
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 bg-white border-b z-40 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#2563EB] rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">Z</span>
          </div>
          <span className="font-semibold text-[#1E3A5F]">Zafi</span>
        </div>
        <div className="w-6" />
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r z-50 transform transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-[#2563EB] rounded-xl flex items-center justify-center">
                <span className="text-white text-sm font-bold">Z</span>
              </div>
              <span className="text-lg font-bold text-[#1E3A5F]">Zafi</span>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    item.href === '/dashboard'
                      ? 'bg-[#F8F9FF] text-[#1D4ED8]'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="absolute bottom-0 w-full p-4 border-t">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-[#1D4ED8]">
                  {data.userName[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{data.userName}</p>
                <p className="text-xs text-gray-500 truncate">{data.household.name}</p>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 max-w-2xl mx-auto lg:mx-0">
          <div style={{ background: '#F0F4FF', minHeight: '100vh', paddingBottom: 80 }}>

            {/* Hero marino */}
            <StatusHero
              spent={data.spentMonth}
              budget={data.budget}
              daysLeft={data.daysLeft}
            />

            {/* Mensaje de éxito */}
            {successMsg && (
              <div style={{
                margin: '10px 16px 0', padding: '8px 12px',
                background: '#F0FDF4', border: '0.5px solid #BBF7D0',
                borderRadius: 10, fontSize: 12, color: '#065F46'
              }}>
                {successMsg}
              </div>
            )}

            {/* Preview de voz (si hay) */}
            {voiceResult && (
              <div style={{ margin: '10px 16px 0', padding: 14, background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#1E40AF', marginBottom: 10 }}>Revisá antes de guardar</p>
                <TransactionPreview
                  result={voiceResult}
                  onConfirm={handleVoiceConfirm}
                  onCancel={() => setVoiceResult(null)}
                />
              </div>
            )}

            {/* Quick add */}
            <QuickAddBar
              onAdd={handleQuickAdd}
              onVoiceResult={setVoiceResult}
            />

            {/* Summary */}
            <SummaryRow
              today={data.spentToday}
              todayCount={data.todayCount}
              week={data.spentWeek}
              weekVsPrev={12}
              month={data.spentMonth}
              monthBudget={data.budget}
            />

            {/* Alerta inteligente */}
            <SmartAlert alert={data.alert} />

            {/* Últimos movimientos */}
            <TransactionsList
              transactions={data.enrichedTransactions}
              onSeeAll={() => router.push('/transacciones')}
            />

            {/* Racha */}
            <StreakCard
              currentStreak={data.currentStreak}
              bestStreak={12}
              weekDays={data.weekDayStatus}
            />

            {/* Espacio final */}
            <div style={{ height: 16 }} />
          </div>
        </main>
      </div>
    </div>
  )
}
