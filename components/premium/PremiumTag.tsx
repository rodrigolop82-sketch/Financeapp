'use client'

// Etiqueta "Premium" para acciones de pago dentro de una pantalla gratis:
// la acción se ve, y al tocarla abre /planes (sin muros ni precios nuevos).

import Link from 'next/link'
import type { PlanFrom } from '@/lib/planes'

export const PREMIUM_BADGE =
  'inline-flex flex-none items-center gap-1 rounded-full bg-warning-light px-2 py-0.5 text-[11.5px] font-bold text-warning-text dark:bg-warning/15 dark:text-warning'

export function PremiumBadge() {
  return <span className={PREMIUM_BADGE}><span aria-hidden>👑</span>Premium</span>
}

/** Enlace a /planes con el origen, para que se muestre primero ese beneficio. */
export function upgradeHref(from: PlanFrom): string {
  return `/planes?from=${from}`
}

/** Acción Premium bloqueada: se ve completa y lleva al upgrade. */
export function PremiumAction({ from, children, className = '' }: {
  from: PlanFrom
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link href={upgradeHref(from)} className={`flex min-h-11 items-center gap-2 ${className}`}>
      {children}
      <PremiumBadge />
    </Link>
  )
}
