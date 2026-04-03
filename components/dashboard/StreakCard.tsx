'use client'

interface StreakCardProps {
  currentStreak: number
  bestStreak: number
  weekDays: ('done' | 'today' | 'miss')[]
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function StreakCard({ currentStreak, bestStreak, weekDays }: StreakCardProps) {
  if (currentStreak === 0) return null

  return (
    <div style={{ padding: '10px 16px 0' }}>
      <div className="card-zafi" style={{
        padding: '10px 14px',
        display: 'flex', alignItems: 'flex-start', gap: 10
      }}>
        <div style={{ fontSize: 22, lineHeight: 1 }}>&#128293;</div>
        <div style={{ flex: 1 }}>
          <div className="font-sans font-medium text-body-sm text-navy">
            {currentStreak} {currentStreak === 1 ? 'día' : 'días'} registrando gastos
          </div>
          <div className="font-sans text-caption text-ink-400" style={{ marginTop: 1 }}>
            {currentStreak >= bestStreak
              ? '¡Nuevo récord personal!'
              : `Tu mejor racha fue ${bestStreak} días`
            }
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 7 }}>
            {weekDays.map((day, i) => (
              <div key={i} className="font-sans font-medium" style={{
                width: 22, height: 22, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11,
                background: day === 'done' ? '#DBEAFE' : day === 'today' ? '#2563EB' : '#EEF2FB',
                color: day === 'done' ? '#1D4ED8' : day === 'today' ? 'white' : '#94A3B8',
              }}>
                {DAY_LABELS[i]}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
