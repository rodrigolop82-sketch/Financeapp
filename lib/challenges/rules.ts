// Reglas para iniciar un reto (puras; las rutas las usan antes de escribir).
// Gratis: 1 reto activo a la vez y la meta de la plantilla. Premium:
// varios a la vez (challenges.multiple) y meta personalizada
// (challenges.customize). La categoría se elige gratis cuando la plantilla
// la requiere.

export interface TemplateRow {
  id: string
  slug: string
  type: string
  title: string
  duration_days: number
  default_config: { requires_category?: boolean; suggested_category?: string } | null
  active: boolean
}

export interface StartRequest {
  templateId: string
  categoryId?: string | null
  targetAmount?: number | null
}

export type StartCheck =
  | { ok: true; categoryId: string | null; targetAmount: number | null }
  | { ok: false; status: number; error: string; premium?: boolean }

export function parseStartRequest(body: unknown): StartRequest | null {
  const b = (body ?? {}) as Record<string, unknown>
  if (typeof b.templateId !== 'string' || !b.templateId) return null
  const categoryId = typeof b.categoryId === 'string' && b.categoryId ? b.categoryId : null
  const raw = b.targetAmount
  const targetAmount = raw === undefined || raw === null || raw === '' ? null : Number(raw)
  if (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount <= 0)) return null
  return { templateId: b.templateId, categoryId, targetAmount }
}

export function checkStart(input: {
  template: TemplateRow | null
  request: StartRequest
  active: { templateId: string; categoryId: string | null }[]
  /** Categorías de gasto válidas del hogar. */
  validCategoryIds: Set<string>
  features: { multiple: boolean; customize: boolean }
}): StartCheck {
  const { template: t, request: r } = input
  if (!t || !t.active) return { ok: false, status: 404, error: 'Ese reto no está disponible' }

  if (input.active.length > 0 && !input.features.multiple) {
    return { ok: false, status: 403, error: 'Con el plan Gratis tienes 1 reto activo a la vez', premium: true }
  }
  if (r.targetAmount !== null && r.targetAmount !== undefined && !input.features.customize) {
    return { ok: false, status: 403, error: 'Personalizar la meta de un reto es parte de Premium', premium: true }
  }

  const requiresCategory = !!t.default_config?.requires_category
  const categoryId = r.categoryId ?? null
  if (requiresCategory && !categoryId) return { ok: false, status: 400, error: 'Elige una categoría' }
  if (!requiresCategory && categoryId) return { ok: false, status: 400, error: 'Este reto no usa categoría' }
  if (categoryId && !input.validCategoryIds.has(categoryId)) return { ok: false, status: 400, error: 'Categoría no válida' }

  if (input.active.some((a) => a.templateId === t.id && a.categoryId === categoryId)) {
    return { ok: false, status: 409, error: 'Ya tienes este reto activo' }
  }
  return { ok: true, categoryId, targetAmount: r.targetAmount ?? null }
}

/** Título con la categoría: "14 días sin {categoria}" → "14 días sin Restaurantes". */
export function challengeTitle(title: string, categoryName: string | null): string {
  return title.replace('{categoria}', categoryName ?? 'una categoría')
}
