'use client'

import { cn } from '@/lib/utils'

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  variant?: 'light' | 'dark'
  showLabel?: boolean
  className?: string
}

function scoreColor(score: number): string {
  if (score >= 75) return '#10B981'
  if (score >= 50) return '#2563EB'
  if (score >= 25) return '#F59E0B'
  return '#EF4444'
}

export function ScoreRing({
  score,
  size = 96,
  strokeWidth = 6,
  variant = 'light',
  showLabel = true,
  className,
}: ScoreRingProps) {
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = scoreColor(score)
  const cx = size / 2
  const cy = size / 2

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={variant === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(30,58,95,0.08)'}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-outfit font-black leading-none tracking-tight"
            style={{
              fontSize: size * 0.28,
              color: variant === 'dark' ? '#fff' : '#1E3A5F',
            }}
          >
            {score}
          </span>
          <span
            className="font-sans font-medium leading-none"
            style={{
              fontSize: size * 0.1,
              color: color,
              marginTop: size * 0.02,
            }}
          >
            / 100
          </span>
        </div>
      )}
    </div>
  )
}
