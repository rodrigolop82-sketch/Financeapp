'use client'
import { formatMoney } from '@/lib/format'
import type { Contribution } from '@/hooks/useGoals'

interface ContributionHistoryProps {
  contributions: Contribution[]
  isLoading: boolean
}

export function ContributionHistory({ contributions, isLoading }: ContributionHistoryProps) {
  if (isLoading) {
    return (
      <div style={{ padding: '8px 0' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 56, borderRadius: 10, marginBottom: 8,
            background: '#E2E8F0',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    )
  }

  if (contributions.length === 0) {
    return (
      <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>
        Aún no hay aportes registrados
      </p>
    )
  }

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E2E8F0',
      borderRadius: 14,
      padding: '4px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {contributions.map((c, idx) => {
        const date = new Date(c.createdAt)
        const dateStr = date.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })

        return (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 0',
            borderBottom: idx < contributions.length - 1 ? '1px solid #F1F5F9' : 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#D1FAE5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#065F46', fontWeight: 700,
            }}>
              ↑
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                {c.note || 'Aporte manual'}
              </p>
              <p style={{ fontSize: 12, color: '#94A3B8' }}>{dateStr}</p>
            </div>
            <p style={{
              fontSize: 15, fontWeight: 800, color: '#10B981',
              fontFamily: 'var(--font-outfit)',
            }}>
              +{formatMoney(c.amount)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
