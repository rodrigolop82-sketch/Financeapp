'use client'
import Link from 'next/link'
import { formatMoney } from '@/lib/format'
import type { Goal } from '@/hooks/useGoals'

interface GoalCardProps {
  goal: Goal
}

export function GoalCard({ goal }: GoalCardProps) {
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0

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
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(37,99,235,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {goal.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 3 }}>{goal.name}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              <span style={{ color: '#34D399', fontWeight: 600 }}>{formatMoney(goal.currentAmount)}</span>
              {' '}de {formatMoney(goal.targetAmount)}
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
        ) : goal.projection.status === 'behind' ? (
          <p style={{ fontSize: 12, color: '#FCD34D' }}>
            ⚠️ {goal.projection.message}
          </p>
        ) : goal.projection.status === 'on_track' ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            📅 A este ritmo: <span style={{ fontWeight: 600 }}>
              {goal.projection.estimatedDate?.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}
            </span>
          </p>
        ) : (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            {goal.projection.message}
          </p>
        )}
      </div>
    </Link>
  )
}
