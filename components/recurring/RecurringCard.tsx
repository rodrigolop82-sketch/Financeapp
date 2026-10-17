'use client'

// Fila "Suscripciones y pagos fijos" en el detalle de Cómo te fue. Los
// totales salen de lib/recurring/definicion (los mismos de Suscripciones).

import { DetalleLink } from '@/components/resumen/VerDetalle'
import { useRecurring } from './useRecurring'

export function RecurringCard({ fmt }: { fmt: (n: number) => string }) {
  const { state } = useRecurring()
  const data = state.status === 'ok' ? state.data : null
  const parts = data
    ? [
        data.suscripciones.cantidad > 0 ? `${fmt(data.suscripciones.mensual)} al mes` : null,
        data.pagosFijos.cantidad > 0 ? `fijos ${fmt(data.pagosFijos.mensual)}` : null,
      ].filter(Boolean)
    : []
  return <DetalleLink href="/resumen/suscripciones" title="Suscripciones y pagos fijos" value={parts.join(' · ') || null} />
}
