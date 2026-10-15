// Tarjeta destacada de Inicio: UNA sola, por prioridad
//   (1) resumen semanal — lunes y martes, si no se ha visto y no es dispersa
//   (2) reto activo
//   (3) patrimonio neto (o la invitación a agregar cuentas)
// Puro, para vitest. resolveFeaturedCard (featured-card-server.ts) junta los datos.

export type FeaturedCard =
  | { kind: 'snapshot'; weekStart: string; total: number }
  | { kind: 'challenge'; id: string; title: string; dayIndex: number; durationDays: number; streak: number }
  | { kind: 'networth'; netWorth: number; delta: number | null; assets?: number; liabilities?: number }
  | { kind: 'networth_invite' }

export interface FeaturedInputs {
  /** Día de la semana en la zona del hogar (0 = domingo, 1 = lunes…). */
  weekday: number
  snapshot?: { weekStart: string; total: number; viewed: boolean; sparse: boolean } | null
  challenge?: { id: string; title: string; dayIndex: number; durationDays: number; streak: number } | null
  networth?: { hasSources: boolean; netWorth: number; delta: number | null; assets?: number; liabilities?: number } | null
}

export function pickFeaturedCard(i: FeaturedInputs): FeaturedCard | null {
  const s = i.snapshot
  if (s && (i.weekday === 1 || i.weekday === 2) && !s.viewed && !s.sparse) {
    return { kind: 'snapshot', weekStart: s.weekStart, total: s.total }
  }
  if (i.challenge) return { kind: 'challenge', ...i.challenge }
  if (i.networth) {
    const { hasSources, netWorth, delta, assets, liabilities } = i.networth
    if (!hasSources) return { kind: 'networth_invite' }
    // F3: con datos, también el desglose de activos y deudas.
    return assets === undefined || liabilities === undefined
      ? { kind: 'networth', netWorth, delta }
      : { kind: 'networth', netWorth, delta, assets, liabilities }
  }
  return null
}

/** Día de la semana de una fecha YYYY-MM-DD. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}
