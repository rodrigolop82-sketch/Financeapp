// Validación de las acciones de suscripciones (pura, para vitest). Las rutas
// de app/api/recurring la usan antes de escribir.

export type OverrideStatus = 'dismissed' | 'cancelled_by_user'

export type ActionResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string }

function validKey(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= 60
}

export function parseOverride(body: unknown): ActionResult<{ merchantKey: string; status: OverrideStatus | null }> {
  const b = (body ?? {}) as { merchantKey?: unknown; status?: unknown }
  if (!validKey(b.merchantKey)) return { ok: false, status: 400, error: 'Comercio no válido' }
  if (b.status !== null && b.status !== 'dismissed' && b.status !== 'cancelled_by_user') {
    return { ok: false, status: 400, error: 'Acción no válida' }
  }
  return { ok: true, value: { merchantKey: b.merchantKey, status: b.status as OverrideStatus | null } }
}

/**
 * Recordatorio antes del cobro: Premium (`recurring.reminders`). Quitar el
 * recordatorio (null) siempre se permite, por si el hogar bajó de plan.
 */
export function parseReminder(
  body: unknown,
  hasReminders: boolean,
): ActionResult<{ merchantKey: string; daysBefore: 1 | 2 | 3 | null }> {
  const b = (body ?? {}) as { merchantKey?: unknown; daysBefore?: unknown }
  if (!validKey(b.merchantKey)) return { ok: false, status: 400, error: 'Comercio no válido' }
  if (b.daysBefore !== null && b.daysBefore !== 1 && b.daysBefore !== 2 && b.daysBefore !== 3) {
    return { ok: false, status: 400, error: 'Elige 1, 2 o 3 días' }
  }
  if (b.daysBefore !== null && !hasReminders) {
    return { ok: false, status: 403, error: 'Los recordatorios de cobro son parte de Premium' }
  }
  return { ok: true, value: { merchantKey: b.merchantKey, daysBefore: b.daysBefore as 1 | 2 | 3 | null } }
}
