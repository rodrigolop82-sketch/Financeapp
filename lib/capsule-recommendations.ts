import { createClient } from '@/lib/supabase'
import type { ScoreBreakdown } from '@/lib/scoring'
import type { CapsuleRecommendation } from '@/types'

/**
 * Devuelve hasta 3 cápsulas recomendadas según los componentes débiles del puntaje.
 * El usuario no las busca — Zafi las sugiere proactivamente en el dashboard.
 */
export async function getRecommendedCapsules(
  userId: string,
  score: ScoreBreakdown,
  limit = 3
): Promise<CapsuleRecommendation[]> {
  const supabase = createClient()

  // Determinar qué componentes están más débiles
  const componentRatios = {
    savingsRate:     score.components.savingsRate / 30,
    debtBurden:      score.components.debtBurden / 25,
    emergencyFund:   score.components.emergencyFund / 20,
    expenseRatio:    score.components.expenseRatio / 15,
    incomeStability: score.components.incomeStability / 10,
  }

  // Ordenar por debilidad (menor ratio = más débil = más prioritario)
  const weakComponents = Object.entries(componentRatios)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([component]) => component)

  if (weakComponents.length === 0) return []

  // Obtener cápsulas ya leídas para no recomendar las mismas
  const { data: readCapsules } = await supabase
    .from('user_capsule_progress')
    .select('capsule_id')
    .eq('user_id', userId)

  const readIds = readCapsules?.map(r => r.capsule_id) ?? []

  // Buscar cápsulas relacionadas a los componentes débiles
  let query = supabase
    .from('capsules')
    .select(`
      id, slug, title, subtitle, read_time_minutes, related_score_component,
      capsule_modules!inner(title, slug)
    `)
    .in('related_score_component', weakComponents)
    .eq('is_premium', false)
    .order('order_index')
    .limit(limit)

  if (readIds.length > 0) {
    query = query.not('id', 'in', `(${readIds.join(',')})`)
  }

  const { data: capsules } = await query

  if (!capsules) return []

  const reasonMap: Record<string, string> = {
    savingsRate:     'Tu tasa de ahorro tiene espacio para mejorar',
    debtBurden:      'Tus deudas están impactando tu puntaje',
    emergencyFund:   'Todavía no tenés fondo de emergencia completo',
    expenseRatio:    'Tus gastos fijos son altos en relación al ingreso',
    incomeStability: 'Tu ingreso variable requiere planificación especial',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return capsules.map((c: any) => ({
    capsule_id: c.id,
    title: c.title,
    subtitle: c.subtitle ?? '',
    module_title: c.capsule_modules.title,
    module_slug: c.capsule_modules.slug,
    slug: c.slug,
    read_time_minutes: c.read_time_minutes,
    reason: reasonMap[c.related_score_component ?? ''] ?? 'Relevante para tu situación',
  }))
}
