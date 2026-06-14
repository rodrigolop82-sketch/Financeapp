'use client'
import { formatMoney } from '@/lib/format'

interface GoalDetailHeroProps {
  emoji: string
  name: string
  currentAmount: number
  targetAmount: number
}

export function GoalDetailHero({ emoji, name, currentAmount, targetAmount }: GoalDetailHeroProps) {
  const pct = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0

  return (
    <div style={{
      background: 'linear-gradient(145deg, #1E3A5F, #112236)',
      border: '1px solid rgba(37,99,235,0.2)',
      borderRadius: 16,
      padding: '24px 18px',
      textAlign: 'center',
      marginBottom: 16,
    }}>
      <span style={{ fontSize: 48 }}>{emoji}</span>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'white', marginTop: 8, marginBottom: 4 }}>{name}</p>
      <p style={{ fontSize: 22, fontWeight: 900, color: 'white', fontFamily: 'var(--font-outfit)', marginBottom: 4 }}>
        {formatMoney(currentAmount)} <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/ {formatMoney(targetAmount)}</span>
      </p>

      {/* Progress bar */}
      <div style={{
        height: 8, borderRadius: 4,
        background: 'rgba(255,255,255,0.1)',
        overflow: 'hidden', margin: '12px 0 8px',
      }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #2563EB, #34D399)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      <p style={{ fontSize: 14, fontWeight: 700, color: '#34D399', fontFamily: 'var(--font-outfit)' }}>
        {pct}% completado
      </p>
    </div>
  )
}
