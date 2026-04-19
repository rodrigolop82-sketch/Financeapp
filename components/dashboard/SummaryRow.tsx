'use client'
import { useMoneyFormat } from '@/lib/format'

interface SummaryRowProps {
  today: number
  todayCount: number
  week: number
  weekVsPrev: number
  month: number
  monthBudget: number
  isPastMonth?: boolean
}

export function SummaryRow({ today, todayCount, week, weekVsPrev, month, monthBudget, isPastMonth = false }: SummaryRowProps) {
  const { money } = useMoneyFormat()

  if (isPastMonth) {
    const pct = monthBudget > 0 ? Math.round((month / monthBudget) * 100) : 0
    const overBudget = month > monthBudget
    return (
      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <div className="card-zafi" style={{ padding: '10px 12px 8px', textAlign: 'center' }}>
          <div className="eyebrow-muted" style={{ marginBottom: 6 }}>TOTAL GASTADO</div>
          <div className="font-outfit font-bold text-navy" style={{ fontSize: 18 }}>{money(month)}</div>
          <div className="font-sans text-caption text-ink-400" style={{ marginTop: 2 }}>de {money(monthBudget)}</div>
        </div>
        <div className="card-zafi" style={{ padding: '10px 12px 8px', textAlign: 'center' }}>
          <div className="eyebrow-muted" style={{ marginBottom: 6 }}>VS PRESUPUESTO</div>
          <div className="font-outfit font-bold" style={{ fontSize: 18, color: overBudget ? '#EF4444' : '#10B981' }}>
            {pct}%
          </div>
          <div className="font-sans text-caption" style={{ marginTop: 2, color: overBudget ? '#EF4444' : '#10B981' }}>
            {overBudget ? `+${money(month - monthBudget)} excedido` : `${money(monthBudget - month)} ahorrado`}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>

      <div className="card-zafi" style={{ padding: '10px 10px 8px', textAlign: 'center' }}>
        <div className="eyebrow-muted" style={{ marginBottom: 6 }}>HOY</div>
        <div className="font-outfit font-bold text-navy" style={{ fontSize: 16 }}>{money(today)}</div>
        <div className="font-sans text-caption text-ink-400" style={{ marginTop: 2 }}>{todayCount} gasto{todayCount !== 1 ? 's' : ''}</div>
      </div>

      <div className="card-zafi" style={{ padding: '10px 10px 8px', textAlign: 'center' }}>
        <div className="eyebrow-muted" style={{ marginBottom: 6 }}>SEMANA</div>
        <div className="font-outfit font-bold text-navy" style={{ fontSize: 16 }}>{money(week)}</div>
        <div className="font-sans text-caption" style={{ marginTop: 2, color: weekVsPrev > 0 ? '#F59E0B' : '#10B981' }}>
          {weekVsPrev > 0 ? '\u2191' : '\u2193'} {Math.abs(weekVsPrev)}% vs ant.
        </div>
      </div>

      <div className="card-zafi" style={{ padding: '10px 10px 8px', textAlign: 'center' }}>
        <div className="eyebrow-muted" style={{ marginBottom: 6 }}>MES</div>
        <div className="font-outfit font-bold text-navy" style={{ fontSize: 16 }}>{money(month)}</div>
        <div className="font-sans text-caption text-ink-400" style={{ marginTop: 2 }}>de {money(monthBudget)}</div>
      </div>

    </div>
  )
}
