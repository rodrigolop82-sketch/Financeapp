'use client'

// "¿Quién pagó?" + "Es para: La casa / Solo {nombre}" en Agregar y en
// "Entendí esto". Solo se muestra en hogares con 2+ personas completas.

import { Segmented } from '@/components/layout/Pantalla'
import { TEXT_MUTED } from '@/components/movimientos/ui'
import { scopeHelp, type Person } from '@/lib/hogar'
import { PersonPick } from './PersonUI'

export type Scope = 'shared' | 'personal'

export function WhoPaidFields({ people, paidBy, scope, onChange }: {
  people: Person[]
  paidBy: string
  scope: Scope
  onChange: (patch: { paidBy?: string; scope?: Scope }) => void
}) {
  const payer = people.find((p) => p.id === paidBy) ?? people[0]
  return (
    <div className="flex flex-col gap-3">
      <PersonPick label="¿Quién pagó?" people={people.filter((p) => p.access === 'full')} value={paidBy} onChange={(id) => onChange({ paidBy: id })} />
      <div className="flex flex-col gap-1.5">
        <Segmented
          label="Es para"
          options={[{ value: 'shared', label: 'La casa' }, { value: 'personal', label: `Solo ${payer?.name ?? 'yo'}` }]}
          value={scope}
          onChange={(v) => onChange({ scope: v })}
        />
        <span className={`px-1 text-[13px] ${TEXT_MUTED}`}>{scopeHelp(scope)}</span>
      </div>
    </div>
  )
}
