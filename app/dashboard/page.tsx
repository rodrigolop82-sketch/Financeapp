'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { localToday, localMonthStart, localDaysAgo } from '@/lib/dates'
import { cleanTransactionName } from '@/lib/format'
import { AppShell } from '@/components/layout/AppShell'
import { StatusHero } from '@/components/dashboard/StatusHero'
import { QuickAddBar } from '@/components/dashboard/QuickAddBar'
import { SummaryRow } from '@/components/dashboard/SummaryRow'
import { SmartAlert, buildSmartAlert, type AlertData } from '@/components/dashboard/SmartAlert'
import { TransactionsList } from '@/components/dashboard/TransactionsList'
import { StreakCard } from '@/components/dashboard/StreakCard'
import { TransactionPreview } from '@/components/voice/TransactionPreview'
import { VoiceOverlay } from '@/components/voice/VoiceOverlay'
import type { VoiceExtractionResult, ExtractedTransaction, Transaction, BudgetCategory, FinancialProfile, Household } from '@/types'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { getUserHousehold } from '@/lib/household'

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
  userInitials: string
  healthScore: number
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
  bestStreak: number
  weekVsPrev: number
  budget: number
  householdId: string
  categories: BudgetCategory[]
  isCurrentMonth: boolean
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false)
  const [selectedMonthStart, setSelectedMonthStart] = useState(() => localMonthStart())
  const router = useRouter()

  useEffect(() => { loadDashboardData(selectedMonthStart) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for voice overlay trigger from BottomNav
  useEffect(() => {
    const handler = () => setVoiceOverlayOpen(true)
    window.addEventListener('zafi:voice-overlay', handler)
    return () => window.removeEventListener('zafi:voice-overlay', handler)
  }, [])

  async function loadDashboardData(ms?: string) {
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

    // Get household (owner or member)
    const household = await getUserHousehold(supabase, user.id)

    if (!household) {
      router.push('/onboarding')
      return
    }

    const hid = household.id as string

    const now = new Date()
    const currentMs = localMonthStart()
    const monthStart = ms ?? currentMs
    const isCurrentMonth = monthStart === currentMs

    // Calculate the last day of the selected month
    const msDate = new Date(monthStart + 'T12:00:00')
    const nextMonthDate = new Date(msDate.getFullYear(), msDate.getMonth() + 1, 1)
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`

    const weekStart = localDaysAgo(7)
    const today = localToday()

    const prevWeekStart = localDaysAgo(14)
    const [profileRes, txMonthRes, categoriesRes, prevWeekRes, allDatesRes] = await Promise.all([
      supabase.from('financial_profiles').select('*').eq('household_id', hid).order('updated_at', { ascending: false }).limit(1).single(),
      supabase.from('transactions').select('*').eq('household_id', hid).gte('date', monthStart).lt('date', nextMonthStr).order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('household_id', hid),
      isCurrentMonth
        ? supabase.from('transactions').select('amount').eq('household_id', hid).gte('date', prevWeekStart).lt('date', weekStart)
        : Promise.resolve({ data: [] }),
      supabase.from('transactions').select('date').eq('household_id', hid),
    ])

    const profile = profileRes.data as FinancialProfile | null
    const txMonth = (txMonthRes.data ?? []) as Transaction[]
    const categories = (categoriesRes.data ?? []) as BudgetCategory[]
    const prevWeekTx = (prevWeekRes.data ?? []) as { amount: number }[]
    const allDates = (allDatesRes.data ?? []) as { date: string }[]

    // Build category lookup map
    const categoryMap: Record<string, string> = {}
    categories.forEach((c) => { categoryMap[c.id] = c.name })

    const daysInMonth = new Date(msDate.getFullYear(), msDate.getMonth() + 1, 0).getDate()
    const daysLeft = isCurrentMonth ? daysInMonth - now.getDate() : 0

    const spentMonth = txMonth.reduce((s, t) => s + Number(t.amount), 0)
    const spentToday = isCurrentMonth ? txMonth.filter((t) => t.date === today).reduce((s, t) => s + Number(t.amount), 0) : 0
    const spentWeek  = isCurrentMonth ? txMonth.filter((t) => t.date >= weekStart).reduce((s, t) => s + Number(t.amount), 0) : 0
    const todayCount = isCurrentMonth ? txMonth.filter((t) => t.date === today).length : 0

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
    let streakOffset = txDates.has(today) ? 0 : 1
    while (true) {
      const ds = localDaysAgo(streakOffset)
      if (txDates.has(ds)) {
        currentStreak++
        streakOffset++
      } else {
        break
      }
    }

    // Mejor racha histórica
    const allTxDatesSet = new Set(allDates.map((r) => r.date))
    const sortedAllDates = Array.from(allTxDatesSet).sort()
    let bestStreak = 0
    let bStreak = 0
    let prevD: string | null = null
    for (const d of sortedAllDates) {
      if (prevD) {
        const diffDays = Math.round(
          (new Date(d + 'T12:00:00').getTime() - new Date(prevD + 'T12:00:00').getTime()) / 86400000
        )
        bStreak = diffDays === 1 ? bStreak + 1 : 1
      } else {
        bStreak = 1
      }
      if (bStreak > bestStreak) bestStreak = bStreak
      prevD = d
    }
    bestStreak = Math.max(bestStreak, currentStreak)

    // Variación semana vs semana anterior
    const spentPrevWeek = prevWeekTx.reduce((s, t) => s + Number(t.amount), 0)
    const weekVsPrev = spentPrevWeek > 0
      ? Math.round((spentWeek - spentPrevWeek) / spentPrevWeek * 100)
      : 0

    // Días de la semana para racha visual
    const weekDayStatus: ('done' | 'today' | 'miss')[] = Array.from({ length: 7 }, (_, i) => {
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
      const ds = localDaysAgo(dayOfWeek - i)
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

    const fullName = (userProfile?.full_name || 'Usuario') as string
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0]
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : nameParts[0].substring(0, 2).toUpperCase()

    setData({
      profile,
      household: household as Household,
      userName: firstName,
      userInitials: initials,
      healthScore: profile?.health_score ?? 0,
      enrichedTransactions, spentMonth, spentToday, spentWeek, todayCount,
      daysLeft, daysInMonth, alert, weekDayStatus, currentStreak, bestStreak, weekVsPrev, budget,
      householdId: hid,
      categories,
      isCurrentMonth,
    })
  }

  function getMonthLabel(ms: string) {
    const d = new Date(ms + 'T12:00:00')
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
  }

  function goToPrevMonth() {
    const d = new Date(selectedMonthStart + 'T12:00:00')
    d.setMonth(d.getMonth() - 1)
    const newMs = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    setSelectedMonthStart(newMs)
    setData(null)
    loadDashboardData(newMs)
  }

  function goToNextMonth() {
    const d = new Date(selectedMonthStart + 'T12:00:00')
    d.setMonth(d.getMonth() + 1)
    const newMs = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    if (newMs <= localMonthStart()) {
      setSelectedMonthStart(newMs)
      setData(null)
      loadDashboardData(newMs)
    }
  }

  // Keyword map for auto-categorizing quick-add transactions
  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'alimentación': ['super', 'supermercado', 'mercado', 'comida', 'pollo', 'carne', 'verdura', 'fruta', 'pan', 'leche', 'huevo', 'arroz', 'frijol', 'tortilla', 'despensa'],
    'restaurantes': ['almuerzo', 'cena', 'desayuno', 'restaurante', 'pizza', 'hamburguesa', 'sushi', 'café', 'starbucks', 'mcdonald', 'burger', 'taco', 'comida rápida'],
    'transporte': ['uber', 'taxi', 'bus', 'gasolina', 'gas', 'peaje', 'parqueo', 'estacionamiento', 'didi', 'indriver'],
    'salud': ['farmacia', 'medicina', 'doctor', 'hospital', 'clínica', 'dentista', 'consulta', 'vitamina'],
    'entretenimiento': ['cine', 'netflix', 'spotify', 'disney', 'hbo', 'juego', 'película', 'concierto', 'fiesta'],
    'suscripciones': ['netflix', 'spotify', 'youtube', 'prime', 'hbo', 'disney', 'apple', 'icloud'],
    'servicios': ['luz', 'agua', 'internet', 'teléfono', 'celular', 'cable', 'gas', 'basura'],
    'educación': ['colegio', 'universidad', 'curso', 'libro', 'matrícula', 'clase', 'escuela'],
    'ropa': ['ropa', 'zapatos', 'camisa', 'pantalón', 'vestido', 'tienda'],
    'vivienda': ['alquiler', 'renta', 'hipoteca', 'mantenimiento', 'reparación'],
  }

  function matchCategory(description: string): string | null {
    if (!data) return null
    const lower = description.toLowerCase()
    // Try direct match with category name
    for (const cat of data.categories) {
      if (lower.includes(cat.name.toLowerCase()) || cat.name.toLowerCase().includes(lower)) {
        return cat.id
      }
    }
    // Try keyword matching
    for (const [catKeyword, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(k => lower.includes(k))) {
        const match = data.categories.find(c => c.name.toLowerCase().includes(catKeyword))
        if (match) return match.id
      }
    }
    return null
  }

  async function handleQuickAdd(text: string) {
    if (!data) return
    const match = text.match(/^Q?\s*(\d+(?:\.\d+)?)\s+(.+)$/i)
    if (!match) return
    const amount = parseFloat(match[1])
    const description = cleanTransactionName(match[2])
    const categoryId = matchCategory(description)
    const supabase = createClient()
    await supabase.from('transactions').insert({
      household_id: data.householdId, amount, description,
      date: localToday(), source: 'manual',
      ...(categoryId ? { category_id: categoryId } : {}),
    })
    const catName = categoryId ? data.categories.find(c => c.id === categoryId)?.name : null
    setSuccessMsg(`Q ${amount} "${description}" guardado${catName ? ` en ${catName}` : ''}`)
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
      date: t.date || localToday(),
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

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    )
  }

  const isCurrentMonth = data.isCurrentMonth

  return (
    <AppShell title="Dashboard" currentPath="/dashboard" userName={data.userName} householdName={data.household.name}>

      {/* Navegador de mes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 0' }}>
        <button
          onClick={goToPrevMonth}
          className="p-1.5 rounded-lg text-navy/60 hover:text-navy hover:bg-navy/5 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <span className="font-outfit font-semibold text-navy" style={{ fontSize: 15 }}>
            {getMonthLabel(selectedMonthStart)}
          </span>
          {!isCurrentMonth && (
            <span className="text-xs text-gray-400 ml-2">histórico</span>
          )}
        </div>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg text-navy/60 hover:text-navy hover:bg-navy/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Hero marino */}
      <StatusHero
        spent={data.spentMonth}
        budget={data.budget}
        daysLeft={data.daysLeft}
        userName={data.userName}
        score={data.healthScore}
        userInitials={data.userInitials}
        isPastMonth={!isCurrentMonth}
      />

      {/* Mensaje de éxito */}
      {successMsg && (
        <div style={{
          margin: '10px 16px 0', padding: '8px 12px',
          background: '#F0FDF4', border: '0.5px solid #BBF7D0',
          borderRadius: 10, fontSize: 14, color: '#065F46'
        }}>
          {successMsg}
        </div>
      )}

      {/* Preview de voz (solo mes actual) */}
      {voiceResult && isCurrentMonth && (
        <div style={{ margin: '10px 16px 0', padding: 14, background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1E40AF', marginBottom: 10 }}>Revisá antes de guardar</p>
          <TransactionPreview
            result={voiceResult}
            onConfirm={handleVoiceConfirm}
            onCancel={() => setVoiceResult(null)}
          />
        </div>
      )}

      {/* Quick add — solo mes actual */}
      {isCurrentMonth && (
        <QuickAddBar
          onAdd={handleQuickAdd}
          onVoiceOverlay={() => setVoiceOverlayOpen(true)}
        />
      )}

      {/* Summary */}
      <SummaryRow
        today={data.spentToday}
        todayCount={data.todayCount}
        week={data.spentWeek}
        weekVsPrev={data.weekVsPrev}
        month={data.spentMonth}
        monthBudget={data.budget}
        isPastMonth={!isCurrentMonth}
      />

      {/* Alerta inteligente — solo mes actual */}
      {isCurrentMonth && <SmartAlert alert={data.alert} />}

      {/* Transacciones del período */}
      <TransactionsList
        transactions={data.enrichedTransactions}
        onSeeAll={() => router.push('/transacciones')}
      />

      {/* Racha — solo mes actual */}
      {isCurrentMonth && (
        <StreakCard
          currentStreak={data.currentStreak}
          bestStreak={data.bestStreak}
          weekDays={data.weekDayStatus}
        />
      )}

      {/* Espacio final para BottomNav */}
      <div className="h-6" />

      {/* Voice overlay full-screen */}
      <VoiceOverlay
        open={voiceOverlayOpen}
        onClose={() => setVoiceOverlayOpen(false)}
        onResult={(result) => { setVoiceResult(result); setVoiceOverlayOpen(false) }}
        onError={(err) => setSuccessMsg(err)}
      />
    </AppShell>
  )
}
