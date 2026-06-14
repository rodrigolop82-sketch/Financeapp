'use client'
import { formatMoney } from '@/lib/format'

interface GoalsSummaryCardProps {
  totalSaved: number
  totalTarget: number
  activeCount: number
}

export function GoalsSummaryCard({ totalSaved, totalTarget, activeCount }: GoalsSummaryCardProps) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #1E3A5F, #112236)',
      border: '1px solid rgba(37,99,235,0.2)',
      borderRadius: 16,
      padding: '20px 18px',
      marginBottom: 16,
    }}>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginBottom: 4 }}>
        Total ahorrado en metas
      </p>
      <p style={{ fontSize: 26, fontWeight: 900, color: 'white', fontFamily: 'var(--font-outfit)', marginBottom: 4 }}>
        {formatMoney(totalSaved)}
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
        de {formatMoney(totalTarget)} en metas activas · {activeCount} {activeCount === 1 ? 'meta' : 'metas'} en curso
      </p>
    </div>
  )
}
