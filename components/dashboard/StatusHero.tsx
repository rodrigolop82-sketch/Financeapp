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

export function StatusHero({ spent, budget, daysLeft, userName, score, userInitials }: StatusHeroProps) {
  const { money } = useMoneyFormat()
  const remaining = Math.max(budget - spent, 0)
  const pct = budget > 0 ? spent / budget : 0
  const pctDisplay = Math.min(Math.round(pct * 100), 100)
  const status = getStatusMessage(pct, daysLeft, userName)

  const barColor =
    status.color === 'green' ? '#2563EB' :
    status.color === 'amber' ? '#F59E0B' : '#EF4444'

  const dotColor =
    status.color === 'green' ? '#10B981' :
    status.color === 'amber' ? '#F59E0B' : '#EF4444'

  return (
    <div style={{ background: '#1E3A5F', borderRadius: 20, margin: '12px 16px 0', overflow: 'hidden' }}>

      {/* TopBar integrado — solo visible en mobile */}
      <div className="lg:hidden" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, background: '#2563EB', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>Z</span>
          </div>
          <span style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>Zafi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,.12)', borderRadius: 20,
            padding: '4px 10px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.9)', fontWeight: 500 }}>
              {score} pts
            </span>
          </div>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#2563EB', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>{userInitials}</span>
          </div>
        </div>
      </div>

      {/* Contenido hero */}
      <div style={{ padding: '10px 16px 18px' }}>

        {/* Mensaje emocional */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor, flexShrink: 0
          }}/>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,.85)' }}>
            {status.text}
          </span>
        </div>

        {/* Números + barra */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Gastado / total */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 30, fontWeight: 500, color: 'white', letterSpacing: '-.02em' }}>
                {money(spent)}
              </span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', marginLeft: 4 }}>
                / {money(budget)}
              </span>
            </div>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,.45)' }}>
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
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginBottom: 1 }}>
                Te quedan
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'white' }}>
                {money(remaining)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', textAlign: 'right' }}>
              {daysLeft} días restantes
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
