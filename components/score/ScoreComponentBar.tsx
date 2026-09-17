'use client'

import type { ScoreComponent } from '@/lib/score-calculator'

function barColor(ratio: number): string {
  if (ratio >= 0.75) return '#10B981'
  if (ratio >= 0.50) return '#2563EB'
  if (ratio >= 0.30) return '#F59E0B'
  return '#EF4444'
}

export function ScoreComponentBar({ component }: { component: ScoreComponent }) {
  const ratio = component.score / component.max
  const pct = Math.round(ratio * 100)
  const color = barColor(ratio)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span className="font-sans font-semibold text-navy" style={{ fontSize: 13 }}>
          {component.label}
        </span>
        <span className="font-outfit font-bold" style={{ fontSize: 13, color }}>
          {component.score}/{component.max}
        </span>
      </div>
      <div style={{
        height: 8,
        background: 'rgba(30,58,95,0.08)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.6s ease-out',
        }} />
      </div>
      <p className="font-sans text-gray-500" style={{ fontSize: 11, marginTop: 3 }}>
        {component.tip}
      </p>
    </div>
  )
}
