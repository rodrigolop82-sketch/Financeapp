'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { localMonthStart } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { AppShell } from '@/components/layout/AppShell'
import { Loader2 } from 'lucide-react'

type Tab = 'mes' | 'insights' | 'tendencias'

interface CategorySpend {
  name: string
  amount: number
  prevAmount: number
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

      const [txMonthRes, categoriesRes, txPrevRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('household_id', hid).gte('date', monthStart),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
        supabase.from('transactions').select('*').eq('household_id', hid).gte('date', prevMonthStart).lte('date', prevMonthEnd),
      ])

      const txMonth = txMonthRes.data ?? []
      const txPrev = txPrevRes.data ?? []
      const cats = categoriesRes.data ?? []

      const catMap: Record<string, string> = {}
      cats.forEach((c: { id: string; name: string }) => { catMap[c.id] = c.name })

      const spentByCat: Record<string, number> = {}
      txMonth.forEach((t: { category_id: string; amount: number }) => {
        const name = catMap[t.category_id] ?? 'Otros'
        spentByCat[name] = (spentByCat[name] ?? 0) + Number(t.amount)
      })

      const prevByCat: Record<string, number> = {}
      txPrev.forEach((t: { category_id: string; amount: number }) => {
        const name = catMap[t.category_id] ?? 'Otros'
        prevByCat[name] = (prevByCat[name] ?? 0) + Number(t.amount)
      })

      const allCatNames = Array.from(new Set([...Object.keys(spentByCat), ...Object.keys(prevByCat)]))
      const categories: CategorySpend[] = allCatNames.map(name => ({
        name,
        amount: spentByCat[name] ?? 0,
        prevAmount: prevByCat[name] ?? 0,
      })).sort((a, b) => b.amount - a.amount)

      const spentMonth = txMonth.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
      const spentPrevMonth = txPrev.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)

      const budget = profile?.total_income ? Number(profile.total_income) * 0.8 : 4000
      const fullName = (userProfile?.full_name || 'Usuario') as string
      const firstName = fullName.split(' ')[0]

      setData({
        userName: firstName,
        householdName: household.name ?? '',
        budget,
        spentMonth,
        daysLeft,
        categories,
        spentPrevMonth,
        monthlyAvg: Math.round((spentMonth + spentPrevMonth) / 2),
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
            {data.categories.map((cat, i) => (
              <div key={cat.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 0', borderTop: i > 0 ? '1px solid #EEF1F6' : 'none',
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F' }}>{cat.name}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E3A5F' }}>
                  {formatMoney(cat.amount)}
                </div>
              </div>
            ))}
            {data.categories.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#8B9AAE', fontSize: 14 }}>
                Sin gastos este mes
              </div>
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
                          color: catDiff <= 0 ? '#16A34A' : '#DC2626',
                          background: catDiff <= 0 ? '#EAFBF1' : '#FEE2E2',
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
                  {/* Simple sparkline placeholder */}
                  <svg width="90" height="36" viewBox="0 0 90 36" fill="none">
                    <polyline
                      points={`0,${30 - Math.random() * 20} 15,${30 - Math.random() * 20} 30,${30 - Math.random() * 20} 45,${30 - Math.random() * 20} 60,${30 - Math.random() * 20} 75,${30 - Math.random() * 20} 90,${30 - Math.random() * 20}`}
                      stroke={catDiff <= 0 ? '#16A34A' : '#EF4444'}
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
          {data.categories.filter(c => c.amount > 0 && c.prevAmount > 0 && c.amount > c.prevAmount * 1.15).length > 0 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', marginBottom: 20 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16,
              }}>
                Observaciones
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.categories
                  .filter(c => c.amount > 0 && c.prevAmount > 0 && c.amount > c.prevAmount * 1.15)
                  .slice(0, 4)
                  .map(c => (
                    <div key={c.name} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: '#FDEEEE', border: '1px solid #F6D3D3',
                      borderRadius: 12, padding: '14px 18px',
                      fontSize: '14.5px', color: '#9A3B3B',
                    }}>
                      <span>⚠</span>
                      {c.name} subió {Math.round((c.amount - c.prevAmount) / c.prevAmount * 100)}% vs el mes anterior. Considerá reducirlo.
                    </div>
                  ))
                }
              </div>
            </div>
          )}

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
