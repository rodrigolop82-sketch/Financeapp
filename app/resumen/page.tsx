'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { localMonthStart } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { AppShell } from '@/components/layout/AppShell'
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react'
import {
  computeCategoryPace,
  summarizeMonth,
  type CategoryBudgetInput,
  type MonthContext,
  type CategoryPace,
  type MonthSummary,
} from '@/lib/resumen/pace'

type Tab = 'mes' | 'insights' | 'tendencias'

interface CategorySpend {
  name: string
  bucket: string
  amount: number
  prevAmount: number
}

interface BudgetCatRow {
  id: string
  name: string
  bucket: string
  budgeted_amount: number
  pace_mode: 'linear' | 'fixed'
  expected_day: number | null
}

interface ResumenData {
  userName: string
  householdName: string
  budget: number
  spentMonth: number
  daysLeft: number
  categories: CategorySpend[]
  spentPrevMonth: number
  monthlyAvg: number
  paceItems: CategoryPace[]
  monthSummary: MonthSummary
  monthCtx: MonthContext
  budgetCats: BudgetCatRow[]
  txMonth: Array<{ category_id: string; amount: number; description: string | null }>
}

const STATUS_COLORS: Record<string, { dot: string; pill: string; pillBg: string; label: string }> = {
  sobregiro: { dot: '#EF4444', pill: '#991B1B', pillBg: '#FEE2E2', label: 'Sobregiro' },
  riesgo:    { dot: '#F59E0B', pill: '#92400E', pillBg: '#FEF3C7', label: 'En riesgo' },
  en_linea:  { dot: '#22C55E', pill: '#065F46', pillBg: '#D1FAE5', label: 'En línea' },
  sin_gasto: { dot: '#94A3B8', pill: '#64748B', pillBg: '#F1F5F9', label: 'Sin gasto' },
}

