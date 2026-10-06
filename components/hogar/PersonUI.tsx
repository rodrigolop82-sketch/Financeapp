'use client'

// Piezas del hogar: avatar por persona (dueño navy, miembro azul suave),
// avatares dobles, selector de persona de 44px y barra apilada.

import { FieldLabel } from '@/components/layout/Pantalla'
import { TEXT_STRONG } from '@/components/movimientos/ui'
import { initialOf, type Person } from '@/lib/hogar'

/** Color de cada persona en barras y puntos: dueño navy (blanco sobre el hero), miembro electric. */
export function personClass(p: Person | null | undefined, onHero = false): string {
  if (!p) return 'bg-ink-400'
  if (!p.owner) return 'bg-electric'
  return onHero ? 'bg-white' : 'bg-navy dark:bg-ink-200'
}

export function PersonAvatar({ person, size = 40, ring = false }: { person: Person | null | undefined; size?: number; ring?: boolean }) {
  const owner = !!person?.owner
  return (
    <span
      aria-hidden
      className={`flex flex-none items-center justify-center rounded-full font-bold ${
        owner ? 'bg-navy text-white dark:bg-electric' : 'bg-electric-ghost text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft'
      }`}
      style={{
        width: size,
        height: size,
        fontSize: size >= 36 ? 14 : size >= 24 ? 11 : 9,
        boxShadow: ring ? '0 0 0 2px var(--zafi-card)' : undefined,
      }}
    >
      {person ? initialOf(person.name) : '?'}
    </span>
  )
}

/** Dos avatares encimados ("los dos"). */
export function PairAvatar({ people, size = 30 }: { people: Person[]; size?: number }) {
  const s = Math.round(size * 0.72)
  return (
    <span aria-hidden className="flex flex-none">
      {people.slice(0, 2).map((p, i) => (
        <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -Math.round(size * 0.28) }}>
          <PersonAvatar person={p} size={s} ring />
        </span>
      ))}
    </span>
  )
}

/** Tile con el avatar de quien pagó abajo a la derecha. */
export function TileWithAvatar({ tile, person }: { tile: React.ReactNode; person: Person | null }) {
  return (
    <span className="relative flex-none">
      {tile}
      {person && (
        <span className="absolute -bottom-1 -right-1">
          <PersonAvatar person={person} size={20} ring />
        </span>
      )}
    </span>
  )
}

export const ANY = 'any'

/** Pastillas de persona de 44px; con `withAny`, también "Cualquiera". */
export function PersonPick({ people, value, onChange, label, withAny = false }: {
  people: Person[]
  value: string | null
  onChange: (id: string) => void
  label?: string
  withAny?: boolean
}) {
  const options = [...people.map((p) => ({ id: p.id, person: p as Person | null })), ...(withAny ? [{ id: ANY, person: null }] : [])]
  return (
    <div className="flex flex-col gap-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map(({ id, person }) => {
          const on = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(id)}
              className={`flex h-11 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[14.5px] font-semibold transition duration-150 active:scale-[0.96] ${TEXT_STRONG} ${
                on ? 'border-2 border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : 'border border-[var(--zafi-border)] bg-[var(--zafi-card)]'
              }`}
            >
              {person ? (
                <PersonAvatar person={person} size={32} />
              ) : (
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--zafi-tab-bg)]">👪</span>
              )}
              {person ? person.name : 'Cualquiera'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Barra apilada por persona (gap 2px). */
export function SplitBar({ parts, height = 8, track = 'var(--zafi-border-light)', onHero = false }: {
  parts: { person: Person | null; value: number }[]
  height?: number
  track?: string
  onHero?: boolean
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <div className="flex gap-0.5 overflow-hidden rounded-[5px]" style={{ height, background: track }}>
      {parts.filter((p) => p.value > 0).map((p, i) => (
        <div
          key={p.person?.id ?? i}
          className={`transition-[width] duration-500 ${personClass(p.person, onHero)}`}
          style={{ width: `${(p.value / total) * 100}%` }}
        />
      ))}
    </div>
  )
}
