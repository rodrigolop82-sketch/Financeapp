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
      padding: '18px 18px 16px',
      marginBottom: 16,
    }}>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginBottom: 6 }}>
        Ahorrado en metas
      </p>
      <p style={{ fontSize: 28, fontWeight: 900, color: 'white', fontFamily: 'var(--font-outfit)', marginBottom: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>Q </span>
        {totalSaved.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
        de <span style={{ color: '#34D399', fontWeight: 600 }}>{formatMoney(totalTarget)}</span> en metas activas · {activeCount} {activeCount === 1 ? 'meta' : 'metas'} en curso
      </p>
    </div>
  )
}
