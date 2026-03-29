'use client'
import { useMoneyFormat } from '@/lib/format'

interface SummaryRowProps {
  today: number
  todayCount: number
  week: number
  weekVsPrev: number    // porcentaje vs semana anterior (ej: 12 = +12%)
  month: number
  monthBudget: number
}

export function SummaryRow({ today, todayCount, week, weekVsPrev, month, monthBudget }: SummaryRowProps) {
  const { money } = useMoneyFormat()

  return (
    <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>

      <div style={{ background: 'white', border: '0.5px solid #E2E8F0', borderRadius: 12, padding: '10px 10px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 500, letterSpacing: '.04em', marginBottom: 4 }}>HOY</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1E3A5F' }}>{money(today)}</div>
        <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>{todayCount} gasto{todayCount !== 1 ? 's' : ''}</div>
      </div>

      <div style={{ background: 'white', border: '0.5px solid #E2E8F0', borderRadius: 12, padding: '10px 10px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 500, letterSpacing: '.04em', marginBottom: 4 }}>SEMANA</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1E3A5F' }}>{money(week)}</div>
        <div style={{ fontSize: 9, marginTop: 2, color: weekVsPrev > 0 ? '#D97706' : '#10B981' }}>
          {weekVsPrev > 0 ? '↑' : '↓'} {Math.abs(weekVsPrev)}% vs ant.
        </div>
      </div>

      <div style={{ background: 'white', border: '0.5px solid #E2E8F0', borderRadius: 12, padding: '10px 10px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 500, letterSpacing: '.04em', marginBottom: 4 }}>MES</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1E3A5F' }}>{money(month)}</div>
        <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>de {money(monthBudget)}</div>
      </div>

    </div>
  )
}
