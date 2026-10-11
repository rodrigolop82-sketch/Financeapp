// Datos de la tarjeta destacada de Inicio (solo servidor, service role).

import type { SupabaseClient } from '@supabase/supabase-js'
import { localToday } from '../dates'
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
  return pickFeaturedCard(inputs)
}
