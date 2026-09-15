import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// Constants
// ============================================================

export const MAX_CUSTOM_CATEGORIES = 15
export const MIN_VISIBLE_DEFAULTS = 3
export const COUNTER_VISIBLE_FROM = 12

export const CATEGORY_EMOJIS = [
  '🛒','🏠','🚗','💊','💡','📚','🍽️','👕','🎬','📱','💰','🎯',
  '✈️','🐾','👶','💇','🏋️','🎁','☕','🔧','📦','🧹','🎵','💻',
] as const

export const CATEGORY_COLORS = [
  '#2563EB','#7C3AED','#059669','#D97706','#DC2626','#DB2777','#0891B2','#4B5563',
] as const

// ============================================================
// Zod schemas
// ============================================================

export const createCategorySchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(30, 'El nombre no puede superar 30 caracteres'),
  icon: z.string().min(1, 'Selecciona un emoji'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  parent_category_id: z.string().uuid('Selecciona un grupo'),
  pace_mode: z.enum(['linear', 'fixed']),
  expected_day: z.number().int().min(1).max(31).nullable(),
  budgeted_amount: z.number().min(0).default(0),
})

export const updateCategorySchema = createCategorySchema.partial()

export const archiveCategorySchema = z.object({
  id: z.string().uuid(),
  reassign_to_category_id: z.string().uuid().nullable(),
})

// ============================================================
// Types
// ============================================================

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

interface ActionResult<T = unknown> {
  data: T | null
  error: string | null
}

// ============================================================
// Helper: get household ID for current user
// ============================================================

async function getHouseholdId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()
  return data?.household_id ?? null
}

// ============================================================
// createCustomCategory
// ============================================================

export async function createCustomCategory(
  supabase: SupabaseClient,
  input: CreateCategoryInput,
): Promise<ActionResult> {
  const parsed = createCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  const householdId = await getHouseholdId(supabase)
  if (!householdId) return { data: null, error: 'No se encontró tu hogar' }

  // Check active count
  const { count } = await supabase
    .from('budget_categories')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .eq('is_default', false)
    .is('archived_at', null)

  if ((count ?? 0) >= MAX_CUSTOM_CATEGORIES) {
    return { data: null, error: `Máximo ${MAX_CUSTOM_CATEGORIES} categorías personalizadas activas` }
  }

  // Check name uniqueness (case-insensitive) against active customs AND visible defaults
  const { data: existing } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('household_id', householdId)
    .is('archived_at', null)

  const nameLower = parsed.data.name.toLowerCase()
  const duplicate = existing?.find(c => c.name.toLowerCase() === nameLower)
  if (duplicate) {
    return { data: null, error: 'Ya existe una categoría con ese nombre' }
  }

  // Validate parent is a default category
  const { data: parent } = await supabase
    .from('budget_categories')
    .select('id, is_default, bucket')
    .eq('id', parsed.data.parent_category_id)
    .single()

  if (!parent || !parent.is_default) {
    return { data: null, error: 'El grupo padre debe ser una categoría predeterminada' }
  }

  // Insert
  const { data: created, error } = await supabase
    .from('budget_categories')
    .insert({
      household_id: householdId,
      name: parsed.data.name.trim(),
      bucket: parent.bucket,
      icon: parsed.data.icon,
      color: parsed.data.color,
      parent_category_id: parsed.data.parent_category_id,
      is_default: false,
      is_custom: true,
      pace_mode: parsed.data.pace_mode,
      expected_day: parsed.data.pace_mode === 'fixed' ? parsed.data.expected_day : null,
      budgeted_amount: parsed.data.budgeted_amount,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: created, error: null }
}

// ============================================================
// updateCustomCategory
// ============================================================

export async function updateCustomCategory(
  supabase: SupabaseClient,
  id: string,
  input: UpdateCategoryInput,
): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  const householdId = await getHouseholdId(supabase)
  if (!householdId) return { data: null, error: 'No se encontró tu hogar' }

  // Verify ownership and that it's custom
  const { data: cat } = await supabase
    .from('budget_categories')
    .select('id, is_default, household_id')
    .eq('id', id)
    .eq('household_id', householdId)
    .single()

  if (!cat) return { data: null, error: 'Categoría no encontrada' }
  if (cat.is_default) return { data: null, error: 'No se pueden editar categorías predeterminadas' }

  // Name uniqueness check if name is changing
  if (parsed.data.name) {
    const { data: existing } = await supabase
      .from('budget_categories')
      .select('id, name')
      .eq('household_id', householdId)
      .is('archived_at', null)

    const nameLower = parsed.data.name.toLowerCase()
    const duplicate = existing?.find(c => c.name.toLowerCase() === nameLower && c.id !== id)
    if (duplicate) {
      return { data: null, error: 'Ya existe una categoría con ese nombre' }
    }
  }

  // Build update payload
  const update: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) update.name = parsed.data.name.trim()
  if (parsed.data.icon !== undefined) update.icon = parsed.data.icon
  if (parsed.data.color !== undefined) update.color = parsed.data.color
  if (parsed.data.pace_mode !== undefined) {
    update.pace_mode = parsed.data.pace_mode
    update.expected_day = parsed.data.pace_mode === 'fixed' ? (parsed.data.expected_day ?? null) : null
  }
  if (parsed.data.expected_day !== undefined && parsed.data.pace_mode === undefined) {
    update.expected_day = parsed.data.expected_day
  }
  if (parsed.data.budgeted_amount !== undefined) update.budgeted_amount = parsed.data.budgeted_amount

  // If parent is changing, validate and update bucket
  if (parsed.data.parent_category_id !== undefined) {
    const { data: parent } = await supabase
      .from('budget_categories')
      .select('id, is_default, bucket')
      .eq('id', parsed.data.parent_category_id)
      .single()

    if (!parent || !parent.is_default) {
      return { data: null, error: 'El grupo padre debe ser una categoría predeterminada' }
    }
    update.parent_category_id = parsed.data.parent_category_id
    update.bucket = parent.bucket
  }

  const { data: updated, error } = await supabase
    .from('budget_categories')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: updated, error: null }
}

