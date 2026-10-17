// Ayudas puras del bloque de salud financiera en Cómo te fue.

import type { ScoreComponent } from './score-calculator'

/** "Lo que más te ayudó": la parte más llena (sin las pendientes). */
export function mejorParte(components: ScoreComponent[]): ScoreComponent | null {
  return components.filter((c) => !c.pending).sort((a, b) => b.score / b.max - a.score / a.max)[0] ?? null
}
