'use client'

import { BADGE_WARN } from '@/components/layout/Pantalla'
import type { RecurringChargeView } from '@/lib/recurring/data'

/** Avatar con la inicial del comercio. */
export function MerchantAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-xl bg-electric-ghost font-outfit font-extrabold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

/** Pill "Subió Q x" cuando el último cobro subió. */
export function PriceUpBadge({ charge, fmt }: { charge: RecurringChargeView; fmt: (n: number) => string }) {
  const pc = charge.priceChange
  if (!pc || pc.to <= pc.from) return null
  return <span className={BADGE_WARN}>Subió {fmt(pc.to - pc.from)}</span>
}