// ============================================================
// archiveCustomCategory
// ============================================================

export async function archiveCustomCategory(
  supabase: SupabaseClient,
  id: string,
  reassignToCategoryId: string | null,
): Promise<ActionResult> {
  const householdId = await getHouseholdId(supabase)
  if (!householdId) return { data: null, error: 'No se encontró tu hogar' }

  const { data: cat } = await supabase
    .from('budget_categories')
    .select('id, is_default, household_id, archived_at')
    .eq('id', id)
    .eq('household_id', householdId)
    .single()

  if (!cat) return { data: null, error: 'Categoría no encontrada' }
  if (cat.is_default) return { data: null, error: 'Las categorías predeterminadas no se archivan' }
  if (cat.archived_at) return { data: null, error: 'La categoría ya está archivada' }

  // Check if category has transactions
  const { count: txCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if ((txCount ?? 0) > 0 && !reassignToCategoryId) {
    return { data: null, error: 'Esta categoría tiene gastos registrados. Elige a dónde moverlos.' }
  }

  if (reassignToCategoryId) {
    // Validate target category is active and belongs to household
    const { data: target } = await supabase
      .from('budget_categories')
      .select('id, household_id, archived_at')
      .eq('id', reassignToCategoryId)
      .single()

    if (!target) return { data: null, error: 'Categoría destino no encontrada' }
    if (target.household_id !== householdId) return { data: null, error: 'Categoría destino no pertenece a tu hogar' }
    if (target.archived_at) return { data: null, error: 'La categoría destino está archivada' }

    // Reassign transactions
    const { error: reassignError } = await supabase
      .from('transactions')
      .update({ category_id: reassignToCategoryId })
      .eq('category_id', id)

    if (reassignError) return { data: null, error: reassignError.message }
  }

  // Archive
  const { data: archived, error } = await supabase
    .from('budget_categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: archived, error: null }
}

// ============================================================
// restoreCustomCategory
// ============================================================

export async function restoreCustomCategory(
  supabase: SupabaseClient,
  id: string,
): Promise<ActionResult> {
  const householdId = await getHouseholdId(supabase)
  if (!householdId) return { data: null, error: 'No se encontró tu hogar' }

  const { data: cat } = await supabase
    .from('budget_categories')
    .select('id, name, is_default, household_id, archived_at')
    .eq('id', id)
    .eq('household_id', householdId)
    .single()

  if (!cat) return { data: null, error: 'Categoría no encontrada' }
  if (!cat.archived_at) return { data: null, error: 'La categoría no está archivada' }

  // Check active count
  const { count } = await supabase
    .from('budget_categories')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .eq('is_default', false)
    .is('archived_at', null)

  if ((count ?? 0) >= MAX_CUSTOM_CATEGORIES) {
    return { data: null, error: `Máximo ${MAX_CUSTOM_CATEGORIES} categorías activas. Archiva alguna primero.` }
  }

  // Check name uniqueness
  const { data: existing } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('household_id', householdId)
    .is('archived_at', null)

  const nameLower = cat.name.toLowerCase()
  const duplicate = existing?.find(c => c.name.toLowerCase() === nameLower && c.id !== id)
  if (duplicate) {
    return { data: null, error: 'Ya existe una categoría activa con ese nombre' }
  }

  const { data: restored, error } = await supabase
    .from('budget_categories')
    .update({ archived_at: null })
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: restored, error: null }
}

// ============================================================
// setDefaultCategoryVisibility
// ============================================================

export async function setDefaultCategoryVisibility(
  supabase: SupabaseClient,
  categoryId: string,
  visible: boolean,
): Promise<ActionResult> {
  const householdId = await getHouseholdId(supabase)
  if (!householdId) return { data: null, error: 'No se encontró tu hogar' }

  // Verify category is a default
  const { data: cat } = await supabase
    .from('budget_categories')
    .select('id, is_default, household_id')
    .eq('id', categoryId)
    .single()

  if (!cat) return { data: null, error: 'Categoría no encontrada' }
  if (!cat.is_default) return { data: null, error: 'Solo se pueden ocultar categorías predeterminadas' }
  if (cat.household_id !== householdId) return { data: null, error: 'Categoría no pertenece a tu hogar' }

  if (!visible) {
    // Count currently visible defaults
    const { data: allDefaults } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('household_id', householdId)
      .eq('is_default', true)

    const { data: hiddenRows } = await supabase
      .from('household_hidden_categories')
      .select('category_id')
      .eq('household_id', householdId)

    const hiddenIds = new Set((hiddenRows ?? []).map(h => h.category_id))
    const visibleCount = (allDefaults ?? []).filter(d => !hiddenIds.has(d.id)).length

    if (visibleCount <= MIN_VISIBLE_DEFAULTS) {
      return { data: null, error: `Deja al menos ${MIN_VISIBLE_DEFAULTS} categorías visibles` }
    }

    const { error } = await supabase
      .from('household_hidden_categories')
      .upsert({ household_id: householdId, category_id: categoryId })

    if (error) return { data: null, error: error.message }
  } else {
    const { error } = await supabase
      .from('household_hidden_categories')
      .delete()
      .eq('household_id', householdId)
      .eq('category_id', categoryId)

    if (error) return { data: null, error: error.message }
  }

  return { data: { visible }, error: null }
}

// ============================================================
// listCategoriesForHousehold
// ============================================================

export interface CategoriesListing {
  custom: Array<Record<string, unknown>>
  defaults: Array<Record<string, unknown> & { hidden: boolean }>
  archived: Array<Record<string, unknown>>
}

export async function listCategoriesForHousehold(
  supabase: SupabaseClient,
): Promise<ActionResult<CategoriesListing>> {
  const householdId = await getHouseholdId(supabase)
  if (!householdId) return { data: null, error: 'No se encontró tu hogar' }

  const [catResult, hiddenResult] = await Promise.all([
    supabase
      .from('budget_categories')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true }),
    supabase
      .from('household_hidden_categories')
      .select('category_id')
      .eq('household_id', householdId),
  ])

  if (catResult.error) return { data: null, error: catResult.error.message }

  const hiddenIds = new Set((hiddenResult.data ?? []).map(h => h.category_id))
  const all = catResult.data ?? []

  const custom = all.filter(c => !c.is_default && !c.archived_at)
  const defaults = all
    .filter(c => c.is_default)
    .map(c => ({ ...c, hidden: hiddenIds.has(c.id) }))
  const archived = all.filter(c => !c.is_default && c.archived_at)

  return { data: { custom, defaults, archived }, error: null }
}
