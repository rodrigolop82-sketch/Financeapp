'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { StatusHero } from '@/components/dashboard/StatusHero'
import { QuickAddBar } from '@/components/dashboard/QuickAddBar'
import { SummaryRow } from '@/components/dashboard/SummaryRow'
import { SmartAlert, buildSmartAlert } from '@/components/dashboard/SmartAlert'
import { TransactionsList } from '@/components/dashboard/TransactionsList'
import { StreakCard } from '@/components/dashboard/StreakCard'
import { TransactionPreview } from '@/components/voice/TransactionPreview'
import type { VoiceExtractionResult } from '@/types'

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => { loadDashboardData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDashboardData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    const [profileRes, txMonthRes, categoriesRes] = await Promise.all([
      supabase.from('financial_profiles').select('*').eq('household_id', user.id).single(),
      supabase.from('transactions').select('*').eq('household_id', user.id).gte('date', monthStart).order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('household_id', user.id),
    ])

    const profile = profileRes.data
    const txMonth = txMonthRes.data ?? []
    const categories = categoriesRes.data ?? []

    // Build category lookup map
    const categoryMap: Record<string, string> = {}
    categories.forEach((c: any) => { categoryMap[c.id] = c.name })

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysLeft = daysInMonth - now.getDate()

    const spentMonth = txMonth.reduce((s: number, t: any) => s + Number(t.amount), 0)
    const spentToday = txMonth.filter((t: any) => t.date === today).reduce((s: number, t: any) => s + Number(t.amount), 0)
    const spentWeek  = txMonth.filter((t: any) => t.date >= weekStart).reduce((s: number, t: any) => s + Number(t.amount), 0)
    const todayCount = txMonth.filter((t: any) => t.date === today).length

    // Enrich transactions with category name for display
    const enrichedTransactions = txMonth.map((t: any) => ({
      id: t.id,
      description: t.description,
      category: categoryMap[t.category_id] ?? 'Otros',
      amount: Number(t.amount),
      date: t.date,
      source: t.source ?? 'manual',
    }))

    // Calcular categoría más sobregirada
    const spentByCat: Record<string, number> = {}
    txMonth.forEach((t: any) => { spentByCat[t.category_id] = (spentByCat[t.category_id] ?? 0) + Number(t.amount) })
    let topOver: { name: string; spent: number; limit: number; pctOver: number } | undefined = undefined
    categories.forEach((c: any) => {
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
    const txDates = new Set(txMonth.map((t: any) => t.date))
    let currentStreak = 0
    const checkDate = new Date(now)
    // Si hoy tiene gastos, contarlo; si no, empezar desde ayer
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
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1  // Lun=0
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
      profile, enrichedTransactions, spentMonth, spentToday, spentWeek, todayCount,
      daysLeft, daysInMonth, alert, weekDayStatus, currentStreak, budget,
      householdId: user.id,
    })
  }

  // Input de texto rápido — parseo básico "Q45 Starbucks"
  async function handleQuickAdd(text: string) {
    const match = text.match(/^Q?\s*(\d+(?:\.\d+)?)\s+(.+)$/i)
    if (!match) return
    const amount = parseFloat(match[1])
    const description = match[2].trim()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').insert({
      household_id: user.id, amount, description,
      date: new Date().toISOString().split('T')[0], source: 'manual',
    })
    setSuccessMsg(`Q ${amount} "${description}" guardado`)
    setTimeout(() => setSuccessMsg(null), 3000)
    loadDashboardData()
  }

  function handleVoiceConfirmed(saved: number) {
    setVoiceResult(null)
    setSuccessMsg(`${saved} gasto${saved > 1 ? 's' : ''} guardado${saved > 1 ? 's' : ''}`)
    setTimeout(() => setSuccessMsg(null), 3000)
    loadDashboardData()
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontSize: 13, color: '#94A3B8' }}>Cargando...</div>
      </div>
    )
  }

  return (
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
            householdId={data.householdId}
            onConfirmed={handleVoiceConfirmed}
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
  )
}
