'use client'

// "Lo que sigue" en Inicio (C11): un solo aviso a la vez (lib/inicio
// loQueSigue). "Ahora no" lo esconde en esta sesión y muestra el siguiente.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { LoQueSigueItem } from '@/lib/inicio'

const STORE = 'zafi:lo-que-sigue:ahora-no'

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as string[]
  } catch {
    return []
  }
}

interface Props {
  items: LoQueSigueItem[]
  onRegisterIncome: () => void
  onStartMonth: () => void
  onAdd: () => void
}

export function LoQueSigue({ items, onRegisterIncome, onStartMonth, onAdd }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([])
  useEffect(() => { setDismissed(readDismissed()) }, [])

  const visible = items.filter((i) => !dismissed.includes(i.key))
  const item = visible[0]
  if (!item) return null
  const n = items.length - visible.length + 1

  function ahoraNo() {
    const next = [...dismissed, item.key]
    setDismissed(next)
    try { sessionStorage.setItem(STORE, JSON.stringify(next)) } catch { /* sin almacenamiento */ }
  }

  const primary = 'btn-primary'
  const action = (() => {
    switch (item.kind) {
      case 'ingreso': return <button type="button" onClick={onRegisterIncome} className={primary} style={{ borderRadius: 14 }}>Registrar ingreso</button>
      case 'cierre': return <Link href={`/cierre-mes?month=${item.month}`} className={primary} style={{ borderRadius: 14 }}>Continuar</Link>
      case 'inicio-mes': return <button type="button" onClick={onStartMonth} className={primary} style={{ borderRadius: 14 }}>Empezar</button>
      case 'sin-registrar': return <button type="button" onClick={onAdd} className={primary} style={{ borderRadius: 14 }}>Agregar</button>
      case 'paso': return <Link href="/plan/siguiente-paso" className={primary} style={{ borderRadius: 14 }}>Ver mi plan</Link>
      case 'ahorro': return <Link href="/plan" className={primary} style={{ borderRadius: 14 }}>Ver plan</Link>
    }
  })()

  return (
    <section
      aria-label="Lo que sigue"
      className="mt-3 flex flex-col gap-2 rounded-[20px] border border-electric/30 p-5 text-white"
      style={{ background: 'var(--zafi-hero)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#9FB3CB]">Lo que sigue</span>
        {items.length > 1 && <span className="text-[12.5px] text-[#9FB3CB]">{n} de {items.length}</span>}
      </div>
      <span className="text-[19px] font-bold leading-tight [text-wrap:pretty]">{item.title}</span>
      {item.body && <span className="text-sm leading-[1.45] text-[#CBD8E8] [text-wrap:pretty]">{item.body}</span>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {action}
        <button type="button" onClick={ahoraNo} className="flex h-11 items-center rounded-[14px] bg-white/[0.08] px-4 text-[15px] font-semibold">
          Ahora no
        </button>
      </div>
    </section>
  )
}
