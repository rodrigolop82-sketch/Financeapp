'use client'

// Hoja para quien está en modo solo ver e intenta registrar: no le habla de
// pagos (eso es del dueño), le ofrece "Avisarle a {dueño}".

import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { SheetHeader } from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON, TEXT_MUTED } from '@/components/movimientos/ui'
import { Note } from '@/components/plan/ui'

export const OPEN_VIEW_ONLY_EVENT = 'zafi:open-view-only'

export function openViewOnlySheet() {
  window.dispatchEvent(new CustomEvent(OPEN_VIEW_ONLY_EVENT))
}

export function ViewOnlySheet() {
  const [open, setOpen] = useState(false)
  const [owner, setOwner] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setState('idle')
      fetch('/api/billing/status', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => setOwner(s?.ownerName ?? null))
        .catch(() => {})
    }
    window.addEventListener(OPEN_VIEW_ONLY_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_VIEW_ONLY_EVENT, onOpen)
  }, [])

  async function notify() {
    setState('sending')
    const res = await fetch('/api/familia/avisar', { method: 'POST' }).catch(() => null)
    setState(res?.ok ? 'sent' : 'error')
  }

  const name = owner || 'el dueño del hogar'
  return (
    <BottomSheet open={open} onClose={() => setOpen(false)} label="Modo solo ver" themed>
      <div className="flex flex-col gap-4 px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-2">
        <SheetHeader emoji="👀" title="Estás en modo solo ver" subtitle={`Ves todo lo del hogar; registrar lo activa ${name}.`} />
        <p className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
          Con el plan Familiar los dos registran sus gastos y cada uno recibe sus recordatorios.
        </p>
        {state === 'sent' && <Note tone="ok" className="">Listo, le avisamos a {name}.</Note>}
        {state === 'error' && <Note tone="warn" className="">No pudimos avisar. Intenta de nuevo.</Note>}
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={notify} disabled={state === 'sending' || state === 'sent'} className={PRIMARY_BUTTON}>
            {state === 'sending' ? 'Avisando…' : `Avisarle a ${name}`}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>Ahora no</button>
        </div>
      </div>
    </BottomSheet>
  )
}
