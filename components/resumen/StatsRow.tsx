'use client'
import { formatMoney } from '@/lib/format'

interface StatsRowProps {
  dailyAvg: number
  projectedSavings: number
}

export function StatsRow({ dailyAvg, projectedSavings }: StatsRowProps) {
  const savingsPositive = projectedSavings >= 0

  return (
    <div style={{ display: 'flex', gap: 10, margin: '0 16px 16px' }}>
      <div style={{
        flex: 1, background: '#F8FAFC', borderRadius: 14, padding: '14px 16px',
        border: '1px solid #E2E8F0',
      }}>
        <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Promedio/día
        </p>
        <p style={{ fontSize: 20, fontWeight: 700, color: '#1E3A5F', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
          {formatMoney(dailyAvg)}
        </p>
      </div>
      <div style={{
        flex: 1, background: savingsPositive ? '#F0FDF4' : '#FFF5F5', borderRadius: 14, padding: '14px 16px',
        border: `1px solid ${savingsPositive ? '#BBF7D0' : '#FECACA'}`,
      }}>
        <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Ahorro proyectado
        </p>
        <p style={{ fontSize: 20, fontWeight: 700, color: savingsPositive ? '#059669' : '#DC2626', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
          {savingsPositive ? '' : '-'}{formatMoney(Math.abs(projectedSavings))}
        </p>
      </div>
    </div>
  )
}
