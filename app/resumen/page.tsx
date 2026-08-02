'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { localMonthStart } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { AppShell } from '@/components/layout/AppShell'
import { Loader2, TrendingDown, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react'

type Tab = 'mes' | 'insights' | 'tendencias'

interface CategorySpend {
  name: string
  amount: number
  prevAmount: number
  bucket: 'needs' | 'wants' | 'savings'
}

const FIXED_CATEGORIES = [
  'Vivienda/alquiler', 'Servicios', 'Suscripciones',
  'Educación', 'Salud/medicinas',
]

interface MonthlyTotal {
  label: string
  month: string
  total: number
  needsTotal: number
  wantsTotal: number
  savingsTotal: number
  fixedTotal: number
  variableTotal: number
}

interface ResumenData {
  userName: string
  householdName: string
  budget: number
  income: number
  spentMonth: number
  daysLeft: number
  categories: CategorySpend[]
  spentPrevMonth: number
  monthlyAvg: number
  monthlyTotals: MonthlyTotal[]
  needsPct: number
  wantsPct: number
  savingsPct: number
  fixedPct: number
  variablePct: number
}

export default function ResumenPage() {
  const [data, setData] = useState<ResumenData | null>(null)
  const [tab, setTab] = useState<Tab>('insights')
  const [loading, setLoading] = useState(true)
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

      const { data: profile } = await supabase
        .from('financial_profiles').select('*').eq('household_id', hid)
        .order('updated_at', { ascending: false }).limit(1).single()

      const now = new Date()
      const monthStart = localMonthStart()
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const daysLeft = daysInMonth - now.getDate()

      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)

      const [txMonthRes, categoriesRes, txPrevRes, txHistoryRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('household_id', hid).gte('date', monthStart),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
        supabase.from('transactions').select('*').eq('household_id', hid).gte('date', prevMonthStart).lte('date', prevMonthEnd),
        supabase.from('transactions').select('date, amount, category_id').eq('household_id', hid).gte('date', sixMonthsAgo).order('date', { ascending: true }),
      ])

      const txMonth = txMonthRes.data ?? []
      const txPrev = txPrevRes.data ?? []
      const txHistory = txHistoryRes.data ?? []
      const cats = categoriesRes.data ?? []

      const catMap: Record<string, { name: string; bucket: string }> = {}
      cats.forEach((c: { id: string; name: string; bucket: string }) => {
        catMap[c.id] = { name: c.name, bucket: c.bucket }
      })

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

      const catIdByName: Record<string, string> = {}
      cats.forEach((c: { id: string; name: string }) => { catIdByName[c.name] = c.id })

      const allCatNames = Array.from(new Set([...Object.keys(spentByCat), ...Object.keys(prevByCat)]))
      const categories: CategorySpend[] = allCatNames.map(name => {
        const catId = catIdByName[name]
        return {
          name,
          amount: spentByCat[name] ?? 0,
          prevAmount: prevByCat[name] ?? 0,
          bucket: (catId ? catMap[catId]?.bucket as 'needs' | 'wants' | 'savings' : null) ?? 'wants',
        }
      }).sort((a, b) => b.amount - a.amount)

      const spentMonth = txMonth.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
      const spentPrevMonth = txPrev.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)

      const MONTH_NAMES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
      const monthlyBuckets: Record<string, { total: number; needs: number; wants: number; savings: number; fixed: number; variable: number }> = {}

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyBuckets[key] = { total: 0, needs: 0, wants: 0, savings: 0, fixed: 0, variable: 0 }
      }

      txHistory.forEach((t: { date: string; amount: number; category_id: string }) => {
        const key = t.date.slice(0, 7)
        if (monthlyBuckets[key]) {
          const amt = Number(t.amount)
          monthlyBuckets[key].total += amt
          const bucket = (catMap[t.category_id]?.bucket as 'needs' | 'wants' | 'savings') ?? 'wants'
          monthlyBuckets[key][bucket] += amt
          const catName = catMap[t.category_id]?.name ?? 'Otros'
          if (FIXED_CATEGORIES.includes(catName)) {
            monthlyBuckets[key].fixed += amt
          } else {
            monthlyBuckets[key].variable += amt
          }
        }
      })

      const monthlyTotals: MonthlyTotal[] = Object.entries(monthlyBuckets).map(([key, val]) => {
        const [y, m] = key.split('-')
        return {
          month: key,
          label: MONTH_NAMES_SHORT[parseInt(m) - 1] + ' ' + y.slice(2),
          total: Math.round(val.total),
          needsTotal: Math.round(val.needs),
          wantsTotal: Math.round(val.wants),
          savingsTotal: Math.round(val.savings),
          fixedTotal: Math.round(val.fixed),
          variableTotal: Math.round(val.variable),
        }
      })

      const totalNeeds = monthlyTotals.reduce((s, m) => s + m.needsTotal, 0)
      const totalWants = monthlyTotals.reduce((s, m) => s + m.wantsTotal, 0)
      const totalSavings = monthlyTotals.reduce((s, m) => s + m.savingsTotal, 0)
      const grandTotal = totalNeeds + totalWants + totalSavings
      const needsPct = grandTotal > 0 ? Math.round((totalNeeds / grandTotal) * 100) : 0
      const wantsPct = grandTotal > 0 ? Math.round((totalWants / grandTotal) * 100) : 0
      const savingsPct = 100 - needsPct - wantsPct

      const totalFixed = monthlyTotals.reduce((s, m) => s + m.fixedTotal, 0)
      const totalVariable = monthlyTotals.reduce((s, m) => s + m.variableTotal, 0)
      const fvTotal = totalFixed + totalVariable
      const fixedPct = fvTotal > 0 ? Math.round((totalFixed / fvTotal) * 100) : 50
      const variablePct = 100 - fixedPct

      const monthsWithData = monthlyTotals.filter(m => m.total > 0).length
      const monthlyAvg = monthsWithData > 0
        ? Math.round(monthlyTotals.reduce((s, m) => s + m.total, 0) / monthsWithData)
        : 0

      const income = profile?.total_income ? Number(profile.total_income) : 0
      const budget = income > 0 ? income * 0.8 : 4000
      const fullName = (userProfile?.full_name || 'Usuario') as string
      const firstName = fullName.split(' ')[0]

      setData({
        userName: firstName,
        householdName: household.name ?? '',
        budget,
        income,
        spentMonth,
        daysLeft,
        categories,
        spentPrevMonth,
        monthlyAvg,
        monthlyTotals,
        needsPct,
        wantsPct,
        savingsPct,
        fixedPct,
        variablePct,
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

  const BUCKET_COLORS: Record<string, string> = {
    needs: '#2563EB',
    wants: '#F59E0B',
    savings: '#16A34A',
  }

  const recentMonths = data.monthlyTotals.filter(m => m.total > 0)
  const lastTwo = recentMonths.slice(-2)
  const signals: { type: 'good' | 'bad'; text: string }[] = []

  if (lastTwo.length === 2) {
    const [prev, curr] = lastTwo
    if (curr.savingsTotal > prev.savingsTotal) {
      signals.push({ type: 'good', text: `Ahorro subió ${formatMoney(curr.savingsTotal - prev.savingsTotal)} vs mes anterior` })
    } else if (curr.savingsTotal < prev.savingsTotal && prev.savingsTotal > 0) {
      signals.push({ type: 'bad', text: `Ahorro bajó ${Math.round((1 - curr.savingsTotal / prev.savingsTotal) * 100)}% vs mes anterior` })
    }
    if (curr.wantsTotal < prev.wantsTotal) {
      signals.push({ type: 'good', text: `Gustos se redujeron ${Math.round((1 - curr.wantsTotal / prev.wantsTotal) * 100)}%` })
    } else if (curr.wantsTotal > prev.wantsTotal * 1.1 && prev.wantsTotal > 0) {
      signals.push({ type: 'bad', text: `Gustos aumentaron ${Math.round((curr.wantsTotal / prev.wantsTotal - 1) * 100)}%` })
    }
    if (curr.needsTotal < prev.needsTotal * 0.95) {
      signals.push({ type: 'good', text: `Necesidades se redujeron ${Math.round((1 - curr.needsTotal / prev.needsTotal) * 100)}%` })
    } else if (curr.needsTotal > prev.needsTotal * 1.1 && prev.needsTotal > 0) {
      signals.push({ type: 'bad', text: `Necesidades subieron ${Math.round((curr.needsTotal / prev.needsTotal - 1) * 100)}%` })
    }
  }

  if (data.income > 0) {
    const latestMonth = recentMonths[recentMonths.length - 1]
    if (latestMonth) {
      const savingsRate = latestMonth.savingsTotal / data.income
      if (savingsRate >= 0.2) {
        signals.push({ type: 'good', text: `Tasa de ahorro ${Math.round(savingsRate * 100)}% — meta del 20% alcanzada` })
      } else if (savingsRate < 0.1) {
        signals.push({ type: 'bad', text: `Tasa de ahorro ${Math.round(savingsRate * 100)}% — lejos del 20% recomendado` })
      }
    }
  }

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
          <div style={{
            background: '#1E3A5F', borderRadius: 20,
            padding: '32px 36px', color: '#fff', marginBottom: 20,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#9FB3CB', textTransform: 'uppercase', marginBottom: 12,
            }}>
              Gasto total del mes
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 44 }}>
              {formatMoney(data.spentMonth)}
            </div>
            <div style={{ fontSize: 14, color: '#9FB3CB', marginTop: 8 }}>
              de {formatMoney(data.budget)} presupuestados · {data.daysLeft} días restantes
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px' }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16,
            }}>
              Gasto por categoría
            </div>
            {data.categories.map((cat, i) => {
              const pct = data.spentMonth > 0 ? Math.round((cat.amount / data.spentMonth) * 100) : 0
              const bucketColor = BUCKET_COLORS[cat.bucket]
              return (
                <div key={cat.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 0', borderTop: i > 0 ? '1px solid #EEF1F6' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: bucketColor, display: 'inline-block', flexShrink: 0,
                    }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F' }}>{cat.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, color: '#8B9AAE', fontWeight: 600 }}>
                      {pct}%
                    </div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E3A5F', minWidth: 90, textAlign: 'right' }}>
                      {formatMoney(cat.amount)}
                    </div>
                  </div>
                </div>
              )
            })}
            {data.categories.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#8B9AAE', fontSize: 14 }}>
                Sin gastos este mes
              </div>
            )}

            {/* Bucket legend */}
            <div style={{
              display: 'flex', gap: 20, marginTop: 20, paddingTop: 16,
              borderTop: '1px solid #EEF1F6', fontSize: 13, color: '#8B9AAE',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                Necesidades
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                Deseos
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                Ahorro
              </div>
            </div>
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

          {/* Category comparison with savings-aware colors */}
          {(() => {
            const changedCats = data.categories.filter(c => c.prevAmount > 0 || c.amount > 0)
            if (changedCats.length === 0) return null
            return (
              <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px' }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                  color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Cambios por categoría
                </div>
                {changedCats.map((cat) => {
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
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </>
      )}

      {/* === TENDENCIAS === */}
      {tab === 'tendencias' && (
        <>
          {/* Top summary with avg + signals */}
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

            {/* Signals: what's working / what's not */}
            {signals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                {signals.slice(0, 4).map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: s.type === 'good' ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)',
                    borderRadius: 12, padding: '10px 16px',
                    fontSize: 14, color: s.type === 'good' ? '#86EFAC' : '#FCA5A5',
                  }}>
                    {s.type === 'good'
                      ? <CheckCircle2 size={16} strokeWidth={2.5} />
                      : <AlertTriangle size={16} strokeWidth={2.5} />
                    }
                    {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Distribution summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Necesidades', pct: data.needsPct, color: '#2563EB', target: '50%' },
              { label: 'Deseos', pct: data.wantsPct, color: '#F59E0B', target: '30%' },
              { label: 'Ahorro', pct: data.savingsPct, color: '#16A34A', target: '20%' },
            ].map(item => (
              <div key={item.label} style={{
                background: '#fff', borderRadius: 16, padding: '20px 22px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8B9AAE', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {item.label}
                  </div>
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 28, color: '#1E3A5F' }}>
                  {item.pct}%
                </div>
                <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 2 }}>
                  Meta: {item.target}
                </div>
              </div>
            ))}
          </div>

          {/* Charts row: donut + line chart */}
          {(() => {
            const donutCircumference = 2 * Math.PI * 70
            const fixedArc = (data.fixedPct / 100) * donutCircumference
            const variableArc = (data.variablePct / 100) * donutCircumference
            const chartW = 380
            const chartH = 200
            const pad = 10
            const maxTotal = Math.max(...data.monthlyTotals.map(m => m.total), 1)

            function toPoints(values: number[]): string {
              if (values.length === 0) return ''
              const step = (chartW - pad * 2) / Math.max(values.length - 1, 1)
              return values.map((v, i) => {
                const x = pad + i * step
                const y = chartH - pad - ((v / maxTotal) * (chartH - pad * 2))
                return `${Math.round(x)},${Math.round(y)}`
              }).join(' ')
            }

            const totalLine = toPoints(data.monthlyTotals.map(m => m.total))
            const savingsLine = toPoints(data.monthlyTotals.map(m => m.savingsTotal))

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                {/* Donut: fijo vs variable */}
                <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px' }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                    color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 20,
                  }}>
                    Gasto fijo vs variable
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <svg width="180" height="180" viewBox="0 0 180 180">
                      <circle cx="90" cy="90" r="70" fill="none" stroke="#E2E8F0" strokeWidth="26" />
                      <circle cx="90" cy="90" r="70" fill="none" stroke="#2563EB"
                        strokeWidth="26"
                        strokeDasharray={`${fixedArc} ${donutCircumference - fixedArc}`}
                        strokeDashoffset={donutCircumference * 0.25}
                        strokeLinecap="round"
                      />
                      <circle cx="90" cy="90" r="70" fill="none" stroke="#F59E0B"
                        strokeWidth="26"
                        strokeDasharray={`${variableArc} ${donutCircumference - variableArc}`}
                        strokeDashoffset={donutCircumference * 0.25 - fixedArc}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1E3A5F' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                      Fijo {data.fixedPct}%
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1E3A5F' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                      Variable {data.variablePct}%
                    </div>
                  </div>
                </div>

                {/* Line chart: total + ahorro */}
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
                      <span style={{ width: 14, height: 2, background: '#16A34A', display: 'inline-block' }} />Ahorro
                    </div>
                  </div>
                  <svg width="100%" height="200" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                    <line x1={pad} y1={chartH - pad} x2={chartW - pad} y2={chartH - pad} stroke="#EEF1F6" strokeWidth="1" />
                    <line x1={pad} y1={chartH / 2} x2={chartW - pad} y2={chartH / 2} stroke="#EEF1F6" strokeWidth="1" />
                    <line x1={pad} y1={pad} x2={chartW - pad} y2={pad} stroke="#EEF1F6" strokeWidth="1" />
                    {totalLine && <polyline points={totalLine} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
                    {savingsLine && <polyline points={savingsLine} fill="none" stroke="#16A34A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8B9AAE', marginTop: 6 }}>
                    {data.monthlyTotals.map(m => (
                      <span key={m.month}>{m.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Stacked bar chart per month: Necesidades / Deseos / Ahorro */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', marginBottom: 20 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 8,
            }}>
              Distribución mensual
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                Necesidades
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                Deseos
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                Ahorro
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.monthlyTotals.map((m) => {
                const needsPct = m.total > 0 ? (m.needsTotal / m.total) * 100 : 0
                const wantsPct = m.total > 0 ? (m.wantsTotal / m.total) * 100 : 0
                const savingsPct = m.total > 0 ? (m.savingsTotal / m.total) * 100 : 0

                return (
                  <div key={m.month}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F' }}>{m.label}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14, color: '#1E3A5F' }}>
                        {formatMoney(m.total)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', background: '#F3F5F9' }}>
                      {m.total > 0 && (
                        <>
                          <div style={{ width: `${needsPct}%`, height: '100%', background: '#2563EB' }} />
                          <div style={{ width: `${wantsPct}%`, height: '100%', background: '#F59E0B' }} />
                          <div style={{ width: `${savingsPct}%`, height: '100%', background: '#16A34A' }} />
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#8B9AAE' }}>
                      <span>{formatMoney(m.needsTotal)} nec.</span>
                      <span>{formatMoney(m.wantsTotal)} des.</span>
                      <span style={{ color: '#16A34A', fontWeight: 600 }}>{formatMoney(m.savingsTotal)} ahorro</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {data.monthlyTotals.every(m => m.total === 0) && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#8B9AAE', fontSize: 14 }}>
                No hay datos históricos aún
              </div>
            )}
          </div>

          {/* Savings trend highlight */}
          {recentMonths.length >= 2 && (
            <div style={{
              background: 'linear-gradient(135deg, #065F46 0%, #047857 100%)',
              borderRadius: 20, padding: '28px 32px', color: '#fff', marginBottom: 20,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {recentMonths[recentMonths.length - 1].savingsTotal >= recentMonths[recentMonths.length - 2].savingsTotal
                  ? <TrendingUp size={14} />
                  : <TrendingDown size={14} />
                }
                Tendencia de ahorro
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                {recentMonths.slice(-3).map((m, i) => (
                  <div key={m.month} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                      fontSize: i === recentMonths.slice(-3).length - 1 ? 28 : 20,
                      opacity: i === recentMonths.slice(-3).length - 1 ? 1 : 0.7,
                    }}>
                      {formatMoney(m.savingsTotal)}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observaciones — savings-aware */}
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
                      <CheckCircle2 size={16} />
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
                      <AlertTriangle size={16} />
                      {c.name} subió {Math.round((c.amount - c.prevAmount) / c.prevAmount * 100)}% vs el mes anterior. Considerá reducirlo.
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </>
      )}

      <div className="h-6" />
    </AppShell>
  )
}
