'use client'

import { NavCard, NavRow } from '@/components/layout/NavRow'
import type { CapsuleRecommendation } from '@/types'

interface CapsuleRecommendationsProps {
  recommendations: CapsuleRecommendation[]
}

/** Lecciones recomendadas como filas (el título lo pone la pantalla). */
export function CapsuleRecommendations({ recommendations }: CapsuleRecommendationsProps) {
  if (recommendations.length === 0) return null
  return (
    <NavCard>
      {recommendations.map((rec, i) => (
        <NavRow
          key={rec.capsule_id}
          href={`/aprende/${rec.module_slug}/${rec.slug}`}
          emoji="📖"
          name={rec.title}
          description={`${rec.module_title} · ${rec.read_time_minutes} min · ${rec.reason}`}
          last={i === recommendations.length - 1}
        />
      ))}
    </NavCard>
  )
}
