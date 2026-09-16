'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MonthNavigatorProps {
  label: string
  isCurrent: boolean
  dayOfMonth?: number
  daysInMonth?: number
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  onTap: () => void
}

export function MonthNavigator({
  label, isCurrent, dayOfMonth, daysInMonth,
  canGoPrev, canGoNext, onPrev, onNext, onTap,
}: MonthNavigatorProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 16, marginBottom: 20, userSelect: 'none',
    }}>
      <button
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Mes anterior"
        style={{
          background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default',
          padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center',
          opacity: canGoPrev ? 1 : 0.3,
        }}
      >
        <ChevronLeft style={{ width: 22, height: 22, color: '#1E3A5F' }} />
      </button>

      <button
        onClick={onTap}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '4px 12px', borderRadius: 12,
        }}
      >
        <span style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
          fontSize: 18, color: '#1E3A5F', textTransform: 'capitalize',
        }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: '#7E93AE', fontWeight: 500 }}>
          {isCurrent
            ? `En curso · día ${dayOfMonth} de ${daysInMonth}`
            : 'Mes cerrado'
          }
        </span>
      </button>

      <button
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Mes siguiente"
        style={{
          background: 'none', border: 'none', cursor: canGoNext ? 'pointer' : 'default',
          padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center',
          opacity: canGoNext ? 1 : 0.3,
        }}
      >
        <ChevronRight style={{ width: 22, height: 22, color: '#1E3A5F' }} />
      </button>
    </div>
  )
}
