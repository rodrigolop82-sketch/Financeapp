'use client'
import { useMoneyFormat } from '@/lib/format'

interface SummaryRowProps {
  today: number
  todayCount: number
  week: number
  weekVsPrev: number
  month: number
  monthBudget: number
}

export function SummaryRow({ today, todayCount, week, weekVsPrev, month, monthBudget }: SummaryRowProps) {
  const { money } = useMoneyFormat()

  const weekColor = weekVsPrev <= 0 ? '#16A34A' : '#8B9AAE'
  const weekIcon = weekVsPrev <= 0 ? '↓' : '↑'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px' }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
          color: '#8B9AAE', textTransform: 'uppercase' as const,
        }}>
          Hoy
        </div>
        <div style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
          fontSize: 26, color: '#1E3A5F', marginTop: 8,
        }}>
          {money(today)}
        </div>
        <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 2 }}>
          {todayCount} gasto{todayCount !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px' }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
          color: '#8B9AAE', textTransform: 'uppercase' as const,
        }}>
          Semana
        </div>
        <div style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
          fontSize: 26, color: '#1E3A5F', marginTop: 8,
        }}>
          {money(week)}
        </div>
        <div style={{ fontSize: 13, color: weekColor, marginTop: 2, fontWeight: 600 }}>
          {weekIcon} {Math.abs(weekVsPrev)}% vs anterior
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px' }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
          color: '#8B9AAE', textTransform: 'uppercase' as const,
        }}>
          Mes
        </div>
        <div style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
          fontSize: 26, color: '#1E3A5F', marginTop: 8,
        }}>
          {money(month)}
        </div>
        <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 2 }}>
          de {money(monthBudget)}
        </div>
      </div>
    </div>
  )
}
