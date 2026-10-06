'use client'
import { formatMoney } from '@/lib/format'
import { HERO, HERO_MUTED, HERO_STYLE } from '@/components/layout/Pantalla'
import { PairAvatar, personClass } from '@/components/hogar/PersonUI'
import type { Person } from '@/lib/hogar'

export type GoalDetailState = 'on_track' | 'behind' | 'paused' | 'completed'

const CHIP: Record<GoalDetailState, { label: string; dot: string }> = {
  on_track: { label: 'En camino', dot: '#22C55E' },
  behind: { label: 'Atrasada', dot: '#F59E0B' },
  paused: { label: 'Pausada', dot: '#94A3B8' },
  completed: { label: 'Completada', dot: '#22C55E' },
}

const BAR: Record<GoalDetailState, string> = {
  on_track: '#22C55E',
  behind: '#F59E0B',
  paused: '#94A3B8',
  completed: '#22C55E',
}

interface GoalDetailHeroProps {
  emoji: string
  state: GoalDetailState
  currentAmount: number
  targetAmount: number
  /** Meta compartida: avatares dobles y barra apilada por persona. */
  split?: { people: Person[]; by: Record<string, number> }
}

/** Hero navy sólido del detalle de meta: llevas, de cuánto, barra y faltante. */
export function GoalDetailHero({ emoji, state, currentAmount, targetAmount, split }: GoalDetailHeroProps) {
  const ratio = targetAmount > 0 ? currentAmount / targetAmount : 0
  const left = Math.max(0, targetAmount - currentAmount)
  const chip = CHIP[state]
  return (
    <section aria-label="Llevas ahorrado" className={`mt-3.5 flex flex-col gap-1.5 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white/[0.08] text-[22px]">{emoji}</span>
          <span className={`text-[15px] ${HERO_MUTED}`}>{split ? 'Llevan ahorrado' : 'Llevas ahorrado'}</span>
          {split && <PairAvatar people={split.people} size={30} />}
        </span>
        <span className="flex flex-none items-center gap-1.5 rounded-full bg-white/[0.08] px-[11px] py-[5px] text-[13px] font-semibold">
          <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ background: chip.dot }} />
          {chip.label}
        </span>
      </div>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
        <span className="font-outfit text-[46px] font-extrabold leading-none tracking-[-0.02em]">{formatMoney(currentAmount)}</span>
        <span className="text-base text-[#9FB3CB]">de {formatMoney(targetAmount)}</span>
      </p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-[5px] bg-[#2A4A6E]"
        role="progressbar"
        aria-label="Avance de la meta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(1, ratio) * 100)}
      >
        {split ? (
          <div className="flex h-full gap-0.5" style={{ width: `${Math.min(100, ratio * 100)}%` }}>
            {split.people.filter((p) => (split.by[p.id] ?? 0) > 0).map((p) => (
              <div key={p.id} className={`h-full transition-[width] duration-[600ms] ${personClass(p, true)}`} style={{ width: `${((split.by[p.id] ?? 0) / Math.max(1, currentAmount)) * 100}%` }} />
            ))}
          </div>
        ) : (
          <div className="h-full rounded-[5px] transition-[width] duration-[600ms]" style={{ width: `${Math.min(100, ratio * 100)}%`, background: BAR[state] }} />
        )}
      </div>
      {split ? (
        <div className="mt-1 flex justify-between gap-2 text-[13.5px] text-[#CBD8E8]">
          {split.people.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-2 w-2 rounded-full ${personClass(p, true)}`} />
              {p.name} <b className="whitespace-nowrap font-outfit text-white">{formatMoney(split.by[p.id] ?? 0)}</b>
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex justify-between text-[13.5px] text-[#9FB3CB]">
          <span><b className="font-outfit text-white">{Math.min(100, Math.round(ratio * 100))}%</b> completado</span>
          <span>{left > 0 ? <>Te faltan <b className="font-outfit text-white">{formatMoney(left)}</b></> : '¡Meta lograda!'}</span>
        </div>
      )}
    </section>
  )
}
