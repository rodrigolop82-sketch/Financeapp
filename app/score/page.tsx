'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { localMonth } from '@/lib/dates'
import { monthName } from '@/lib/plan-del-mes'
import { useHealthScore } from '@/hooks/useHealthScore'
import { getRecommendedCapsules } from '@/lib/capsule-recommendations'
import { AppShell } from '@/components/layout/AppShell'
import { GroupTitle, PageHeader } from '@/components/layout/Pantalla'
import { Note } from '@/components/plan/ui'
import { ScoreHero, ScoreHistoryChart, ScoreParts, changeText } from '@/components/score/ScoreUI'
import { CapsuleRecommendations } from '@/components/education/CapsuleRecommendations'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import type { CapsuleRecommendation } from '@/types'

/** A dónde vuelve "‹" según desde dónde se abrió (?from=). */
const ORIGINS: Record<string, { label: string; href: string }> = {
  inicio: { label: 'Inicio', href: '/dashboard' },
  plan: { label: 'Plan', href: '/plan' },
  mas: { label: 'Más', href: '/mas' },
  resumen: { label: 'Cómo te fue', href: '/resumen' },
}

export default function ScorePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <ScoreScreen />
    </Suspense>
  )
}

function ScoreScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const back = ORIGINS[params.get('from') ?? ''] ?? ORIGINS.inicio
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<CapsuleRecommendation[]>([])
  const { score, history, loading } = useHealthScore(householdId, { history: true })

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { router.push('/onboarding'); return }
      setHouseholdId(hh.id)
      setUserId(user.id)
    })()
  }, [router])

  useEffect(() => {
    if (!userId || !score || score.components.length === 0) return
    getRecommendedCapsules(userId, score.components).then(setRecommendations).catch(() => {})
  }, [userId, score])

  if (!householdId || loading || !score) return <PageSkeleton variant="detail" />

  const month = localMonth()
  const past = history.filter((h) => h.month < month)
  const prev = past.length > 0 ? past[past.length - 1] : null
  const points = [...past.slice(-5), { month, score: score.total }]

  return (
    <AppShell title="Salud financiera" currentPath="/score" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={back} title="Salud financiera" />

        {score.components.length === 0 ? (
          <Note tone="info" className="mt-3.5">
            <b>Todavía no podemos calcularla.</b> Agrega tus ingresos en el Plan del mes y aquí verás tu puntaje.
          </Note>
        ) : (
          <div className="flex flex-col zafi-stagger">
            <ScoreHero score={score} sub={changeText(score.total, prev && { score: prev.score, name: monthName(prev.month) })} />

            <section>
              <GroupTitle>Qué lo compone</GroupTitle>
              <ScoreParts score={score} />
            </section>

            {points.length > 1 && (
              <section>
                <GroupTitle>Cómo ha cambiado</GroupTitle>
                <ScoreHistoryChart points={points} color={score.color} />
              </section>
            )}

            <Note tone="info">
              <b>Se actualiza solo.</b> Sale de lo que ya registras: tus metas, deudas, plan del mes y movimientos. Al cerrar el mes queda guardado.
            </Note>

            {recommendations.length > 0 && (
              <section>
                <GroupTitle>Para mejorar tu puntaje</GroupTitle>
                <CapsuleRecommendations recommendations={recommendations} />
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
