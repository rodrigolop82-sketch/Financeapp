'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/format'
import { cleanTransactionName } from '@/lib/format'
import { AppShell } from '@/components/layout/AppShell'
import { Loader2, ArrowLeft } from 'lucide-react'
import {
  computeCategoryPace,
  type MonthContext,
  type CategoryPace,
} from '@/lib/resumen/pace'

type SortMode = 'monto' | 'fecha' | 'comercio'

interface TxRow {
  id: string
  amount: number
  description: string
  date: string
  payment_method: string
  source: string
}

interface MerchantGroup {
  merchant: string
  total: number
  count: number
  txs: TxRow[]
}

interface HistMonth {
  month: string
  label: string
  total: number
}

export default function CategoriaDetallePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const categoryId = params.categoryId as string
  const mes = searchParams.get('mes') || ''

  const [loading, setLoading] = useState(true)
  const [categoryName, setCategoryName] = useState('')
  const [pace, setPace] = useState<CategoryPace | null>(null)
  const [monthCtx, setMonthCtx] = useState<MonthContext | null>(null)
  const [txs, setTxs] = useState<TxRow[]>([])
  const [sort, setSort] = useState<SortMode>('monto')
  const [expandedMerchants, setExpandedMerchants] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<HistMonth[]>([])
  const [budget, setBudget] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: household } = await supabase
        .from('households').select('id').eq('owner_id', user.id).limit(1).single()
      if (!household) { router.push('/onboarding'); return }
      const hid = household.id as string

      const { data: cat } = await supabase
        .from('budget_categories').select('*').eq('id', categoryId).single()
      if (!cat) { router.push('/resumen'); return }

      setCategoryName(cat.name)
      setBudget(Number(cat.budgeted_amount))

      const now = new Date()
      let year = now.getFullYear()
      let month = now.getMonth()
      if (mes) {
        const [y, m] = mes.split('-').map(Number)
        if (y && m) { year = y; month = m - 1 }
      }

      const monthStart = new Date(year, month, 1).toISOString().slice(0, 10)
      const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10)
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
      const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth

      const mCtx: MonthContext = { today: now, daysInMonth, dayOfMonth }
      setMonthCtx(mCtx)

      const { data: monthTxs } = await supabase
        .from('transactions')
        .select('id, amount, description, date, payment_method, source')
        .eq('household_id', hid)
        .eq('category_id', categoryId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('amount', { ascending: false })

      const transactions: TxRow[] = (monthTxs ?? []).map((t: Record<string, unknown>) => ({
        id: t.id as string,
        amount: Number(t.amount),
        description: (t.description as string) || '',
        date: t.date as string,
        payment_method: (t.payment_method as string) || 'efectivo',
        source: (t.source as string) || 'manual',
      }))
      setTxs(transactions)

      const spent = transactions.reduce((s, t) => s + t.amount, 0)
      const paceResult = computeCategoryPace({
        categoryId,
        name: cat.name,
        budget: Number(cat.budgeted_amount),
        spent,
        paceMode: cat.pace_mode || 'linear',
        expectedDay: cat.expected_day,
      }, mCtx)
      setPace(paceResult)

      // History: last 3 complete months
      const histMonths: HistMonth[] = []
      for (let i = 1; i <= 3; i++) {
        const hm = new Date(year, month - i, 1)
        const hmEnd = new Date(year, month - i + 1, 0)
        const { data: hTxs } = await supabase
          .from('transactions')
          .select('amount')
          .eq('household_id', hid)
          .eq('category_id', categoryId)
          .gte('date', hm.toISOString().slice(0, 10))
          .lte('date', hmEnd.toISOString().slice(0, 10))

        const total = (hTxs ?? []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
        const label = hm.toLocaleDateString('es-GT', { month: 'short', year: 'numeric' })
        histMonths.push({ month: hm.toISOString().slice(0, 7), label, total })
      }
      setHistory(histMonths)

      setLoading(false)
    }
    load()
  }, [router, categoryId, mes])

  if (loading || !pace || !monthCtx) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3F5F9' }}>
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    )
  }

  const monthLabel = (() => {
    if (!mes) return new Date().toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
    const [y, m] = mes.split('-').map(Number)
    return new Date(y, m - 1).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
  })()

  const barPct = pace.budget > 0 ? Math.min(1, pace.spent / pace.budget) : (pace.spent > 0 ? 1 : 0)
  const expectedPct = pace.budget > 0 ? Math.min(1, pace.expected / pace.budget) : 0
  const barColor = pace.status === 'sobregiro' ? '#EF4444' : pace.status === 'riesgo' ? '#F59E0B' : '#2563EB'

  // Overrun explanation
  let overrunExplanation: string | null = null
  if (pace.status === 'sobregiro' && pace.overrun > 0) {
    const sorted = [...txs].sort((a, b) => b.amount - a.amount)
    const largest = sorted[0]
    if (largest && largest.amount >= 0.6 * pace.overrun) {
      const pct = Math.round((largest.amount / pace.overrun) * 100)
      const remaining = pace.spent - largest.amount
      const withinBudget = remaining <= pace.budget
      const merchant = cleanTransactionName(largest.description) || 'una compra'
      const dateStr = new Date(largest.date).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
      overrunExplanation = `La compra en ${merchant} (${formatMoney(largest.amount)}) del ${dateStr} es el ${pct}% del sobregiro. Sin ella, estarías en ${formatMoney(remaining)} — ${withinBudget ? 'dentro del presupuesto' : `aún ${formatMoney(remaining - pace.budget)} arriba`}.`
    } else {
      // Group by merchant
      const merchantMap: Record<string, number> = {}
      txs.forEach(t => {
        const m = cleanTransactionName(t.description) || 'Sin nombre'
        merchantMap[m] = (merchantMap[m] ?? 0) + t.amount
      })
      const merchantEntries = Object.entries(merchantMap).sort((a, b) => b[1] - a[1])
      const topMerchant = merchantEntries[0]
      if (topMerchant && topMerchant[1] >= 0.6 * pace.overrun) {
        const count = txs.filter(t => (cleanTransactionName(t.description) || 'Sin nombre') === topMerchant[0]).length
        const pct = Math.round((topMerchant[1] / pace.overrun) * 100)
        overrunExplanation = `${count} compras en ${topMerchant[0]} suman ${formatMoney(topMerchant[1])}, el ${pct}% del sobregiro.`
      } else {
        overrunExplanation = `No hay una compra dominante: el sobregiro viene de ${txs.length} transacciones de tamaño similar.`
      }
    }
  }

  // Dominant transaction for highlighting
  const dominantTxId = (() => {
    if (pace.status !== 'sobregiro' || pace.overrun <= 0) return null
    const sorted = [...txs].sort((a, b) => b.amount - a.amount)
    const largest = sorted[0]
    if (largest && largest.amount >= 0.6 * pace.overrun) return largest.id
    return null
  })()

  // Sort/group
  const sortedTxs = [...txs].sort((a, b) => {
    if (sort === 'monto') return b.amount - a.amount
    if (sort === 'fecha') return new Date(b.date).getTime() - new Date(a.date).getTime()
    return (cleanTransactionName(a.description)).localeCompare(cleanTransactionName(b.description))
  })

  const merchantGroups: MerchantGroup[] = (() => {
    if (sort !== 'comercio') return []
    const map: Record<string, MerchantGroup> = {}
    txs.forEach(t => {
      const m = cleanTransactionName(t.description) || 'Sin nombre'
      if (!map[m]) map[m] = { merchant: m, total: 0, count: 0, txs: [] }
      map[m].total += t.amount
      map[m].count++
      map[m].txs.push(t)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  const sourceLabel = (pm: string) => {
    if (pm === 'tarjeta') return 'Tarjeta'
    if (pm === 'transferencia') return 'Transferencia'
    if (pm === 'cheque') return 'Cheque'
    return 'Efectivo'
  }

  // History
  const histAvg = history.length > 0 ? history.reduce((s, h) => s + h.total, 0) / history.length : 0
  const histAvgLabel = history.length >= 2 ? `${history[history.length - 1].label} – ${history[0].label}` : ''
  const budgetBelowAvg = budget > 0 && histAvg > 0 && budget < histAvg * 0.9
  const suggestedBudget = Math.ceil(histAvg / 100) * 100

  return (
    <AppShell title={categoryName} currentPath="/resumen">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Back button */}
        <button
          onClick={() => router.push('/resumen')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: '#64748B', fontWeight: 600,
            marginBottom: 16, fontFamily: 'inherit',
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Resumen
        </button>

        {/* 4.1 Header card */}
        <div style={{
          background: '#1E3A5F', borderRadius: 20,
          padding: '28px 32px', color: '#fff', marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, color: '#9FB3CB', marginBottom: 4 }}>
            {monthLabel} · día {monthCtx.dayOfMonth} de {monthCtx.daysInMonth}
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 40, marginBottom: 4 }}>
            {formatMoney(pace.spent)}
          </div>
          <div style={{ fontSize: 14, color: '#9FB3CB', marginBottom: 16 }}>
            de {formatMoney(pace.budget)} presupuestados
          </div>

          {/* Bar */}
          <div style={{ position: 'relative', height: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 5, marginBottom: 16 }}>
            <div style={{
              width: `${barPct * 100}%`, height: '100%', borderRadius: 5, background: barColor,
            }} />
            {pace.budget > 0 && (
              <div style={{
                position: 'absolute', top: -3, left: `${expectedPct * 100}%`,
                width: 2, height: 16, background: '#fff', borderRadius: 1, opacity: 0.7,
              }} />
            )}
          </div>

          {/* Three KPIs */}
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: pace.overrun > 0 ? '#FCA5A5' : '#9FB3CB', textTransform: 'uppercase' }}>
                {pace.overrun > 0 ? 'Sobregiro' : 'Restante'}
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, marginTop: 4, color: pace.overrun > 0 ? '#FCA5A5' : '#4ADE80' }}>
                {formatMoney(pace.overrun > 0 ? pace.overrun : pace.remaining)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9FB3CB', textTransform: 'uppercase' }}>Ritmo esperado</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, marginTop: 4 }}>
                {formatMoney(pace.expected)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9FB3CB', textTransform: 'uppercase' }}>Proyección</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, marginTop: 4 }}>
                {formatMoney(pace.projection)}
              </div>
            </div>
          </div>
        </div>

        {/* 4.2 Overrun explanation */}
        {pace.status === 'sobregiro' && overrunExplanation && (
          <div style={{
            background: '#FEE2E2', borderRadius: 16, padding: '20px 24px',
            marginBottom: 20, border: '1px solid #FECACA',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#991B1B', textTransform: 'uppercase', marginBottom: 8 }}>
              Qué explica el sobregiro
            </div>
            <div style={{ fontSize: 14, color: '#991B1B', lineHeight: 1.5 }}>
              {overrunExplanation}
            </div>
          </div>
        )}

        {/* 4.3 Transactions */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', marginBottom: 20 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 12,
          }}>
            {txs.length} transacciones
          </div>

          {/* Sort tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {([['monto', 'Por monto'], ['fecha', 'Por fecha'], ['comercio', 'Por comercio']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  background: sort === key ? '#2563EB' : '#F3F5F9',
                  color: sort === key ? '#fff' : '#64748B',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Transaction list */}
          {sort !== 'comercio' ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sortedTxs.map((tx, i) => {
                const isDominant = tx.id === dominantTxId
                const pct = pace!.spent > 0 ? Math.round((tx.amount / pace!.spent) * 100) : 0
                const dateStr = new Date(tx.date).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
                const initial = (cleanTransactionName(tx.description) || '?')[0].toUpperCase()
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 0', borderTop: i > 0 ? '1px solid #EEF1F6' : 'none',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: isDominant ? '#FEE2E2' : '#F3F5F9',
                      color: isDominant ? '#EF4444' : '#1E3A5F',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 15, flexShrink: 0,
                    }}>
                      {initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cleanTransactionName(tx.description) || 'Sin descripción'}
                      </div>
                      <div style={{ fontSize: 12, color: '#8B9AAE' }}>
                        {dateStr} · {sourceLabel(tx.payment_method)}
                      </div>
                    </div>
                    {/* Participation bar */}
                    <div style={{ width: 60, height: 6, background: '#F3F5F9', borderRadius: 3, flexShrink: 0 }}>
                      <div style={{ width: `${Math.max(pct, 3)}%`, height: '100%', borderRadius: 3, background: isDominant ? '#EF4444' : '#2563EB' }} />
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: '#1E3A5F' }}>
                        {formatMoney(tx.amount)}
                      </div>
                      <div style={{ fontSize: 11, color: '#8B9AAE' }}>{pct}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {merchantGroups.map((g, i) => {
                const isExpanded = expandedMerchants.has(g.merchant)
                const pct = pace!.spent > 0 ? Math.round((g.total / pace!.spent) * 100) : 0
                return (
                  <div key={g.merchant}>
                    <div
                      onClick={() => {
                        setExpandedMerchants(prev => {
                          const next = new Set(prev)
                          if (next.has(g.merchant)) next.delete(g.merchant)
                          else next.add(g.merchant)
                          return next
                        })
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                        padding: '14px 0', borderTop: i > 0 ? '1px solid #EEF1F6' : 'none',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, background: '#F3F5F9',
                        color: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 15, flexShrink: 0,
                      }}>
                        {g.merchant[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F' }}>{g.merchant}</div>
                        <div style={{ fontSize: 12, color: '#8B9AAE' }}>{g.count} transacciones</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: '#1E3A5F' }}>
                          {formatMoney(g.total)}
                        </div>
                        <div style={{ fontSize: 11, color: '#8B9AAE' }}>{pct}%</div>
                      </div>
                    </div>
                    {isExpanded && g.txs.map(tx => {
                      const dateStr = new Date(tx.date).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
                      return (
                        <div key={tx.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 0 10px 48px', borderTop: '1px solid #F3F5F9',
                        }}>
                          <div style={{ flex: 1, fontSize: 13, color: '#64748B' }}>
                            {dateStr} · {sourceLabel(tx.payment_method)}
                          </div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 13, color: '#1E3A5F' }}>
                            {formatMoney(tx.amount)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {txs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#8B9AAE', fontSize: 14 }}>
              Sin transacciones este mes
            </div>
          )}
        </div>

        {/* 4.4 Historic */}
        {history.some(h => h.total > 0) && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16,
            }}>
              Este mismo mes, antes
            </div>

            {history.map(h => (
              <div key={h.month} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderTop: '1px solid #EEF1F6',
              }}>
                <span style={{ fontSize: 14, color: '#1E3A5F', textTransform: 'capitalize' }}>{h.label}</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: '#1E3A5F' }}>
                  {formatMoney(h.total)}
                </span>
              </div>
            ))}

            {history.length >= 2 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderTop: '2px solid #EEF1F6',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F' }}>Promedio {histAvgLabel}</span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 15, color: '#2563EB' }}>
                  {formatMoney(histAvg)}
                </span>
              </div>
            )}

            {budgetBelowAvg && (
              <div style={{
                background: '#FEF3C7', borderRadius: 12, padding: '14px 18px',
                marginTop: 12, fontSize: 14, color: '#92400E', lineHeight: 1.5,
              }}>
                Tu presupuesto de {formatMoney(budget)} está por debajo de tu promedio real. ¿Ajustarlo a {formatMoney(suggestedBudget)}?
                <button
                  onClick={() => router.push('/presupuesto')}
                  style={{
                    display: 'block', marginTop: 8,
                    background: '#F59E0B', color: '#fff', border: 'none',
                    padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                    fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                  }}
                >
                  Ajustar presupuesto
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
