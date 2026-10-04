'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { useHealthScore } from '@/hooks/useHealthScore'
import { getRecommendedCapsules } from '@/lib/capsule-recommendations'
import Link from 'next/link'
import { CARD } from '@/components/resumen/ctf-ui'
import { Chevron, Tile } from '@/components/layout/Pantalla'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import type { CapsuleRecommendation } from '@/types'

/** La lección recomendada según tus números (una sola tarjeta). */
export function ParaTi() {
  const [ids, setIds] = useState<{ userId: string; householdId: string } | null>(null)
  const [recommendations, setRecommendations] = useState<CapsuleRecommendation[]>([])
  const { score } = useHealthScore(ids?.householdId ?? null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const household = await getUserHousehold(supabase, user.id)
      if (household) setIds({ userId: user.id, householdId: household.id })
    })
  }, [])

  useEffect(() => {
    if (!ids || !score || score.components.length === 0) return
    getRecommendedCapsules(ids.userId, score.components).then(setRecommendations).catch(() => {})
  }, [ids, score])

  const rec = recommendations[0]
  if (!rec) return null
  return (
    <Link
      href={`/aprende/${rec.module_slug}/${rec.slug}`}
      className={`mt-3 flex items-center gap-3 px-4 py-3.5 transition-transform duration-150 active:scale-[0.98] ${CARD}`}
    >
      <Tile className="bg-warning-light dark:bg-warning/15">💡</Tile>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-xs font-bold uppercase tracking-[0.04em] text-warning-text dark:text-warning">Para ti · por tus números</span>
        <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{rec.title}</span>
        <span className={`text-[13px] leading-[1.35] ${TEXT_MUTED}`}>{rec.reason || rec.subtitle}</span>
      </span>
      <Chevron />
    </Link>
  )
}
