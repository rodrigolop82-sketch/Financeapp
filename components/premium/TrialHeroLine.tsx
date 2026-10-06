'use client'

// Línea dentro del hero de Inicio (como Salud financiera) desde el día 11 de
// la prueba: "Tu prueba termina en 3 días ›".

import Link from 'next/link'
import { useEffectivePlan } from '@/lib/hooks/useEffectivePlan'
import { daysText, shouldWarnTrial, trialProgress } from '@/lib/trial'

export function TrialHeroLine() {
  const plan = useEffectivePlan()
  if (!plan || !plan.trialEndsAt || !shouldWarnTrial(plan)) return null
  const { daysLeft } = trialProgress(plan.trialEndsAt)
  return (
    <Link
      href="/planes/fin-prueba"
      className="mt-2 flex w-full items-center justify-between border-t border-white/[0.08] pt-2.5 text-[13.5px] text-[#9FB3CB]"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-warning" />
        Tu prueba termina en <b className="font-outfit text-[15px] font-bold text-white">{daysText(daysLeft)}</b>
      </span>
      <span aria-hidden className="font-semibold text-white">›</span>
    </Link>
  )
}
