'use client'
import { useMoneyFormat } from '@/lib/format'

interface StatusHeroProps {
  spent: number
  budget: number
  daysLeft: number
}

function getStatusMessage(pct: number, daysLeft: number): {
  text: string
  color: 'green' | 'amber' | 'red'
} {
  if (pct < 0.6) return { text: 'Vas muy bien este mes', color: 'green' }
  if (pct < 0.75) return { text: 'Vas bien este mes', color: 'green' }
  if (pct < 0.90) {
    if (daysLeft > 10) return { text: 'Cuidado — vas un poco rápido', color: 'amber' }
    return { text: 'Vas bien para lo que queda', color: 'green' }
  }
  if (pct < 1.0) return { text: 'Casi al límite — frenate un poco', color: 'amber' }
  return { text: 'Superaste el presupuesto este mes', color: 'red' }
}

export function StatusHero({ spent, budget, daysLeft }: StatusHeroProps) {
  const { money } = useMoneyFormat()
  const remaining = Math.max(budget - spent, 0)
  const pct = budget > 0 ? spent / budget : 0
  const pctDisplay = Math.min(Math.round(pct * 100), 100)
  const status = getStatusMessage(pct, daysLeft)

  const barColor =
    status.color === 'green' ? '#2563EB' :
    status.color === 'amber' ? '#F59E0B' : '#EF4444'

  const dotColor =
    status.color === 'green' ? '#10B981' :
    status.color === 'amber' ? '#F59E0B' : '#EF4444'

  return (
    <div style={{ background: '#1E3A5F', padding: '0 16px 18px' }}>

      {/* Mensaje emocional */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dotColor, flexShrink: 0
        }}/>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
          {status.text}
        </span>
      </div>

      {/* Números + barra */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Gastado / total */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 28, fontWeight: 500, color: 'white', letterSpacing: '-.02em' }}>
              {money(spent)}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginLeft: 4 }}>
              / {money(budget)}
            </span>
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.45)' }}>
            {pctDisplay}%
          </span>
        </div>

        {/* Barra de progreso */}
        <div style={{
          height: 8, background: 'rgba(255,255,255,.15)',
          borderRadius: 4, overflow: 'hidden'
        }}>
          <div style={{
            height: 8, width: `${pctDisplay}%`,
            background: barColor, borderRadius: 4,
            transition: 'width .5s ease'
          }}/>
        </div>

        {/* Dinero restante + días */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginBottom: 1 }}>
              Te quedan
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'white' }}>
              {money(remaining)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textAlign: 'right' }}>
            {daysLeft} días restantes
          </div>
        </div>
      </div>
    </div>
  )
}
