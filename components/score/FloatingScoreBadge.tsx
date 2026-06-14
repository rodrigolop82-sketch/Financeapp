'use client'

import { useRouter } from 'next/navigation'
import type { HealthScoreResult } from '@/lib/score-calculator'

interface FloatingScoreBadgeProps {
  score: HealthScoreResult | null
  loading?: boolean
}

export function FloatingScoreBadge({ score, loading }: FloatingScoreBadgeProps) {
  const router = useRouter()

  if (loading || !score) return null

  const size = 52
  const sw = 3.5
  const r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score.total / 100) * circ

  return (
    <button
      onClick={() => router.push('/score')}
      aria-label={`Health Score: ${score.total}`}
      style={{
        position: 'fixed',
        bottom: 88,
        right: 16,
        zIndex: 45,
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#1E3A5F',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(30,58,95,0.35)',
        padding: 0,
      }}
    >
      <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={sw}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={score.color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <span
        className="font-outfit font-black text-white"
        style={{ fontSize: 16, position: 'relative', zIndex: 1 }}
      >
        {score.total}
      </span>
    </button>
  )
}
