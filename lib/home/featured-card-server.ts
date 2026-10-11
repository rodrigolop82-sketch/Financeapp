// Datos de la tarjeta destacada de Inicio (solo servidor, service role).

import type { SupabaseClient } from '@supabase/supabase-js'
import { localToday } from '../dates'
import { getChallenges } from '../challenges/data'
import { getNetWorth } from '../networth/data'
import { loadWeeklySnapshot, weekBounds } from '../snapshot/data'
import { pickFeaturedCard, weekdayOf, type FeaturedCard, type FeaturedInputs } from './featured-card'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

async function snapshotInput(admin: Admin, hid: string, today: string): Promise<FeaturedInputs['snapshot']> {
  const bounds = await weekBounds(admin, hid, today)
  if (!bounds) return null
  const { data: row } = await admin
    .from('weekly_snapshots')
    .select('viewed_at')
    .eq('household_id', hid)
    .eq('week_start', bounds.latest)
    .maybeSingle()
  if (row?.viewed_at) return { weekStart: bounds.latest, total: 0, viewed: true, sparse: false }
  const { snapshot } = await loadWeeklySnapshot(admin, hid, bounds.latest)
  return { weekStart: bounds.latest, total: snapshot.totalVariable, viewed: false, sparse: snapshot.isSparse }
}

export async function resolveFeaturedCard(admin: Admin, householdId: string): Promise<FeaturedCard | null> {
  const today = localToday()
  const weekday = weekdayOf(today)
  const inputs: FeaturedInputs = { weekday }
  // El resumen solo compite lunes y martes: los demás días ni se calcula.
  if (weekday === 1 || weekday === 2) inputs.snapshot = await snapshotInput(admin, householdId, today).catch(() => null)
  const card = pickFeaturedCard(inputs)
  if (card) return card

  // (2) Reto activo: el más reciente.
  const { data: anyActive } = await admin.from('user_challenges').select('id').eq('household_id', householdId).eq('status', 'active').limit(1)
  if (anyActive && anyActive.length > 0) {
    const c = (await getChallenges(admin, householdId, today).catch(() => null))?.active[0]
    if (c) {
      inputs.challenge = { id: c.id, title: c.title, dayIndex: c.progress.dayIndex, durationDays: c.progress.durationDays, streak: c.progress.streak }
      return pickFeaturedCard(inputs)
    }
  }

  // (3) Patrimonio neto, o la invitación a agregar cuentas.
  const nw = await getNetWorth(admin, householdId, new Date().toISOString()).catch(() => null)
  if (!nw) return null
  inputs.networth = { hasSources: nw.hasSources, netWorth: nw.summary.netWorth, delta: nw.summary.deltaVsPrevMonthEnd }
  return pickFeaturedCard(inputs)
}
