'use client'
import Link from 'next/link'
import { formatMoney } from '@/lib/format'
import type { Goal } from '@/hooks/useGoals'

interface GoalCardProps {
  goal: Goal
}

export function GoalCard({ goal }: GoalCardProps) {
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0

  const projectionColor = (() => {
    switch (goal.projection.status) {
      case 'on_track': return 'rgba(255,255,255,0.5)'
      case 'behind': return '#FCD34D'
      case 'no_data': return 'rgba(255,255,255,0.3)'
      case 'completed': return '#34D399'
      default: return 'rgba(255,255,255,0.5)'
    }
  })()

  const projectionIcon = (() => {
    switch (goal.projection.status) {
      case 'on_track': return '📅'
      case 'behind': return '⚠️'
      case 'completed': return '✅'
      default: return ''
    }
  })()

  return (
    <Link href={`/metas/${goal.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(37,99,235,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            {goal.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 2 }}>{goal.name}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              {formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}
            </p>
          </div>
          <p style={{
            fontSize: 22, fontWeight: 900, color: '#34D399',
            fontFamily: 'var(--font-outfit)',
          }}>
            {pct}%
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden', marginBottom: 8,
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #2563EB, #34D399)',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Projection */}
        {goal.projection.status === 'completed' ? (
          <div style={{
            display: 'inline-block', padding: '3px 10px',
            background: 'rgba(52,211,153,0.15)', borderRadius: 8,
            fontSize: 12, fontWeight: 600, color: '#34D399',
          }}>
            ✅ Completada
          </div>
        ) : (
          <p style={{ fontSize: 12, color: projectionColor }}>
            {projectionIcon} {goal.projection.message}
          </p>
        )}
      </div>
    </Link>
  )
}
