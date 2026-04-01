'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { localToday, localMonthStart, localDaysAgo, localMonth } from '@/lib/dates'
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
import { Loader2 } from 'lucide-react'

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
  budget: number
  householdId: string
  categories: BudgetCategory[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>(localMonth()) // YYYY-MM
  const router = useRouter()

  useEffect(() => { loadDashboardData(selectedMonth) }, [selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for voice overlay trigger from BottomNav
  useEffect(() => {
    const handler = () => setVoiceOverlayOpen(true)
    window.addEventListener('zafi:voice-overlay', handler)
    return () => window.removeEventListener('zafi:voice-overlay', handler)
  }, [])

  async function loadDashboardData(month?: string) {
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
    const currentMonth = localMonth()
    const viewMonth = month || currentMonth
    const isCurrentMonth = viewMonth === currentMonth

    // Calculate month start/end for the selected month
    const monthStart = viewMonth + '-01'
    const [yyyy, mm] = viewMonth.split('-').map(Number)
    const monthEndDate = new Date(yyyy, mm, 0) // last day of selected month
    const monthEnd = `${yyyy}-${String(mm).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`

    const weekStart = localDaysAgo(7)
    const today = localToday()

    const [profileRes, txMonthRes, categoriesRes, lastTxRes] = await Promise.all([
      supabase.from('financial_profiles').select('*').eq('household_id', hid).order('updated_at', { ascending: false }).limit(1).single(),
      supabase.from('transactions').select('*').eq('household_id', hid).gte('date', monthStart).lte('date', monthEnd).order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('household_id', hid),
      // Get last transaction globally (not just this month) for streak calculation
      supabase.from('transactions').select('date').eq('household_id', hid).order('date', { ascending: false }).limit(1).single(),
    ])

    const profile = profileRes.data as FinancialProfile | null
    const txMonth = (txMonthRes.data ?? []) as Transaction[]
    const categories = (categoriesRes.data ?? []) as BudgetCategory[]

    // Build category lookup map
    const categoryMap: Record<string, string> = {}
    categories.forEach((c) => { categoryMap[c.id] = c.name })

    const daysInMonth = monthEndDate.getDate()
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

    // Días sin registrar (para alerta) — usa la última transacción global, no solo del mes
    const lastTxDateGlobal = lastTxRes.data?.date || txMonth[0]?.date
    const daysSinceLast = lastTxDateGlobal
      ? Math.max(0, Math.floor((now.getTime() - new Date(lastTxDateGlobal + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)))
      : (isCurrentMonth ? 0 : -1) // No alert for past months or new users

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
      daysLeft, daysInMonth, alert, weekDayStatus, currentStreak, budget,
      householdId: hid,
      categories,
    })
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
    loadDashboardData(selectedMonth)
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
    loadDashboardData(selectedMonth)
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
      </div>
    )
  }

  const currentMonth = localMonth()
  const isViewingCurrent = selectedMonth === currentMonth

  // Generate month options (current + 11 previous months)
  const monthOptions: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
    monthOptions.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }

  function navigateMonth(dir: -1 | 1) {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + dir, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  return (
    <AppShell title="Dashboard" currentPath="/dashboard" userName={data.userName} householdName={data.household.name}>
      {/* Month selector */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '10px 16px 0',
      }}>
        <button
          onClick={() => navigateMonth(-1)}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#F1F5F9', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 15, fontWeight: 600, color: '#1E3A5F',
            textAlign: 'center', appearance: 'none',
            padding: '4px 8px',
          }}
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          onClick={() => navigateMonth(1)}
          disabled={isViewingCurrent}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: isViewingCurrent ? '#F8FAFC' : '#F1F5F9',
            border: 'none', cursor: isViewingCurrent ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isViewingCurrent ? 0.3 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {!isViewingCurrent && (
          <button
            onClick={() => setSelectedMonth(currentMonth)}
            style={{
              fontSize: 12, color: '#2563EB', background: '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 16,
              padding: '3px 10px', cursor: 'pointer', fontWeight: 500,
            }}
          >
            Hoy
          </button>
        )}
      </div>

      {/* Hero marino */}
      <StatusHero
        spent={data.spentMonth}
        budget={data.budget}
        daysLeft={data.daysLeft}
        userName={data.userName}
        score={data.healthScore}
        userInitials={data.userInitials}
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

      {/* Preview de voz (si hay) */}
      {voiceResult && (
        <div style={{ margin: '10px 16px 0', padding: 14, background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1E40AF', marginBottom: 10 }}>Revisá antes de guardar</p>
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
        onVoiceOverlay={() => setVoiceOverlayOpen(true)}
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
