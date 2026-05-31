'use client'
import React from 'react'
import { useMoneyFormat } from '@/lib/format'
import { Wordmark } from '@/components/brand/Wordmark'
import { AppIcon } from '@/components/brand/AppIcon'
import { ScoreRing } from '@/components/ui/ScoreRing'

interface StatusHeroProps {
  spent: number
  budget: number
  daysLeft: number
  userName: string
  score: number
  userInitials: string
  filterSlot?: React.ReactNode
  isHistorical?: boolean
}

function getStatusMessage(pct: number, daysLeft: number, userName: string, isHistorical?: boolean): {
  text: string
  color: 'green' | 'amber' | 'red'
} {
  if (isHistorical) {
    if (pct < 0.9) return { text: `Buen control ese período, ${userName}`, color: 'green' }
    if (pct < 1.0) return { text: `Casi al límite ese período, ${userName}`, color: 'amber' }
    return { text: `Superaste el presupuesto ese período, ${userName}`, color: 'red' }
  }
  if (pct < 0.6) return { text: `Vas muy bien este mes, ${userName}`, color: 'green' }
  if (pct < 0.75) return { text: `Vas bien este mes, ${userName}`, color: 'green' }
  if (pct < 0.90) {
    if (daysLeft > 10) return { text: `Cuidado — vas un poco rápido, ${userName}`, color: 'amber' }
    return { text: `Vas bien para lo que queda, ${userName}`, color: 'green' }
  }
  if (pct < 1.0) return { text: `Casi al límite — frenate un poco, ${userName}`, color: 'amber' }
  return { text: `Superaste el presupuesto este mes, ${userName}`, color: 'red' }
}

export function StatusHero({ spent, budget, daysLeft, userName, score, userInitials, filterSlot, isHistorical }: StatusHeroProps) {
  const { money } = useMoneyFormat()
  const remaining = Math.max(budget - spent, 0)
  const pct = budget > 0 ? spent / budget : 0
  const pctDisplay = Math.min(Math.round(pct * 100), 100)
  const status = getStatusMessage(pct, daysLeft, userName, isHistorical)

  const barColor =
    status.color === 'green' ? '#2563EB' :
    status.color === 'amber' ? '#F59E0B' : '#EF4444'

  const dotColor =
    status.color === 'green' ? '#10B981' :
    status.color === 'amber' ? '#F59E0B' : '#EF4444'

  return (
    <div className="relative overflow-hidden" style={{ background: '#1E3A5F', borderRadius: 20, margin: '12px 16px 0' }}>
      {/* Decorative rings */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full border border-electric/20 pointer-events-none" />
      <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full border border-electric/[0.12] pointer-events-none" />

      {/* TopBar integrado — solo visible en mobile */}
      <div className="lg:hidden relative z-10" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AppIcon size="xs" variant="electric" />
          <Wordmark variant="dark" size="xs" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScoreRing score={score} size={34} strokeWidth={3} variant="dark" showLabel={false} />
          <span className="font-outfit font-bold text-caption text-white">{score}</span>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(37,99,235,0.3)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="font-sans font-semibold text-caption text-electric-pale">{userInitials}</span>
          </div>
        </div>
      </div>

      {/* Contenido hero */}
      <div className="relative z-10" style={{ padding: '6px 18px 22px' }}>

        {/* Mensaje emocional */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor, flexShrink: 0
          }}/>
          <span className="font-sans text-body-sm text-white/[0.85]">
            {status.text}
          </span>
        </div>

        {/* Números + barra */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Gastado / total */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <span className="font-outfit font-extrabold text-white tracking-[-0.03em]" style={{ fontSize: 32 }}>
                {money(spent)}
              </span>
              <span className="font-sans text-body-sm text-white/[0.45]" style={{ marginLeft: 4 }}>
                / {money(budget)}
              </span>
            </div>
            <span className="font-outfit font-bold text-body-sm text-white/[0.45]">
              {pctDisplay}%
            </span>
          </div>

          {/* Barra de progreso */}
          <div style={{
            height: 9, background: 'rgba(255,255,255,.12)',
            borderRadius: 5, overflow: 'hidden'
          }}>
            <div style={{
              height: 9, width: `${pctDisplay}%`,
              background: barColor, borderRadius: 5,
              transition: 'width .5s ease'
            }}/>
          </div>

          {/* Dinero restante + días */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div className="font-sans text-caption text-white/[0.45]" style={{ marginBottom: 1 }}>
                Te quedan
              </div>
              <div className="font-outfit font-extrabold text-white tracking-[-0.02em]" style={{ fontSize: 24 }}>
                {money(remaining)}
              </div>
            </div>
            <div className="font-sans text-caption text-white/[0.35] text-right">
              {isHistorical ? 'período anterior' : `${daysLeft} días restantes`}
            </div>
          </div>
        </div>
      </div>

      {/* Filter slot — rendered at bottom of hero card */}
      {filterSlot}
    </div>
  )
}
