'use client'

// "¿De quién es la tarjeta •• 4821?" al importar en un hogar de 2: la
// respuesta pasa a todos los movimientos y se recuerda en card_owners.

import { useState } from 'react'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { SheetHeader } from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON } from '@/components/movimientos/ui'
import { Note } from '@/components/plan/ui'
import { cardOwnerNote, type Person } from '@/lib/hogar'
import { ANY, PersonPick } from './PersonUI'

export function CardOwnerSheet({ open, last4, subtitle, count, people, defaultId, onDone }: {
  open: boolean
  last4: string
  subtitle?: string
  count: number
  people: Person[]
  defaultId: string | null
  /** id de la persona, o null para "Cualquiera". */
  onDone: (ownerId: string | null) => void
}) {
  const [who, setWho] = useState<string>(defaultId ?? ANY)
  const owner = people.find((p) => p.id === who) ?? null
  return (
    <BottomSheet open={open} onClose={() => onDone(owner?.id ?? null)} label="De quién es la tarjeta" themed>
      <div className="flex flex-col gap-4 px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-2">
        <SheetHeader emoji="💳" title={`¿De quién es la tarjeta •• ${last4}?`} subtitle={subtitle} />
        <PersonPick people={people.filter((p) => p.access === 'full')} value={who} onChange={setWho} withAny />
        <Note tone="info" className="">{cardOwnerNote(owner, count)}</Note>
        <button type="button" onClick={() => onDone(owner?.id ?? null)} className={PRIMARY_BUTTON}>Continuar</button>
      </div>
    </BottomSheet>
  )
}
