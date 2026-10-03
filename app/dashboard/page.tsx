'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { localToday, localMonthStart, localDaysAgo } from '@/lib/dates'
import { AppShell } from '@/components/layout/AppShell'
import { StatusHero } from '@/components/dashboard/StatusHero'
import { SummaryRow } from '@/components/dashboard/SummaryRow'
import { SmartAlert, buildSmartAlert, type AlertData } from '@/components/dashboard/SmartAlert'
import { TransactionsList } from '@/components/dashboard/TransactionsList'
import { StreakCard } from '@/components/dashboard/StreakCard'
import type { Transaction, BudgetCategory, FinancialProfile, Household, CapsuleRecommendation } from '@/types'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { getUserHousehold } from '@/lib/household'
import { useHealthScore } from '@/hooks/useHealthScore'
import { TRANSACTIONS_CHANGED_EVENT } from '@/components/add/AddSheet'
import { getRecommendedCapsules } from '@/lib/capsule-recommendations'
import { CapsuleRecommendations } from '@/components/education/CapsuleRecommendations'

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface EnrichedTransaction {
  id: string
  description: string | null
  category: string
  amount: number
  date: string
  source: 'manual' | 'voice' | 'ocr' | 'csv' | 'statement' | 'text'
  type?: 'expense' | 'income'
  categoryIcon?: string | null
  categoryColor?: string | null
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
  userId: string
  categories: BudgetCategory[]
  isCurrentMonth: boolean
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [recommendations, setRecommendations] = useState<CapsuleRecommendation[]>([])
  const [selectedMonthStart, setSelectedMonthStart] = useState(() => localMonthStart())
  const router = useRouter()
  const { score: healthScoreResult } = useHealthScore(data?.householdId ?? null)

  useEffect(() => { loadDashboardData(selectedMonthStart) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Recarga cuando se agregan movimientos desde la hoja global (botón +).
  const selectedMonthRef = useRef(selectedMonthStart)
  selectedMonthRef.current = selectedMonthStart
  useEffect(() => {
    const reload = () => { loadDashboardData(selectedMonthRef.current) }
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, reload)
    return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, reload)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.userId || !healthScoreResult || healthScoreResult.components.length === 0) return
    getRecommendedCapsules(data.userId, healthScoreResult.components)
      .then(setRecommendations)
      .catch(() => {})
  }, [data?.userId, healthScoreResult])

  async function loadDashboardData(ms?: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

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

    const msDate = new Date(monthStart + 'T12:00:00')
    const nextMonthDate = new Date(msDate.getFullYear(), msDate.getMonth() + 1, 1)
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`

    const weekStart = localDaysAgo(7)
    const today = localToday()

    const prevWeekStart = localDaysAgo(14)
    const [profileRes, txMonthRes, categoriesRes, prevWeekRes, allDatesRes] = await Promise.all([
      supabase.from('financial_profiles').select('*').eq('household_id', hid).order('updated_at', { ascending: false }).limit(1).single(),
      supabase.from('transactions').select('*').eq('household_id', hid).eq('type', 'expense').gte('date', monthStart).lt('date', nextMonthStr).order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('household_id', hid),
      isCurrentMonth
        ? supabase.from('transactions').select('amount').eq('household_id', hid).eq('type', 'expense').gte('date', prevWeekStart).lt('date', weekStart)
        : Promise.resolve({ data: [] }),
      supabase.from('transactions').select('date').eq('household_id', hid),
    ])

    const profile = profileRes.data as FinancialProfile | null
    const txMonth = (txMonthRes.data ?? []) as Transaction[]
    const categories = (categoriesRes.data ?? []) as BudgetCategory[]
    const prevWeekTx = (prevWeekRes.data ?? []) as { amount: number }[]
    const allDates = (allDatesRes.data ?? []) as { date: string }[]

    const categoryMap: Record<string, string> = {}
    const categoryMeta: Record<string, { icon?: string | null; color?: string | null }> = {}
    categories.forEach((c) => { categoryMap[c.id] = c.name; categoryMeta[c.id] = { icon: c.icon, color: c.color } })

    const daysInMonth = new Date(msDate.getFullYear(), msDate.getMonth() + 1, 0).getDate()
    const daysLeft = isCurrentMonth ? daysInMonth - now.getDate() : 0

    const spentMonth = txMonth.reduce((s, t) => s + Number(t.amount), 0)
    const spentToday = isCurrentMonth ? txMonth.filter((t) => t.date === today).reduce((s, t) => s + Number(t.amount), 0) : 0
    const spentWeek  = isCurrentMonth ? txMonth.filter((t) => t.date >= weekStart).reduce((s, t) => s + Number(t.amount), 0) : 0
    const todayCount = isCurrentMonth ? txMonth.filter((t) => t.date === today).length : 0

    const enrichedTransactions: EnrichedTransaction[] = txMonth.map((t) => ({
      id: t.id,
      description: t.description,
      category: categoryMap[t.category_id] ?? 'Otros',
      amount: Number(t.amount),
      date: t.date,
      source: t.source ?? 'manual',
      type: t.type ?? 'expense',
      categoryIcon: categoryMeta[t.category_id]?.icon,
      categoryColor: categoryMeta[t.category_id]?.color,
    }))

    const spentByCat: Record<string, number> = {}
    txMonth.forEach((t) => { spentByCat[t.category_id] = (spentByCat[t.category_id] ?? 0) + Number(t.amount) })
    let topOver: { name: string; spent: number; limit: number; pctOver: number } | undefined = undefined
    let savingsAlertData: { name: string; saved: number; goal: number } | undefined = undefined
    categories.forEach((c) => {
      const s = spentByCat[c.id] ?? 0
      if (c.bucket === 'savings') {
        if (c.budgeted_amount > 0 && (!savingsAlertData || c.budgeted_amount > savingsAlertData.goal)) {
          savingsAlertData = { name: c.name, saved: s, goal: c.budgeted_amount }
        }
        return
      }
      const over = c.budgeted_amount > 0 ? (s - c.budgeted_amount) / c.budgeted_amount * 100 : 0
      if (over > 20 && (!topOver || over > topOver.pctOver)) {
        topOver = { name: c.name, spent: s, limit: c.budgeted_amount, pctOver: Math.round(over) }
      }
    })

    const lastTxDate = txMonth[0]?.date ?? (allDates.length > 0 ? allDates.sort((a, b) => b.date.localeCompare(a.date))[0].date : null)
    const daysSinceLast = lastTxDate
      ? Math.max(0, Math.floor((now.getTime() - new Date(lastTxDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)))
      : 0

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

    const spentPrevWeek = prevWeekTx.reduce((s, t) => s + Number(t.amount), 0)
    const weekVsPrev = spentPrevWeek > 0
      ? Math.round((spentWeek - spentPrevWeek) / spentPrevWeek * 100)
      : 0

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
      savingsAlert: savingsAlertData,
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
      userId: user.id,
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

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--zafi-bg)' }}>
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    )
  }

  const isCurrentMonth = data.isCurrentMonth

  return (
    <AppShell title="Inicio" currentPath="/dashboard" userName={data.userName} householdName={data.household.name}>

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button
          onClick={goToPrevMonth}
          className="p-1.5 rounded-lg text-navy/60 hover:text-navy hover:bg-navy/5 transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--zafi-text)' }}>
            {getMonthLabel(selectedMonthStart)}
          </span>
          {!isCurrentMonth && (
            <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>histórico</span>
          )}
        </div>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg text-navy/60 hover:text-navy hover:bg-navy/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ background: 'none', border: 'none', cursor: isCurrentMonth ? 'not-allowed' : 'pointer' }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Hero card */}
      <StatusHero
        spent={data.spentMonth}
        budget={data.budget}
        daysLeft={data.daysLeft}
        userName={data.userName}
        score={data.healthScore}
        userInitials={data.userInitials}
      />

      {/* Stats row */}
      <SummaryRow
        today={data.spentToday}
        todayCount={data.todayCount}
        week={data.spentWeek}
        weekVsPrev={data.weekVsPrev}
        month={data.spentMonth}
        monthBudget={data.budget}
      />

      {/* Smart alert */}
      {isCurrentMonth && <SmartAlert alert={data.alert} />}

      {/* Capsule recommendations */}
      {isCurrentMonth && recommendations.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <CapsuleRecommendations recommendations={recommendations} />
        </div>
      )}

      {/* Transactions */}
      <div style={{ marginTop: 20 }}>
        <TransactionsList
          transactions={data.enrichedTransactions}
          onSeeAll={() => router.push('/transacciones')}
        />
      </div>

      {/* Streak */}
      {isCurrentMonth && (
        <div style={{ marginTop: 12 }}>
          <StreakCard
            currentStreak={data.currentStreak}
            bestStreak={data.bestStreak}
            weekDays={data.weekDayStatus}
          />
        </div>
      )}

      <div className="h-6" />

    </AppShell>
  )
}
