'use client'
import { formatMoney } from '@/lib/format'
import type { InsightsData, CategoryInsight } from '@/hooks/useInsights'

interface InsightsTabProps {
  data: InsightsData
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '0 16px 16px', background: '#F8FAFC', borderRadius: 16, padding: '16px 18px', border: '1px solid #E2E8F0' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function MiniSparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })

  const lastVal = data[data.length - 1]
  const prevVal = data[data.length - 2]
  const color = lastVal > prevVal ? '#EF4444' : '#10B981'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DeltaBadge({ value, pct }: { value: number; pct: number }) {
  const isUp = value > 0
  const color = isUp ? '#DC2626' : '#059669'
  const bg = isUp ? '#FEF2F2' : '#F0FDF4'
  const arrow = isUp ? '↑' : '↓'

  if (value === 0) return null

  return (
    <span style={{
      padding: '2px 8px', borderRadius: 6,
      background: bg, fontSize: 11, fontWeight: 700,
      color,
    }}>
      {arrow} {Math.abs(pct)}%
    </span>
  )
}

function InsightCard({ insight }: { insight: CategoryInsight & { message: string } }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #E2E8F0',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="font-sans font-semibold" style={{ fontSize: 13, color: '#1E3A5F' }}>
          {insight.name}
        </span>
        <MiniSparkline data={insight.trend} />
      </div>
      <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 8px', lineHeight: 1.5 }}>
        {insight.message}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="font-outfit font-bold" style={{ fontSize: 15, color: '#1E3A5F' }}>
          {formatMoney(insight.thisMonth)}
        </span>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>
          promedio: {formatMoney(insight.avgLast3)}
        </span>
        {insight.savingsPotential > 0 && (
          <span style={{
            padding: '2px 8px', borderRadius: 6,
            background: '#FEF3C7', fontSize: 10, fontWeight: 700,
            color: '#92400E',
          }}>
            Ahorra {formatMoney(insight.savingsPotential)}
          </span>
        )}
      </div>
    </div>
  )
}

export function InsightsTab({ data }: InsightsTabProps) {
  return (
    <div>
      {/* Month comparison hero */}
      <div style={{
        margin: '0 16px 16px',
        padding: '16px 18px',
        background: 'linear-gradient(135deg, #0F1F36, #1E3A5F)',
        borderRadius: 14,
        color: '#fff',
      }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          Comparado con el mes anterior
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="font-outfit" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.3px' }}>
            {formatMoney(data.totalThisMonth)}
          </span>
          {data.monthDelta !== 0 && (
            <span style={{
              padding: '3px 10px',
              borderRadius: 8,
              background: data.monthDelta > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
              color: data.monthDelta > 0 ? '#FCA5A5' : '#6EE7B7',
              fontSize: 13,
              fontWeight: 700,
            }}>
              {data.monthDelta > 0 ? '↑' : '↓'} {Math.abs(data.monthDeltaPct)}% vs mes anterior
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          <div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 2px' }}>Este mes</p>
            <p className="font-outfit font-bold" style={{ fontSize: 16, margin: 0 }}>{formatMoney(data.totalThisMonth)}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 2px' }}>Mes anterior</p>
            <p className="font-outfit font-bold" style={{ fontSize: 16, margin: 0 }}>{formatMoney(data.totalLastMonth)}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '0 0 2px' }}>Diferencia</p>
            <p className="font-outfit font-bold" style={{
              fontSize: 16, margin: 0,
              color: data.monthDelta > 0 ? '#FCA5A5' : '#6EE7B7',
            }}>
              {data.monthDelta > 0 ? '+' : ''}{formatMoney(data.monthDelta)}
            </p>
          </div>
        </div>
      </div>

      {/* Top increases */}
      {data.topIncreases.length > 0 && (
        <SectionCard title="📈 Categorías que más subieron">
          {data.topIncreases.map(c => (
            <div key={c.categoryId} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #F1F5F9',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>{c.name}</span>
                  <DeltaBadge value={c.delta} pct={c.deltaPct} />
                </div>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>
                  {formatMoney(c.lastMonth)} → {formatMoney(c.thisMonth)}
                </span>
              </div>
              <MiniSparkline data={c.trend} width={60} height={20} />
            </div>
          ))}
        </SectionCard>
      )}

      {/* Savings opportunities */}
      {data.savingsOpportunities.length > 0 && (
        <SectionCard title="💡 Oportunidades de ahorro">
          {data.savingsOpportunities.map(c => (
            <InsightCard
              key={c.categoryId}
              insight={{
                ...c,
                message: `Estás gastando ${formatMoney(c.savingsPotential)} más que tu promedio de ${formatMoney(c.avgLast3)}. Si vuelves al promedio, ahorras ${formatMoney(c.savingsPotential)}/mes.`,
              }}
            />
          ))}
        </SectionCard>
      )}

      {/* Category breakdown with sparklines */}
      <SectionCard title="Desglose por categoría">
        {data.categoryInsights.slice(0, 10).map(c => (
          <div key={c.categoryId} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0',
            borderBottom: '1px solid #F1F5F9',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>{c.name}</span>
                {c.deltaPct !== 0 && c.lastMonth > 0 && (
                  <DeltaBadge value={c.delta} pct={c.deltaPct} />
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                <span className="font-outfit font-bold" style={{ fontSize: 14, color: '#1E3A5F' }}>
                  {formatMoney(c.thisMonth)}
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>
                  ant: {formatMoney(c.lastMonth)}
                </span>
              </div>
            </div>
            <MiniSparkline data={c.trend} width={64} height={22} />
          </div>
        ))}
      </SectionCard>

      {/* Day of week pattern */}
      {data.topCategoryByDay.some(d => d.amount > 0) && (
        <SectionCard title="Patrón por día de la semana">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {data.topCategoryByDay.map(d => {
              const maxAmt = Math.max(...data.topCategoryByDay.map(x => x.amount), 1)
              const heightPct = d.amount > 0 ? Math.max((d.amount / maxAmt) * 100, 8) : 4
              return (
                <div key={d.day} style={{ textAlign: 'center' }}>
                  <div style={{
                    height: 60,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    marginBottom: 4,
                  }}>
                    <div style={{
                      width: '100%',
                      maxWidth: 28,
                      height: `${heightPct}%`,
                      background: d.amount > 0 ? '#2563EB' : '#E2E8F0',
                      borderRadius: '4px 4px 0 0',
                      opacity: d.amount > 0 ? 0.7 : 0.3,
                    }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B', display: 'block' }}>
                    {d.day}
                  </span>
                  {d.amount > 0 && (
                    <span style={{ fontSize: 9, color: '#94A3B8', display: 'block', marginTop: 1 }}>
                      {formatMoney(d.amount)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      <div className="h-6" />
    </div>
  )
}
