'use client'
import { formatMoney } from '@/lib/format'
import { DonutChart } from './DonutChart'
import { HorizontalBarChart } from './HorizontalBarChart'
import { TrendLineChart } from './TrendLineChart'
import type { HistoricalTrendsData } from '@/hooks/useHistoricalTrends'

interface TendenciasTabProps {
  data: HistoricalTrendsData
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

export function TendenciasTab({ data }: TendenciasTabProps) {
  return (
    <div>
      {/* Summary pill */}
      <div style={{ margin: '0 16px 16px', padding: '12px 16px', background: 'linear-gradient(135deg, #0F1F36, #1E3A5F)', borderRadius: 14, color: '#fff' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Promedio mensual (6 meses)</p>
        <p style={{ fontSize: 26, fontWeight: 800, margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px' }}>
          {formatMoney(data.avgMonthly)}
        </p>
      </div>

      {/* Donut */}
      <SectionCard title="Gasto fijo vs variable">
        <DonutChart
          fixed={data.fixedTotal}
          variable={data.variableTotal}
          fixedMonthlyAvg={data.fixedMonthlyAvg}
          variableMonthlyAvg={data.variableMonthlyAvg}
        />
      </SectionCard>

      {/* Trend line */}
      <SectionCard title="Evolución mensual">
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {[{ color: '#2563EB', label: 'Total' }, { color: '#10B981', label: 'Fijo' }, { color: '#F59E0B', label: 'Variable' }].map((l) => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 14, height: 2, background: l.color, borderRadius: 1 }} />
                <span style={{ fontSize: 11, color: '#64748B' }}>{l.label}</span>
              </div>
            ))}
          </div>
          <TrendLineChart data={data.monthPoints} avgMonthly={data.avgMonthly} />
        </div>
      </SectionCard>

      {/* Observations */}
      {data.observations && data.observations.length > 0 && (
        <SectionCard title="Observaciones">
          {data.observations.map((obs, i) => {
            const config = {
              warning: { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', icon: '⚠️' },
              tip: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icon: '💡' },
              positive: { bg: '#F0FDF4', border: '#BBF7D0', color: '#065F46', icon: '✅' },
            }[obs.type]
            return (
              <div key={i} style={{
                padding: '12px 14px',
                background: config.bg,
                border: `1px solid ${config.border}`,
                borderRadius: 12,
                marginBottom: i < data.observations.length - 1 ? 10 : 0,
              }}>
                <p style={{ fontSize: 13, color: config.color, margin: 0, lineHeight: 1.5 }}>
                  {config.icon} {obs.message}
                </p>
              </div>
            )
          })}
        </SectionCard>
      )}

      {/* Top categories */}
      <SectionCard title="Categorías (últimos 6 meses)">
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {[{ color: '#2563EB', label: 'Necesidades' }, { color: '#F59E0B', label: 'Deseos' }, { color: '#10B981', label: 'Ahorro' }].map((l) => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                <span style={{ fontSize: 10, color: '#64748B' }}>{l.label}</span>
              </div>
            ))}
          </div>
          <HorizontalBarChart categories={data.topCategories} />
        </div>
      </SectionCard>
    </div>
  )
}
