'use client'
import { useMoneyFormat } from '@/lib/format'

interface StatusHeroProps {
  spent: number
  budget: number
  daysLeft: number
  userName: string
  score: number
  userInitials: string
}

function getStatusMessage(pct: number, daysLeft: number, userName: string): {
  text: string
  color: 'green' | 'amber' | 'red'
} {
  if (pct < 0.6) return { text: `Vas muy bien este mes, ${userName}`, color: 'green' }
  if (pct < 0.75) return { text: `Vas bien este mes, ${userName}`, color: 'green' }
  if (pct < 0.90) {
    if (daysLeft > 10) return { text: `Cuidado — vas un poco rápido, ${userName}`, color: 'amber' }
    return { text: `Vas bien para lo que queda, ${userName}`, color: 'green' }
  }
  if (pct < 1.0) return { text: `Casi al límite — frenate un poco, ${userName}`, color: 'amber' }
  return { text: `Superaste el presupuesto este mes, ${userName}`, color: 'red' }
}

export function StatusHero({ spent, budget, daysLeft, userName, score }: StatusHeroProps) {
  const { money } = useMoneyFormat()
  const remaining = Math.max(budget - spent, 0)
  const pct = budget > 0 ? spent / budget : 0
  const pctDisplay = Math.min(Math.round(pct * 100), 100)
  const status = getStatusMessage(pct, daysLeft, userName)

  const barColor =
    status.color === 'green' ? '#2563EB' :
    status.color === 'amber' ? '#F59E0B' : '#EF4444'

  const dotColor =
    status.color === 'green' ? '#22C55E' :
    status.color === 'amber' ? '#F59E0B' : '#EF4444'

  const scoreBorderColor =
    score >= 80 ? '#22C55E' :
    score >= 60 ? '#F59E0B' : '#EF4444'

  return (
    <div style={{
      background: '#1E3A5F', borderRadius: 20,
      padding: '32px 36px', color: '#fff',
      display: 'flex', flexDirection: 'column', gap: 22,
    }}>
      {/* Top row: status message + health score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '14.5px', color: '#CBD8E8' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: dotColor, display: 'inline-block', flexShrink: 0,
          }} />
          {status.text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: `3px solid ${scoreBorderColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15,
          }}>
            {score}
          </div>
          <div style={{ fontSize: 12, color: '#9FB3CB', lineHeight: 1.3 }}>
            Health<br/>Score
          </div>
        </div>
      </div>

      {/* Amount section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: 52, letterSpacing: '-0.01em',
          }}>
            {money(spent)}
          </div>
          <div style={{ fontSize: 16, color: '#9FB3CB' }}>
            de {money(budget)} gastado
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 8, borderRadius: 5,
          background: '#2A4A6E', marginTop: 16, overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.max(pctDisplay, 1)}%`, height: '100%',
            background: barColor, borderRadius: 5,
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 12, fontSize: 14, color: '#9FB3CB',
        }}>
          <div>
            Te quedan{' '}
            <span style={{ color: '#fff', fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
              {money(remaining)}
            </span>
          </div>
          <div>{daysLeft} días restantes</div>
        </div>
      </div>
    </div>
  )
}
