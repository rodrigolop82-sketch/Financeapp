'use client'

interface StreakCardResumenProps {
  currentStreak: number
  bestStreak: number
  weekDays: ('done' | 'today' | 'miss')[]
}

const DAY_LABELS = ['L','M','X','J','V','S','D']

export function StreakCardResumen({ currentStreak, bestStreak, weekDays }: StreakCardResumenProps) {
  return (
    <div style={{ margin: '0 16px 16px', background: '#F8FAFC', borderRadius: 16, padding: '16px 18px', border: '1px solid #E2E8F0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Racha actual</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#1E3A5F', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            🔥 {currentStreak} días
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mejor racha</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#64748B', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            {bestStreak} días
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {weekDays.map((status, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: status === 'done' ? '#2563EB' : status === 'today' ? '#EFF6FF' : '#E2E8F0',
              border: status === 'today' ? '2px solid #2563EB' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>
              {status === 'done' ? '✓' : status === 'today' ? '·' : ''}
            </div>
            <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{DAY_LABELS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
