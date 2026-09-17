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
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#EEF2FB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {goal.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>{goal.name}</p>
            <p style={{ fontSize: 12, color: '#64748B' }}>
              <span style={{ color: '#10B981', fontWeight: 600 }}>{formatMoney(goal.currentAmount)}</span>
              {' '}de {formatMoney(goal.targetAmount)}
            </p>
          </div>
          <p style={{
            fontSize: 22, fontWeight: 900, color: '#10B981',
            fontFamily: 'var(--font-outfit)',
          }}>
            {pct}%
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6, borderRadius: 3,
          background: '#E2E8F0',
          overflow: 'hidden', marginBottom: 8,
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #2563EB, #10B981)',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Projection */}
        {goal.projection.status === 'completed' ? (
          <div style={{
            display: 'inline-block', padding: '3px 10px',
            background: '#D1FAE5', borderRadius: 8,
            fontSize: 12, fontWeight: 600, color: '#065F46',
          }}>
            ✅ Completada
          </div>
        ) : goal.projection.status === 'behind' ? (
          <p style={{ fontSize: 12, color: '#92400E' }}>
            ⚠️ {goal.projection.message}
          </p>
        ) : goal.projection.status === 'on_track' ? (
          <p style={{ fontSize: 12, color: '#64748B' }}>
            📅 A este ritmo: <span style={{ fontWeight: 600, color: '#334155' }}>
              {goal.projection.estimatedDate?.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}
            </span>
          </p>
        ) : (
          <p style={{ fontSize: 12, color: '#94A3B8' }}>
            {goal.projection.message}
          </p>
        )}
      </div>
    </Link>
  )
}
