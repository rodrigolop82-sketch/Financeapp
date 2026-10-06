'use client'

// Aviso único de Premium: hoja con lo que pasó, medidor si aplica, 2–3
// beneficios del momento y "Ver Premium" → /planes?from=<razón>.

import Link from 'next/link'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { SheetHeader } from '@/components/layout/Pantalla'
import { ProgressBar } from '@/components/plan/ui'
import { CARD } from '@/components/resumen/ctf-ui'
import { DIVIDER, PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { localToday } from '@/lib/dates'
import { premiumGate, type PremiumReason } from '@/lib/premium'

export function PremiumCheck({ on = true }: { on?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-xs font-extrabold ${
        on
          ? 'bg-success-light text-success-dark dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]'
          : 'bg-[var(--zafi-tab-bg)] text-[var(--zafi-text-muted)]'
      }`}
    >
      {on ? '✓' : '–'}
    </span>
  )
}

export function PremiumSheet({ reason, open, onClose, used, limit, memberName, family }: {
  reason: PremiumReason
  open: boolean
  onClose: () => void
  used?: number
  limit?: number
  memberName?: string | null
  family?: boolean
}) {
  const g = premiumGate(reason, { today: localToday(), used, limit, memberName, family })
  return (
    <BottomSheet open={open} onClose={onClose} label="Premium" themed>
      <div className="flex flex-col gap-4 px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-2">
        <SheetHeader emoji={g.emoji} title={g.title} subtitle={g.subtitle} />
        {g.meter && (
          <div className="flex flex-col gap-1.5">
            <ProgressBar ratio={g.meter.limit > 0 ? g.meter.used / g.meter.limit : 1} color="#F59E0B" />
            <span className={`text-[13px] ${TEXT_MUTED}`}>{g.meter.used} de {g.meter.limit} {g.meter.noun} gratis este mes</span>
          </div>
        )}
        <div className={`px-3.5 py-1 ${CARD}`}>
          <span className="block pb-0.5 pt-2.5 text-xs font-bold uppercase tracking-[0.12em] text-electric-dark dark:text-electric-soft">👑 {g.plan}</span>
          {g.perks.map((p) => (
            <div key={p} className={`flex items-center gap-3 border-b py-[11px] last:border-b-0 ${DIVIDER}`}>
              <span className={`flex-1 text-[15px] font-semibold ${TEXT_STRONG}`}>{p}</span>
              <PremiumCheck />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Link href={g.href} onClick={onClose} className={`flex items-center justify-center ${PRIMARY_BUTTON}`}>{g.cta}</Link>
          <button type="button" onClick={onClose} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>Ahora no</button>
        </div>
      </div>
    </BottomSheet>
  )
}
