'use client'
// Piezas de las hojas de instalar la app (Android e iOS).

import { AppIcon } from '@/components/brand/AppIcon'
import { ListCard, ROW_DIVIDER } from '@/components/layout/Pantalla'
import { SHEET_TITLE, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'

export function InstallHeader({ title = 'Instala Zafi', subtitle = 'Ábrela como una app, sin tienda.' }: { title?: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <AppIcon size="md" variant="navy" />
      <div className="flex min-w-0 flex-col">
        <h2 tabIndex={-1} className={`${SHEET_TITLE} leading-[1.15]`}>{title}</h2>
        <span className={`text-[13.5px] ${TEXT_MUTED}`}>{subtitle}</span>
      </div>
    </div>
  )
}

/** Filas de 52px con emoji (beneficios) o número (pasos). */
export function InstallList({ rows }: { rows: { lead: React.ReactNode; text: React.ReactNode }[] }) {
  return (
    <ListCard>
      {rows.map((r, i) => (
        <div key={i} className={`flex min-h-[52px] items-center gap-3 py-2 ${ROW_DIVIDER}`}>
          <span aria-hidden className="flex w-6 flex-none justify-center text-[19px]">{r.lead}</span>
          <span className={`text-[14.5px] font-semibold leading-[1.35] ${TEXT_STRONG}`}>{r.text}</span>
        </div>
      ))}
    </ListCard>
  )
}

export const BENEFITS = [
  { lead: '⚡', text: 'Abre más rápido desde tu pantalla de inicio' },
  { lead: '🔔', text: 'Recibe avisos de tu plan' },
  { lead: '📴', text: 'Funciona aunque tengas mala señal' },
]

export function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric-ghost text-xs font-bold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft">
      {n}
    </span>
  )
}
