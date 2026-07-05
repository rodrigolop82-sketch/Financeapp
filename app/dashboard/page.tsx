'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { localToday, localMonthStart, localDaysAgo } from '@/lib/dates'
import { AppShell } from '@/components/layout/AppShell'
import { StatusHero } from '@/components/dashboard/StatusHero'
import { ExpenseDrawer } from '@/components/expenses/ExpenseDrawer'
import { SummaryRow } from '@/components/dashboard/SummaryRow'
import { SmartAlert, buildSmartAlert, type AlertData } from '@/components/dashboard/SmartAlert'
import { TransactionsList } from '@/components/dashboard/TransactionsList'
import { StreakCard } from '@/components/dashboard/StreakCard'
import { TransactionPreview } from '@/components/voice/TransactionPreview'
import { VoiceOverlay } from '@/components/voice/VoiceOverlay'
import type { VoiceExtractionResult, ExtractedTransaction, Transaction, BudgetCategory, FinancialProfile, Household, CapsuleRecommendation } from '@/types'
import { Loader2, ChevronLeft, ChevronRight, Plus, Mic, PenLine, FileText, X } from 'lucide-react'
import { getUserHousehold } from '@/lib/household'
import { FloatingScoreBadge } from '@/components/score/FloatingScoreBadge'
import { useHealthScore } from '@/hooks/useHealthScore'
import { StatementImportFlow } from '@/components/statement-import/StatementImportFlow'
import { getRecommendedCapsules } from '@/lib/capsule-recommendations'
import { CapsuleRecommendations } from '@/components/education/CapsuleRecommendations'

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface EnrichedTransaction {
  id: string
  description: string | null
  category: string
  amount: number
  date: string
  source: 'manual' | 'voice' | 'ocr' | 'csv' | 'statement'
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
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false)
  const [importFlowActive, setImportFlowActive] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [recommendations, setRecommendations] = useState<CapsuleRecommendation[]>([])
  const [selectedMonthStart, setSelectedMonthStart] = useState(() => localMonthStart())
  const router = useRouter()
  const { score: healthScoreResult, loading: scoreLoading } = useHealthScore(data?.householdId ?? null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const action = params.get('action')
    if (action === 'voice') setVoiceOverlayOpen(true)
    if (action === 'manual') window.dispatchEvent(new CustomEvent('zafi:open-expense-drawer'))
    if (action === 'scan') setImportFlowActive(true)
  }, [])

  useEffect(() => { loadDashboardData(selectedMonthStart) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.userId || !healthScoreResult || healthScoreResult.components.length === 0) return
    getRecommendedCapsules(data.userId, healthScoreResult.components)
      .then(setRecommendations)
      .catch(() => {})
  }, [data?.userId, healthScoreResult])

  function handleOpenManual() {
    window.dispatchEvent(new CustomEvent('zafi:open-expense-drawer'))
  }

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

    const categoryMap: Record<string, string> = {}
    categories.forEach((c) => { categoryMap[c.id] = c.name })

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
    }))

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

    const lastTxDate = txMonth[0]?.date
    const daysSinceLast = lastTxDate
      ? Math.floor((now.getTime() - new Date(lastTxDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
      : 999

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
      payment_method: 'efectivo' as const,
      voice_raw_text: voiceResult?.raw_text ?? null,
    }))
    const { error } = await supabase.from('transactions').insert(rows)

    if (error) {
      setErrorMsg(`No se pudo guardar: ${error.message}`)
      setTimeout(() => setErrorMsg(null), 5000)
      return
    }

    setVoiceResult(null)
    const count = transactions.length
    setSuccessMsg(`${count} gasto${count > 1 ? 's' : ''} guardado${count > 1 ? 's' : ''}`)
    setTimeout(() => setSuccessMsg(null), 3000)
    loadDashboardData()
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3F5F9' }}>
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    )
  }

  const isCurrentMonth = data.isCurrentMonth

  return (
    <AppShell title="Dashboard" currentPath="/dashboard" userName={data.userName} householdName={data.household.name}>

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
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 15, color: '#1E3A5F' }}>
            {getMonthLabel(selectedMonthStart)}
          </span>
          {!isCurrentMonth && (
            <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 8 }}>histórico</span>
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

      {/* Success/error messages */}
      {successMsg && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: '#F0FDF4', border: '0.5px solid #BBF7D0',
          borderRadius: 10, fontSize: 14, color: '#065F46'
        }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: '#FEF2F2', border: '0.5px solid #FECACA',
          borderRadius: 10, fontSize: 14, color: '#991B1B'
        }}>
          {errorMsg}
        </div>
      )}

      {/* Voice preview */}
      {voiceResult && isCurrentMonth && (
        <div style={{ marginTop: 12, padding: 14, background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1E40AF', marginBottom: 10 }}>Revisá antes de guardar</p>
          <TransactionPreview
            result={voiceResult}
            onConfirm={handleVoiceConfirm}
            onCancel={() => setVoiceResult(null)}
          />
        </div>
      )}

      {/* Expense drawer */}
      <ExpenseDrawer
        householdId={data.householdId}
        categories={data.categories}
        onSuccess={() => loadDashboardData()}
        onVoiceOverlay={() => setVoiceOverlayOpen(true)}
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

      {/* Floating Health Score badge */}
      {isCurrentMonth && (
        <FloatingScoreBadge score={healthScoreResult} loading={scoreLoading} />
      )}

      {/* FAB with menu */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
            zIndex: 40,
          }}
        />
      )}

      <div style={{ position: 'fixed', bottom: 36, right: 52, zIndex: 50 }}>
        {fabOpen && (
          <div style={{
            position: 'absolute', bottom: 68, right: 0,
            display: 'flex', flexDirection: 'column', gap: 10,
            alignItems: 'flex-end',
          }}>
            {[
              { label: 'Dictar con voz', icon: <Mic size={18} />, action: () => { setFabOpen(false); setVoiceOverlayOpen(true) } },
              { label: 'Registrar manual', icon: <PenLine size={18} />, action: () => { setFabOpen(false); handleOpenManual() } },
              { label: 'Cargar PDF / foto', icon: <FileText size={18} />, action: () => { setFabOpen(false); setImportFlowActive(true) } },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#fff', border: 'none', borderRadius: 14,
                  padding: '12px 18px', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(30,58,95,0.15)',
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: '#EFF6FF', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#2563EB',
                }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F' }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        )}

        <div
          onClick={() => setFabOpen(!fabOpen)}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#2563EB', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 24px rgba(37,99,235,0.35)', cursor: 'pointer',
            transition: 'transform 0.2s ease',
            transform: fabOpen ? 'rotate(45deg)' : 'none',
          }}
        >
          {fabOpen
            ? <X style={{ width: 24, height: 24, color: '#fff' }} />
            : <Plus style={{ width: 24, height: 24, color: '#fff' }} />
          }
        </div>
      </div>

      {/* Statement import flow */}
      {importFlowActive && (
        <StatementImportFlow
          householdId={data.householdId}
          onDone={() => { setImportFlowActive(false); loadDashboardData() }}
        />
      )}

      {/* Voice overlay */}
      <VoiceOverlay
        open={voiceOverlayOpen}
        onClose={() => setVoiceOverlayOpen(false)}
        onResult={(result) => { setVoiceResult(result); setVoiceOverlayOpen(false) }}
        onError={(err) => setSuccessMsg(err)}
      />
    </AppShell>
  )
}
