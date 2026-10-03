'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { useHealthScore } from '@/hooks/useHealthScore'
import { getRecommendedCapsules } from '@/lib/capsule-recommendations'
import { CapsuleRecommendations } from '@/components/education/CapsuleRecommendations'
import type { CapsuleRecommendation } from '@/types'

/** Cápsulas recomendadas según el puntaje (antes estaban en Inicio). */
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

  if (recommendations.length === 0) return null
  return (
    <div style={{ marginBottom: 24 }}>
      <CapsuleRecommendations recommendations={recommendations} title="Para ti" showSeeAll={false} />
    </div>
  )
}
