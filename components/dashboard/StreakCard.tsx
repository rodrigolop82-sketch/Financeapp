'use client'

interface StreakCardProps {
  currentStreak: number
  bestStreak: number
  weekDays: ('done' | 'today' | 'miss')[]  // L M M J V S D
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function StreakCard({ currentStreak, bestStreak, weekDays }: StreakCardProps) {
  if (currentStreak === 0) return null  // No mostrar si nunca ha registrado

  return (
    <div style={{ padding: '10px 16px 0' }}>
      <div style={{
        background: 'white', border: '0.5px solid #E2E8F0',
        borderRadius: 12, padding: '10px 14px',
        display: 'flex', alignItems: 'flex-start', gap: 10
      }}>
        <div style={{ fontSize: 22, lineHeight: 1 }}>🔥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#1E3A5F' }}>
            {currentStreak} {currentStreak === 1 ? 'día' : 'días'} registrando gastos
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
            {currentStreak >= bestStreak
              ? '¡Nuevo récord personal!'
              : `Tu mejor racha fue ${bestStreak} días`
            }
          </div>
          {/* Días de la semana */}
          <div style={{ display: 'flex', gap: 4, marginTop: 7 }}>
            {weekDays.map((day, i) => (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 500,
                background: day === 'done' ? '#DBEAFE' : day === 'today' ? '#2563EB' : '#F1F5F9',
                color: day === 'done' ? '#1E40AF' : day === 'today' ? 'white' : '#94A3B8',
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
