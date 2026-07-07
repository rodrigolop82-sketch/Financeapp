'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { localToday, localMonthStart, localDaysAgo } from '@/lib/dates'
import { cleanTransactionName } from '@/lib/format'
import { AppShell } from '@/components/layout/AppShell'
import { StatusHero } from '@/components/dashboard/StatusHero'
import { QuickAddBar } from '@/components/dashboard/QuickAddBar'
import { AddExpenseSheet } from '@/components/dashboard/AddExpenseSheet'
import { SummaryRow } from '@/components/dashboard/SummaryRow'
import { SmartAlert, buildSmartAlert, type AlertData } from '@/components/dashboard/SmartAlert'
import { TransactionsList } from '@/components/dashboard/TransactionsList'
import { StreakCard } from '@/components/dashboard/StreakCard'
import { TransactionPreview } from '@/components/voice/TransactionPreview'
import { VoiceOverlay } from '@/components/voice/VoiceOverlay'
import type { VoiceExtractionResult, ExtractedTransaction, Transaction, BudgetCategory, FinancialProfile, Household, CapsuleRecommendation } from '@/types'
import { Loader2, ChevronLeft, ChevronRight, BookOpen, Plus } from 'lucide-react'
import { getRecommendedCapsules } from '@/lib/capsule-recommendations'
import { calculateHealthScore } from '@/lib/scoring'

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
  capsuleRecommendations: CapsuleRecommendation[]
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false)
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false)
  const router = useRouter()

  useEffect(() => { loadDashboardData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => setExpenseSheetOpen(true)
    window.addEventListener('zafi:voice-overlay', handler)
    return () => window.removeEventListener('zafi:voice-overlay', handler)
  }, [])

  async function loadDashboardData() {
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
    const monthStart = localMonthStart()
    const weekStart = localDaysAgo(7)
    const prevWeekStart = localDaysAgo(14)
    const today = localToday()

    const [profileRes, txMonthRes, categoriesRes, txPrevWeekRes, tx90Res] = await Promise.all([
      supabase.from('financial_profiles').select('*').eq('household_id', hid).order('updated_at', { ascending: false }).limit(1).single(),
      supabase.from('transactions').select('*').eq('household_id', hid).gte('date', monthStart).order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('household_id', hid),
      supabase.from('transactions').select('amount').eq('household_id', hid).gte('date', prevWeekStart).lt('date', weekStart),
      supabase.from('transactions').select('date').eq('household_id', hid).gte('date', localDaysAgo(90)),
    ])

    const profile = profileRes.data as FinancialProfile | null
    const txMonth = (txMonthRes.data ?? []) as Transaction[]
    const categories = (categoriesRes.data ?? []) as BudgetCategory[]
    const spentPrevWeek = (txPrevWeekRes.data ?? []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)

    const categoryMap: Record<string, string> = {}
    categories.forEach((c) => { categoryMap[c.id] = c.name })

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysLeft = daysInMonth - now.getDate()

    const spentMonth = txMonth.reduce((s, t) => s + Number(t.amount), 0)
    const spentToday = txMonth.filter((t) => t.date === today).reduce((s, t) => s + Number(t.amount), 0)
    const spentWeek  = txMonth.filter((t) => t.date >= weekStart).reduce((s, t) => s + Number(t.amount), 0)
    const todayCount = txMonth.filter((t) => t.date === today).length

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

    const tx90Dates = Array.from(new Set((tx90Res.data ?? []).map((t: { date: string }) => t.date))).sort() as string[]
    let bestStreak = currentStreak
    let tempStreak = 0
    let prevDate: string | null = null
    for (const dateStr of tx90Dates) {
      if (prevDate === null) {
        tempStreak = 1
      } else {
        const diffMs = new Date(dateStr + 'T12:00:00').getTime() - new Date(prevDate + 'T12:00:00').getTime()
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
        tempStreak = diffDays === 1 ? tempStreak + 1 : 1
      }
      bestStreak = Math.max(bestStreak, tempStreak)
      prevDate = dateStr
    }

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

    let capsuleRecommendations: CapsuleRecommendation[] = []
    try {
      if (profile) {
        const score = calculateHealthScore({
          total_income: Number(profile.total_income ?? 0),
          total_fixed_expenses: Number(profile.total_fixed_expenses ?? 0),
          total_debt: Number(profile.total_debt ?? 0),
          total_savings: Number(profile.total_savings ?? 0),
          has_emergency_fund: profile.has_emergency_fund ?? false,
          income_type: profile.income_type ?? 'fixed',
        })
        capsuleRecommendations = await getRecommendedCapsules(user.id, score)
      }
    } catch {
      // silently skip if capsule recommendations fail
    }

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
      capsuleRecommendations,
    })
  }

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
    for (const cat of data.categories) {
      if (lower.includes(cat.name.toLowerCase()) || cat.name.toLowerCase().includes(lower)) {
        return cat.id
      }
    }
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
    if (!match) {
      setErrorMsg('Formato incorrecto. Usá: Q45 descripción — ej: Q85 almuerzo')
      setTimeout(() => setErrorMsg(null), 4000)
      return
    }
    const amount = parseFloat(match[1])
    const description = cleanTransactionName(match[2])
    const categoryId = matchCategory(description)
    const supabase = createClient()
    const { error } = await supabase.from('transactions').insert({
      household_id: data.householdId, amount, description,
      date: localToday(), source: 'manual',
      ...(categoryId ? { category_id: categoryId } : {}),
    })
    if (error) {
      setErrorMsg('No se pudo guardar el gasto. Intentá de nuevo.')
      setTimeout(() => setErrorMsg(null), 4000)
      return
    }
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3F5F9' }}>
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    )
  }

  const now = new Date()
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`

  return (
    <AppShell
      title="Dashboard"
      currentPath="/dashboard"
      userName={data.userName}
      householdName={data.household.name}
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <ChevronLeft style={{ width: 18, height: 18, color: '#7E93AE', cursor: 'pointer' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F', minWidth: 100, textAlign: 'center' }}>
            {monthLabel}
          </div>
          <ChevronRight style={{ width: 18, height: 18, color: '#7E93AE', cursor: 'pointer' }} />
        </div>
      }
    >
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
      {voiceResult && (
        <div style={{ marginTop: 12, padding: 14, background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1E40AF', marginBottom: 10 }}>Revisá antes de guardar</p>
          <TransactionPreview
            result={voiceResult}
            onConfirm={handleVoiceConfirm}
            onCancel={() => setVoiceResult(null)}
          />
        </div>
      )}

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
      <SmartAlert alert={data.alert} />

      {/* Quick add (mobile-oriented but works on desktop too) */}
      <div className="lg:hidden">
        <QuickAddBar
          onAdd={handleQuickAdd}
          onVoiceOverlay={() => setVoiceOverlayOpen(true)}
        />
      </div>

      {/* Transactions */}
      <div style={{ marginTop: 20 }}>
        <TransactionsList
          transactions={data.enrichedTransactions}
          onSeeAll={() => router.push('/transacciones')}
        />
      </div>

      {/* Streak */}
      <div style={{ marginTop: 12 }}>
        <StreakCard
          currentStreak={data.currentStreak}
          bestStreak={data.bestStreak}
          weekDays={data.weekDayStatus}
        />
      </div>

      {/* Aprende section (embedded in dashboard) */}
      {data.capsuleRecommendations.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 20,
          padding: '28px 32px 8px', marginTop: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpen style={{ width: 19, height: 19, color: '#2563EB' }} />
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 21, color: '#1E3A5F' }}>
                Aprende
              </div>
            </div>
            <Link href="/aprende" style={{ fontSize: 14, fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>
              Ver todo →
            </Link>
          </div>
          <div style={{ fontSize: 14, color: '#8B9AAE', marginBottom: 18 }}>
            Cápsulas recomendadas para mejorar tu puntaje
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
            {data.capsuleRecommendations.slice(0, 2).map((rec) => (
              <Link
                key={rec.capsule_id}
                href={`/aprende/${rec.module_slug}/${rec.slug}`}
                style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  background: '#F8F9FC', borderRadius: 14,
                  padding: '16px 18px', textDecoration: 'none',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 9,
                  background: '#fff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <BookOpen style={{ width: 18, height: 18, color: '#2563EB' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>
                    {rec.title}
                  </div>
                  <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 3 }}>
                    {rec.subtitle}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 12 }}>
                    <span style={{
                      color: '#2563EB', fontWeight: 600,
                      background: '#E9F0FF', padding: '3px 10px', borderRadius: 12,
                    }}>
                      {rec.module_title}
                    </span>
                    <span style={{ color: '#8B9AAE' }}>
                      {rec.read_time_minutes} min
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="h-6" />

      {/* FAB — fixed position, visible on all screens */}
      <div
        onClick={() => setExpenseSheetOpen(true)}
        style={{
          position: 'fixed', right: 20, zIndex: 30,
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          width: 56, height: 56, borderRadius: '50%',
          background: '#2563EB', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 24px rgba(37,99,235,0.35)', cursor: 'pointer',
        }}
      >
        <Plus style={{ width: 24, height: 24, color: '#fff' }} />
      </div>

      {/* Add expense bottom sheet */}
      <AddExpenseSheet
        open={expenseSheetOpen}
        onClose={() => setExpenseSheetOpen(false)}
        onScan={() => router.push('/capture')}
        onVoice={() => setVoiceOverlayOpen(true)}
        onManual={() => {
          const el = document.querySelector<HTMLInputElement>('[data-quick-add-input]')
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus() }
        }}
      />

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