export default function ResumenPage() {
  const [data, setData] = useState<ResumenData | null>(null)
  const [tab, setTab] = useState<Tab>('mes')
  const [loading, setLoading] = useState(true)
  const [showNoSpend, setShowNoSpend] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userProfile } = await supabase
        .from('users').select('full_name').eq('id', user.id).single()

      const { data: household } = await supabase
        .from('households').select('*').eq('owner_id', user.id).limit(1).single()

      if (!household) { router.push('/onboarding'); return }
      const hid = household.id as string

      const now = new Date()
      const monthStart = localMonthStart()
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const dayOfMonth = now.getDate()
      const daysLeft = daysInMonth - dayOfMonth

      const [txMonthRes, categoriesRes, txPrevRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('household_id', hid).gte('date', monthStart),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
        supabase.from('transactions').select('*').eq('household_id', hid).gte('date', prevMonthStart).lte('date', prevMonthEnd),
      ])

      const txMonth = txMonthRes.data ?? []
      const txPrev = txPrevRes.data ?? []
      const cats = (categoriesRes.data ?? []) as BudgetCatRow[]

      const catMap: Record<string, BudgetCatRow> = {}
      cats.forEach((c) => { catMap[c.id] = c })

      const spentByCat: Record<string, number> = {}
      const bucketByCat: Record<string, string> = {}
      txMonth.forEach((t: { category_id: string; amount: number }) => {
        const info = catMap[t.category_id]
        const name = info?.name ?? 'Otros'
        spentByCat[name] = (spentByCat[name] ?? 0) + Number(t.amount)
        if (info) bucketByCat[name] = info.bucket
      })

      const prevByCat: Record<string, number> = {}
      txPrev.forEach((t: { category_id: string; amount: number }) => {
        const info = catMap[t.category_id]
        const name = info?.name ?? 'Otros'
        prevByCat[name] = (prevByCat[name] ?? 0) + Number(t.amount)
        if (info) bucketByCat[name] = info.bucket
      })

      const allCatNames = Array.from(new Set([...Object.keys(spentByCat), ...Object.keys(prevByCat)]))
      const categories: CategorySpend[] = allCatNames.map(name => ({
        name,
        bucket: bucketByCat[name] ?? '',
        amount: spentByCat[name] ?? 0,
        prevAmount: prevByCat[name] ?? 0,
      })).sort((a, b) => b.amount - a.amount)

      const spentMonth = txMonth.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
      const spentPrevMonth = txPrev.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)

      const totalBudget = cats.reduce((s, c) => s + Number(c.budgeted_amount), 0)

      // Build pace items for each budget category
      const spentByCatId: Record<string, number> = {}
      txMonth.forEach((t: { category_id: string; amount: number }) => {
        spentByCatId[t.category_id] = (spentByCatId[t.category_id] ?? 0) + Number(t.amount)
      })

      const monthCtx: MonthContext = { today: now, daysInMonth, dayOfMonth }

      const paceInputs: CategoryBudgetInput[] = cats.map(c => ({
        categoryId: c.id,
        name: c.name,
        budget: Number(c.budgeted_amount),
        spent: spentByCatId[c.id] ?? 0,
        paceMode: c.pace_mode || 'linear',
        expectedDay: c.expected_day,
      }))

      const paceItems = paceInputs.map(input => computeCategoryPace(input, monthCtx))
      const monthSummary = summarizeMonth(paceItems, monthCtx)

      const fullName = (userProfile?.full_name || 'Usuario') as string
      const firstName = fullName.split(' ')[0]

      setData({
        userName: firstName,
        householdName: household.name ?? '',
        budget: totalBudget,
        spentMonth,
        daysLeft,
        categories,
        spentPrevMonth,
        monthlyAvg: Math.round((spentMonth + spentPrevMonth) / 2),
        paceItems,
        monthSummary,
        monthCtx,
        budgetCats: cats,
        txMonth: txMonth.map((t: { category_id: string; amount: number; description: string | null }) => ({
          category_id: t.category_id,
          amount: Number(t.amount),
          description: t.description,
        })),
      })
      setLoading(false)
    }
    load()
  }, [router])

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3F5F9' }}>
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    )
  }

  const diff = data.spentMonth - data.spentPrevMonth
  const diffPct = data.spentPrevMonth > 0
    ? Math.round(Math.abs(diff) / data.spentPrevMonth * 100)
    : 0

  const tabStyle = (t: Tab) => ({
    padding: '10px 22px', borderRadius: 10,
    fontWeight: 600 as const, fontSize: '14.5px', cursor: 'pointer' as const,
    background: tab === t ? '#fff' : 'transparent',
    color: tab === t ? '#1E3A5F' : '#7E93AE',
    boxShadow: tab === t ? '0 1px 3px rgba(30,58,95,0.15)' : 'none',
    border: 'none', fontFamily: 'inherit',
  })

  const { monthSummary: ms, paceItems, monthCtx } = data
  const pctBar = ms.totalBudget > 0 ? Math.min(1, ms.totalSpent / ms.totalBudget) : 0
  const expectedMark = ms.totalBudget > 0 ? Math.min(1, ms.totalExpected / ms.totalBudget) : 0

  // Sort pace items: sobregiro → riesgo → en_linea → sin_gasto
  const statusOrder: Record<string, number> = { sobregiro: 0, riesgo: 1, en_linea: 2, sin_gasto: 3 }
  const sortedPace = [...paceItems].sort((a, b) => {
    const orderDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    if (orderDiff !== 0) return orderDiff
    if (a.status === 'sobregiro') return b.overrun - a.overrun
    return b.spent - a.spent
  })

  const withSpend = sortedPace.filter(p => p.status !== 'sin_gasto' || (p.paceMode === 'fixed' && monthCtx.dayOfMonth < (data.budgetCats.find(c => c.id === p.categoryId)?.expected_day ?? 1)))
  const noSpend = sortedPace.filter(p => p.status === 'sin_gasto' && !(p.paceMode === 'fixed' && monthCtx.dayOfMonth < (data.budgetCats.find(c => c.id === p.categoryId)?.expected_day ?? 1)))
  const noSpendBudgetSum = noSpend.reduce((s, p) => s + p.budget, 0)

  // Find largest transaction per category for semaphore copy
  function largestTxForCategory(catId: string): { amount: number; description: string } | null {
    const catTxs = data!.txMonth.filter(t => t.category_id === catId)
    if (catTxs.length === 0) return null
    const sorted = [...catTxs].sort((a, b) => b.amount - a.amount)
    return { amount: sorted[0].amount, description: sorted[0].description ?? '' }
  }

  const verdictColor = ms.verdict.tone === 'danger' ? '#EF4444' : ms.verdict.tone === 'warn' ? '#F59E0B' : '#22C55E'
  const barColor = ms.totalSpent > ms.totalBudget ? '#EF4444' : '#2563EB'

  return (
    <AppShell title="Resumen" currentPath="/resumen" userName={data.userName} householdName={data.householdName}>
      {/* Tabs */}
      <div style={{
        display: 'flex', background: '#E7EBF2', borderRadius: 13,
        padding: 4, marginBottom: 24, width: 'fit-content',
      }}>
        <button style={tabStyle('mes')} onClick={() => setTab('mes')}>Este mes</button>
        <button style={tabStyle('insights')} onClick={() => setTab('insights')}>Insights</button>
        <button style={tabStyle('tendencias')} onClick={() => setTab('tendencias')}>Tendencias</button>
      </div>

      {/* === ESTE MES === */}
      {tab === 'mes' && (
        <>
          {/* 3.1 Estado del mes (hero) */}
          <div style={{
            background: '#1E3A5F', borderRadius: 20,
            padding: '32px 36px', color: '#fff', marginBottom: 20,
          }}>
            <div style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 22, lineHeight: 1.3, marginBottom: 4,
            }}>
              {ms.verdict.tone === 'danger' ? (
                <>
                  Vas <span style={{ color: '#EF4444', fontFamily: "'Outfit', sans-serif", fontWeight: 800 }}>{formatMoney(ms.totalOverrun)}</span> arriba del presupuesto en {ms.overCategories.length} categoría{ms.overCategories.length !== 1 ? 's' : ''}
                </>
              ) : (
                ms.verdict.headline
              )}
            </div>
            <div style={{ fontSize: 14, color: '#9FB3CB', marginBottom: 20 }}>
              {ms.verdict.sub}
            </div>

            {/* Pace bar */}
            <div style={{ position: 'relative', height: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 7, marginBottom: 12 }}>
              <div style={{
                width: `${pctBar * 100}%`, height: '100%', borderRadius: 7,
                background: barColor, transition: 'width 0.3s',
              }} />
              <div style={{
                position: 'absolute', top: -4, left: `${expectedMark * 100}%`,
                width: 2, height: 22, background: '#fff', borderRadius: 1, opacity: 0.7,
              }} />
            </div>
            <div style={{ fontSize: 13, color: '#9FB3CB' }}>
              {formatMoney(ms.totalSpent)} gastados de {formatMoney(ms.totalBudget)} · esperado a hoy: {formatMoney(ms.totalExpected)}
            </div>

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9FB3CB', textTransform: 'uppercase' }}>Gastado</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4 }}>{formatMoney(ms.totalSpent)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#FCA5A5', textTransform: 'uppercase' }}>Sobregiro</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4, color: ms.totalOverrun > 0 ? '#FCA5A5' : '#fff' }}>
                  {formatMoney(ms.totalOverrun)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#4ADE80', textTransform: 'uppercase' }}>Disponible</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4, color: '#4ADE80' }}>
                  {formatMoney(ms.available)}
                </div>
              </div>
            </div>
          </div>

          {/* 3.2 Semáforo */}
          {(ms.overCategories.length > 0 || ms.riskCategories.length > 0) && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16 }}>
                Necesita atención
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ms.overCategories.map(cat => {
                  const largest = largestTxForCategory(cat.categoryId)
                  const bigExplains = largest && cat.overrun > 0 && largest.amount >= 0.6 * cat.overrun
                  return (
                    <div key={cat.categoryId} style={{
                      background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12,
                      padding: '14px 18px', fontSize: 14, color: '#991B1B',
                    }}>
                      <strong>{cat.name}</strong> ya superó el presupuesto por {formatMoney(cat.overrun)}.{bigExplains ? ' Una compra explica casi todo.' : ''}
                    </div>
                  )
                })}
                {ms.riskCategories.map(cat => (
                  <div key={cat.categoryId} style={{
                    background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12,
                    padding: '14px 18px', fontSize: 14, color: '#92400E',
                  }}>
                    <strong>{cat.name}</strong> va al {Math.round(cat.pctOfBudget * 100)}% con {Math.round(cat.pctOfMonthElapsed * 100)}% del mes transcurrido. A este ritmo cerrarías en {formatMoney(cat.projection)}.
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Va bien */}
          {ms.okCategories.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16 }}>
                Va bien
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ms.okCategories.slice(0, 3).map(cat => {
                  const catRow = data.budgetCats.find(c => c.id === cat.categoryId)
                  const isPaidFixed = catRow?.pace_mode === 'fixed' && cat.spent > 0 && monthCtx.dayOfMonth >= (catRow?.expected_day ?? 1)
                  return (
                    <div key={cat.categoryId} style={{
                      background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 12,
                      padding: '14px 18px', fontSize: 14, color: '#065F46',
                    }}>
                      {isPaidFixed
                        ? <><strong>{cat.name}</strong> pagado según lo previsto.</>
                        : <><strong>{cat.name}</strong> va al {Math.round(cat.pctOfBudget * 100)}% con {Math.round(cat.pctOfMonthElapsed * 100)}% del mes transcurrido.</>
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3.3 Presupuesto por categoría */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px' }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 4,
            }}>
              Presupuesto por categoría
            </div>
            <div style={{ fontSize: 13, color: '#8B9AAE', marginBottom: 20 }}>
              Toca una categoría para ver sus transacciones
            </div>

            {withSpend.map(cat => {
              const catRow = data.budgetCats.find(c => c.id === cat.categoryId)
              const sc = STATUS_COLORS[cat.status] ?? STATUS_COLORS.en_linea
              const barPct = cat.budget > 0 ? Math.min(1, cat.spent / cat.budget) : (cat.spent > 0 ? 1 : 0)
              const expectedPct = cat.budget > 0 ? Math.min(1, cat.expected / cat.budget) : 0
              const isPendingFixed = catRow?.pace_mode === 'fixed' && cat.spent === 0 && monthCtx.dayOfMonth < (catRow?.expected_day ?? 1)

              return (
                <div
                  key={cat.categoryId}
                  onClick={() => router.push(`/resumen/categoria/${cat.categoryId}?mes=${monthCtx.today.getFullYear()}-${String(monthCtx.today.getMonth() + 1).padStart(2, '0')}`)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '16px 0', borderTop: '1px solid #EEF1F6', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F', flex: 1 }}>{cat.name}</span>
                    {isPendingFixed ? (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                        background: '#F1F5F9', color: '#64748B',
                      }}>
                        Pendiente · día {catRow?.expected_day}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                        background: sc.pillBg, color: sc.pill,
                      }}>
                        {sc.label}
                      </span>
                    )}
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E3A5F', minWidth: 80, textAlign: 'right' }}>
                      {formatMoney(cat.spent)}
                    </span>
                    <ChevronRight style={{ width: 16, height: 16, color: '#94A3B8', flexShrink: 0 }} />
                  </div>

                  {/* Bar */}
                  <div style={{ marginLeft: 18, position: 'relative', height: 8, background: '#F3F5F9', borderRadius: 4 }}>
                    <div style={{
                      width: `${barPct * 100}%`, height: '100%', borderRadius: 4,
                      background: cat.status === 'sobregiro' ? '#EF4444' : cat.status === 'riesgo' ? '#F59E0B' : '#2563EB',
                    }} />
                    {cat.budget > 0 && (
                      <div style={{
                        position: 'absolute', top: -2, left: `${expectedPct * 100}%`,
                        width: 2, height: 12, background: '#1E3A5F', borderRadius: 1, opacity: 0.4,
                      }} />
                    )}
                  </div>

                  {/* Bottom line */}
                  <div style={{ marginLeft: 18, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8B9AAE' }}>
                    <span>de {formatMoney(cat.budget)} · {Math.round(cat.pctOfBudget * 100)}%</span>
                    {cat.status === 'sobregiro' ? (
                      <span style={{ color: '#EF4444', fontWeight: 600 }}>+{formatMoney(cat.overrun)}</span>
                    ) : (
                      <span>quedan {formatMoney(cat.remaining)}</span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Collapsible no-spend categories */}
            {noSpend.length > 0 && (
              <>
                <button
                  onClick={() => setShowNoSpend(!showNoSpend)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '14px 0', borderTop: '1px solid #EEF1F6',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#64748B', fontWeight: 600,
                    fontFamily: 'inherit',
                  }}
                >
                  <ChevronDown style={{
                    width: 16, height: 16,
                    transform: showNoSpend ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }} />
                  Ver {noSpend.length} categorías sin movimiento ({formatMoney(noSpendBudgetSum)} presupuestados)
                </button>
                {showNoSpend && noSpend.map(cat => (
                  <div
                    key={cat.categoryId}
                    onClick={() => router.push(`/resumen/categoria/${cat.categoryId}?mes=${monthCtx.today.getFullYear()}-${String(monthCtx.today.getMonth() + 1).padStart(2, '0')}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 0', borderTop: '1px solid #EEF1F6', cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94A3B8', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: '#64748B', flex: 1 }}>{cat.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                      background: '#F1F5F9', color: '#64748B',
                    }}>
                      Sin gasto
                    </span>
                    <span style={{ fontSize: 13, color: '#94A3B8' }}>{formatMoney(cat.budget)}</span>
                    <ChevronRight style={{ width: 16, height: 16, color: '#94A3B8', flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* === INSIGHTS === */}
      {tab === 'insights' && (
        <>
          <div style={{
            background: '#1E3A5F', borderRadius: 20,
            padding: '32px 36px', color: '#fff', marginBottom: 20,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#9FB3CB', textTransform: 'uppercase', marginBottom: 16,
            }}>
              Comparado con el mes anterior
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 44 }}>
                {formatMoney(data.spentMonth)}
              </div>
              <div style={{
                background: diff <= 0 ? 'rgba(22,101,52,0.2)' : 'rgba(239,68,68,0.2)',
                color: diff <= 0 ? '#4ADE80' : '#FCA5A5',
                fontWeight: 700, fontSize: 14,
                padding: '8px 16px', borderRadius: 20,
              }}>
                {diff <= 0 ? '↓' : '↑'} {diffPct}% vs mes anterior
              </div>
            </div>
            <div style={{ display: 'flex', gap: 56, marginTop: 24 }}>
              <div>
                <div style={{ fontSize: 13, color: '#9FB3CB' }}>Este mes</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 4 }}>
                  {formatMoney(data.spentMonth)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#9FB3CB' }}>Mes anterior</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 4 }}>
                  {formatMoney(data.spentPrevMonth)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#9FB3CB' }}>Diferencia</div>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 4,
                  color: diff <= 0 ? '#4ADE80' : '#FCA5A5',
                }}>
                  {formatMoney(Math.abs(diff))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px' }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Desglose por categoría
            </div>
            {data.categories.map((cat) => {
              const catDiff = cat.amount - cat.prevAmount
              const catPct = cat.prevAmount > 0 ? Math.round(Math.abs(catDiff) / cat.prevAmount * 100) : 0
              const isSavings = cat.bucket === 'savings'
              const isPositive = isSavings ? catDiff >= 0 : catDiff <= 0
              return (
                <div key={cat.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 0', borderTop: '1px solid #EEF1F6',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F' }}>{cat.name}</div>
                      {cat.prevAmount > 0 && (
                        <div style={{
                          fontSize: '12.5px', fontWeight: 700,
                          color: isPositive ? '#16A34A' : '#DC2626',
                          background: isPositive ? '#EAFBF1' : '#FEE2E2',
                          padding: '3px 9px', borderRadius: 12,
                        }}>
                          {catDiff <= 0 ? '↓' : '↑'} {catPct}%
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E3A5F' }}>
                        {formatMoney(cat.amount)}
                      </div>
                      {cat.prevAmount > 0 && (
                        <div style={{ fontSize: 13, color: '#8B9AAE' }}>
                          ant: {formatMoney(cat.prevAmount)}
                        </div>
                      )}
                    </div>
                  </div>
                  <svg width="90" height="36" viewBox="0 0 90 36" fill="none">
                    <polyline
                      points={`0,${30 - Math.random() * 20} 15,${30 - Math.random() * 20} 30,${30 - Math.random() * 20} 45,${30 - Math.random() * 20} 60,${30 - Math.random() * 20} 75,${30 - Math.random() * 20} 90,${30 - Math.random() * 20}`}
                      stroke={isPositive ? '#16A34A' : '#EF4444'}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* === TENDENCIAS === */}
      {tab === 'tendencias' && (
        <>
          <div style={{
            background: '#1E3A5F', borderRadius: 20,
            padding: '32px 36px', color: '#fff', marginBottom: 20,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#9FB3CB', textTransform: 'uppercase', marginBottom: 12,
            }}>
              Promedio mensual (últimos meses)
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 44 }}>
              {formatMoney(data.monthlyAvg)}
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Donut chart */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px' }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 20,
              }}>
                Gasto fijo vs variable
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <svg width="180" height="180" viewBox="0 0 180 180">
                  <circle cx="90" cy="90" r="70" fill="none" stroke="#2563EB" strokeWidth="26" />
                  <circle cx="90" cy="90" r="70" fill="none" stroke="#F59E0B"
                    strokeWidth="26" strokeDasharray="140 440" strokeDashoffset="-300"
                    transform="rotate(-90 90 90)" />
                </svg>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1E3A5F' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                  Fijo 68%
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1E3A5F' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                  Variable 32%
                </div>
              </div>
            </div>

            {/* Line chart placeholder */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px' }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 20,
              }}>
                Evolución mensual
              </div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                  <span style={{ width: 14, height: 2, background: '#2563EB', display: 'inline-block' }} />Total
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                  <span style={{ width: 14, height: 2, background: '#16A34A', display: 'inline-block' }} />Fijo
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                  <span style={{ width: 14, height: 2, background: '#F59E0B', display: 'inline-block' }} />Variable
                </div>
              </div>
              <svg width="100%" height="200" viewBox="0 0 380 200" preserveAspectRatio="none">
                <line x1="0" y1="160" x2="380" y2="160" stroke="#EEF1F6" strokeWidth="1" />
                <line x1="0" y1="110" x2="380" y2="110" stroke="#EEF1F6" strokeWidth="1" />
                <line x1="0" y1="60" x2="380" y2="60" stroke="#EEF1F6" strokeWidth="1" />
                <path d="M10,158 L86,110 L162,40 L238,32 L314,70 L370,158" fill="none" stroke="#2563EB" strokeWidth="2.5" />
                <path d="M10,158 L86,120 L162,72 L238,68 L314,60 L370,90" fill="none" stroke="#16A34A" strokeWidth="2" strokeDasharray="5 4" />
                <path d="M10,158 L86,145 L162,120 L238,90 L314,130 L370,158" fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="5 4" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8B9AAE', marginTop: 6 }}>
                <span>Feb</span><span>Mar</span><span>Abr</span><span>May</span><span>Jun</span><span>Jul</span>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          {(() => {
            const expenseAlerts = data.categories.filter(c => c.bucket !== 'savings' && c.amount > 0 && c.prevAmount > 0 && c.amount > c.prevAmount * 1.15)
            const savingsPositive = data.categories.filter(c => c.bucket === 'savings' && c.amount > 0 && c.prevAmount > 0 && c.amount > c.prevAmount * 1.15)
            if (expenseAlerts.length === 0 && savingsPositive.length === 0) return null
            return (
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', marginBottom: 20 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16,
              }}>
                Observaciones
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {savingsPositive.slice(0, 2).map(c => (
                  <div key={c.name} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#EAFBF1', border: '1px solid #B7EBC8',
                    borderRadius: 12, padding: '14px 18px',
                    fontSize: '14.5px', color: '#065F46',
                  }}>
                    <span>✓</span>
                    {c.name} subió {Math.round((c.amount - c.prevAmount) / c.prevAmount * 100)}% vs el mes anterior. ¡Buen ritmo de ahorro!
                  </div>
                ))}
                {expenseAlerts.slice(0, 4).map(c => (
                  <div key={c.name} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#FDEEEE', border: '1px solid #F6D3D3',
                    borderRadius: 12, padding: '14px 18px',
                    fontSize: '14.5px', color: '#9A3B3B',
                  }}>
                    <span>⚠</span>
                    {c.name} subió {Math.round((c.amount - c.prevAmount) / c.prevAmount * 100)}% vs el mes anterior. Considerá reducirlo.
                  </div>
                ))}
              </div>
            </div>
            )
          })()}

          {/* Category bars */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px' }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16,
            }}>
              Categorías
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, fontSize: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1E3A5F' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                Necesidades
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1E3A5F' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                Deseos
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1E3A5F' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                Ahorro
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {data.categories.filter(c => c.amount > 0).map(c => {
                const totalSpent = data.spentMonth || 1
                const pct = Math.round(c.amount / totalSpent * 100)
                const barPct = Math.max(pct, 3)
                return (
                  <div key={c.name} style={{
                    display: 'grid', gridTemplateColumns: '130px 1fr 90px 56px',
                    alignItems: 'center', gap: 14,
                  }}>
                    <div style={{ fontSize: 14, color: '#1E3A5F', textAlign: 'right' }}>{c.name}</div>
                    <div style={{ height: 22, borderRadius: 6, overflow: 'hidden', background: '#F3F5F9' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: '#2563EB', borderRadius: 6 }} />
                    </div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: '#1E3A5F' }}>
                      {formatMoney(c.amount)}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#8B9AAE', textAlign: 'right' }}>
                      {pct}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div className="h-6" />
    </AppShell>
  )
}
