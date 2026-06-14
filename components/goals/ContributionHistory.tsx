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
      <div style={{ padding: '16px 0' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 48, borderRadius: 10, marginBottom: 8,
            background: 'rgba(255,255,255,0.04)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    )
  }

  if (contributions.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '20px 0' }}>
        Aún no hay aportes registrados
      </p>
    )
  }

  return (
    <div>
      {contributions.map((c) => {
        const date = new Date(c.createdAt)
        const dateStr = date.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })

        return (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(52,211,153,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#34D399',
            }}>
              ↑
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'white' }}>
                {c.note || 'Aporte manual'}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{dateStr}</p>
            </div>
            <p style={{
              fontSize: 14, fontWeight: 700, color: '#34D399',
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
