'use client'

// Tarjeta en Cómo te fue: "5 cobros recurrentes · Q 655/mes". Solo aparece
// con 2 o más cobros activos detectados.

import Link from 'next/link'
import { CARD, GROUP_LABEL } from '@/components/resumen/ctf-ui'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { useRecurring } from './useRecurring'

export function RecurringCard({ fmt }: { fmt: (n: number) => string }) {
  const { state } = useRecurring()
  if (state.status !== 'ok' || state.data.totals.activeCount < 2) return null
  const t = state.data.totals
  return (
    <Link
      href="/resumen/suscripciones"
      className={`mt-3 flex min-h-[52px] items-center gap-3 px-4 py-3.5 transition-transform duration-150 active:scale-[0.98] ${CARD}`}
    >
      <span aria-hidden className="text-xl">🔁</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`${GROUP_LABEL} ${TEXT_MUTED}`}>Suscripciones</span>
        <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>
          {t.activeCount} cobros recurrentes · {fmt(t.monthlyTotal)}/mes
        </span>
      </span>
      <span aria-hidden className="font-bold text-electric">›</span>
    </Link>
  )
}
