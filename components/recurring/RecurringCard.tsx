'use client'

// Tarjeta en Cómo te fue: "Suscripciones Q 250/mes · Pagos fijos Q 1,980/mes".
// Los totales salen de lib/recurring/definicion (los mismos de Suscripciones).

import Link from 'next/link'
import { CARD, GROUP_LABEL } from '@/components/resumen/ctf-ui'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { useRecurring } from './useRecurring'

export function RecurringCard({ fmt }: { fmt: (n: number) => string }) {
  const { state } = useRecurring()
  if (state.status !== 'ok') return null
  const { suscripciones, pagosFijos } = state.data
  if (suscripciones.cantidad === 0 && pagosFijos.cantidad === 0) return null
  const parts = [
    suscripciones.cantidad > 0 ? `Suscripciones ${fmt(suscripciones.mensual)}/mes` : null,
    pagosFijos.cantidad > 0 ? `Pagos fijos ${fmt(pagosFijos.mensual)}/mes` : null,
  ].filter(Boolean)
  return (
    <Link
      href="/resumen/suscripciones"
      className={`mt-3 flex min-h-[52px] items-center gap-3 px-4 py-3.5 transition-transform duration-150 active:scale-[0.98] ${CARD}`}
    >
      <span aria-hidden className="text-xl">🔁</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`${GROUP_LABEL} ${TEXT_MUTED}`}>Suscripciones y pagos fijos</span>
        <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{parts.join(' · ')}</span>
      </span>
      <span aria-hidden className="font-bold text-electric">›</span>
    </Link>
  )
}
