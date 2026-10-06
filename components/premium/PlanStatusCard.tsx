'use client'

// Fila de estado del plan (Tile 👑) que lleva a /planes: "Prueba Premium ·
// Quedan N días", "Plan Gratis", "Familiar · Casa Pérez", "No pudimos cobrar".

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Chevron, RowBody, Tile } from '@/components/layout/Pantalla'
import { CARD } from '@/components/resumen/ctf-ui'
import { planStatusRow } from '@/lib/planes'

type Status = Parameters<typeof planStatusRow>[0]

export function PlanStatusCard() {
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    fetch('/api/billing/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  if (!status) return null
  const row = planStatusRow(status)
  const hintClass = row.tone === 'danger'
    ? 'text-danger-text dark:text-[var(--zafi-error-text)]'
    : row.tone === 'warn' ? 'text-warning-text dark:text-warning' : ''

  return (
    <Link href="/planes" className={`flex items-center gap-3 p-3.5 no-underline transition-opacity active:opacity-70 ${CARD}`}>
      <RowBody
        tile={<Tile className="bg-electric-ghost dark:bg-[#1B2B4D]">👑</Tile>}
        name={row.title}
        help={hintClass ? <span className={hintClass}>{row.hint}</span> : row.hint}
      />
      <Chevron />
    </Link>
  )
}
