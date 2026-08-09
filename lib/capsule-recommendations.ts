import { createClient } from '@/lib/supabase'
import type { ScoreComponent } from '@/lib/score-calculator'
import type { CapsuleRecommendation } from '@/types'

const KEY_TO_DB: Record<string, string> = {
  savings:   'savingsRate',
  debt:      'debtBurden',
  emergency: 'emergencyFund',
  spending:  'expenseRatio',
  stability: 'incomeStability',
}

const REASON_MAP: Record<string, string> = {
  savings:   'Tu tasa de ahorro tiene espacio para mejorar',
  debt:      'Tus deudas están impactando tu puntaje',
  emergency: 'Todavía no tenés fondo de emergencia completo',
  spending:  'Tus gastos son altos en relación al ingreso',
  stability: 'Tu ingreso variable requiere planificación especial',
}

export async function getRecommendedCapsules(
  userId: string,
  components: ScoreComponent[],
  limit = 3
): Promise<CapsuleRecommendation[]> {
  if (components.length === 0) return []

  const weakComponents = [...components]
    .sort((a, b) => (a.score / a.max) - (b.score / b.max))
    .slice(0, 3)
    .map(c => c.key)

  const dbComponents = weakComponents
    .map(k => KEY_TO_DB[k])
    .filter(Boolean)

  if (dbComponents.length === 0) return []

  const supabase = createClient()

  const { data: readCapsules } = await supabase
    .from('user_capsule_progress')
    .select('capsule_id')
    .eq('user_id', userId)

  const readIds = readCapsules?.map(r => r.capsule_id) ?? []

  let query = supabase
    .from('capsules')
    .select(`
      id, slug, title, subtitle, read_time_minutes, related_score_component,
      capsule_modules!inner(title, slug)
    `)
    .in('related_score_component', dbComponents)
    .eq('is_premium', false)
    .order('order_index')
    .limit(limit)

  if (readIds.length > 0) {
    query = query.not('id', 'in', `(${readIds.join(',')})`)
  }

  const { data: capsules } = await query

  if (!capsules) return []

  const dbToKey: Record<string, string> = {}
  for (const [k, v] of Object.entries(KEY_TO_DB)) dbToKey[v] = k

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return capsules.map((c: any) => ({
    capsule_id: c.id,
    title: c.title,
    subtitle: c.subtitle ?? '',
    module_title: c.capsule_modules.title,
    module_slug: c.capsule_modules.slug,
    slug: c.slug,
    read_time_minutes: c.read_time_minutes,
    reason: REASON_MAP[dbToKey[c.related_score_component] ?? ''] ?? 'Relevante para tu situación',
  }))
}
