// Lectura y guardado de una importación de estado de cuenta (Fase 7):
// clasificación contra lo registrado, confirmación y "Deshacer".
import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyCharges, cleanBankName, type BankCharge, type ClassifiedCharge, type ExistingTx } from './classify'
import { shiftDate } from './db-duplicates'
import { fixedLeaves, leafPending } from '../inicio-de-mes'
import { getMerchantKey } from '../transactions/merchant-key'
import { deriveTransactionType } from '../transactions/transaction-type'
import type { BudgetCategory, BudgetSubItem } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface MatchedTx extends ExistingTx {
  payment_method?: string | null
}

export interface ClassifyResult {
  classified: ClassifiedCharge[]
  /** Transacciones registradas con las que se emparejó algún cargo. */
  matches: Record<string, MatchedTx>
  categories: BudgetCategory[]
  subItems: BudgetSubItem[]
  /** Claves de comercio que ya tienen regla. */
  overrideKeys: string[]
}

const EXISTING_COLS = 'id, date, amount, description, category_id, type, payment_method, budget_sub_item_id, statement_import_id, bank_description'
const PAGE = 1000

function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** Clasifica los cargos extraídos contra lo que el hogar ya tiene registrado. */
export async function classifyStatement(
  supabase: Client,
  householdId: string,
  charges: BankCharge[],
  today: string,
): Promise<ClassifyResult> {
  const currentMonth = monthOf(today)
  const dates = charges.map((c) => c.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  const from = shiftDate(dates[0] ?? today, -5)!
  const to = shiftDate(dates[dates.length - 1] ?? today, 5)!
  const monthFrom = `${currentMonth}-01`
  const lo = from < monthFrom ? from : monthFrom
  const hi = to > today ? to : today

  const existing: MatchedTx[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('transactions')
      .select(EXISTING_COLS)
      .eq('household_id', householdId)
      .gte('date', lo)
      .lte('date', hi)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (error) throw new Error(error.message)
    existing.push(...((data ?? []) as MatchedTx[]))
    if (!data || data.length < PAGE) break
  }

  const [{ data: cats }, { data: subs }, { data: overrides }] = await Promise.all([
    supabase.from('budget_categories').select('*').eq('household_id', householdId),
    supabase.from('budget_sub_items').select('*').eq('household_id', householdId),
    supabase.from('merchant_category_overrides').select('merchant_key, category_id').eq('household_id', householdId),
  ])
  const categories = ((cats ?? []) as BudgetCategory[]).filter((c) => !c.archived_at)
  const subItems = (subs ?? []) as BudgetSubItem[]

  // pendiente(h) de las hojas fijas en el mes en curso.
  const spentCat: Record<string, number> = {}
  const spentSub: Record<string, number> = {}
  for (const t of existing) {
    if (t.type !== 'expense' || monthOf(t.date) !== currentMonth) continue
    if (t.category_id) spentCat[t.category_id] = (spentCat[t.category_id] ?? 0) + Number(t.amount)
    if (t.budget_sub_item_id) spentSub[t.budget_sub_item_id] = (spentSub[t.budget_sub_item_id] ?? 0) + Number(t.amount)
  }
  const leaves = fixedLeaves(categories.filter((c) => c.bucket !== 'income'), subItems)
  const pendingByLeaf = Object.fromEntries(leaves.map((l) => [l.id, leafPending(l, spentCat, spentSub)]))

  const overrideRows = (overrides ?? []) as { merchant_key: string; category_id: string }[]
  const classified = classifyCharges(charges, existing, {
    categories, subItems, overrides: overrideRows,
    fixedLeafIds: leaves.map((l) => l.id), pendingByLeaf, currentMonth,
  })
  const matches: Record<string, MatchedTx> = {}
  for (const r of classified) {
    const m = r.matchId ? existing.find((t) => t.id === r.matchId) : undefined
    if (m) matches[m.id] = m
  }
  return { classified, matches, categories, subItems, overrideKeys: overrideRows.map((o) => o.merchant_key) }
}

export interface ReviewedCharge extends BankCharge {
  kind: 'duplicate' | 'fixed' | 'new'
  /** Duplicado: true = "Es el mismo", false = "Son distintos". */
  same: boolean | null
  matchId: string | null
  categoryId: string | null
  subItemId: string | null
  original_amount?: number | null
  original_currency?: string | null
}

export interface ImportUndo {
  insertedIds: string[]
  /** Valores anteriores de las transacciones juntadas con el banco. */
  updated: { id: string; date: string; amount: number | string; statement_import_id: string | null; bank_description: string | null }[]
  overrideKeys: string[]
  householdId: string
  importId: string
}

export interface ImportOutcome {
  inserted: number
  avoided: number
  undo: ImportUndo
}

/**
 * Guarda la revisión: "Es el mismo" actualiza la transacción registrada con
 * los datos del banco; "Son distintos", fijos y nuevos se insertan. Los
 * fijos sin regla de comercio la crean.
 */
export async function confirmStatement(
  supabase: Client,
  params: {
    householdId: string
    userId: string
    importId: string
    charges: ReviewedCharge[]
    matches: Record<string, MatchedTx>
    categories: BudgetCategory[]
    overrideKeys: string[]
    paymentMethod: 'tarjeta' | 'transferencia'
  },
): Promise<ImportOutcome> {
  const { householdId, userId, importId, charges, matches, categories } = params
  const undo: ImportUndo = { insertedIds: [], updated: [], overrideKeys: [], householdId, importId }

  // "Es el mismo": no se inserta nada; la registrada toma fecha y monto del banco.
  const same = charges.filter((c) => c.kind === 'duplicate' && c.same === true && c.matchId)
  for (const c of same) {
    const prev = matches[c.matchId!]
    const { error } = await supabase
      .from('transactions')
      .update({ date: c.date, amount: c.amount, statement_import_id: importId, bank_description: c.description })
      .eq('id', c.matchId!)
    if (error) throw new Error(error.message)
    undo.updated.push({
      id: c.matchId!, date: prev.date, amount: prev.amount,
      statement_import_id: prev.statement_import_id ?? null, bank_description: prev.bank_description ?? null,
    })
  }

  const toInsert = charges.filter((c) => !(c.kind === 'duplicate' && c.same === true))
  if (toInsert.length > 0) {
    const rows = toInsert.map((c) => {
      const cat = categories.find((x) => x.id === c.categoryId)
      return {
        household_id: householdId,
        amount: c.amount,
        description: cleanBankName(c.description),
        bank_description: c.description,
        category_id: c.categoryId,
        date: c.date,
        source: 'statement' as const,
        statement_import_id: importId,
        type: c.type,
        transaction_type: deriveTransactionType(c.type, cat?.bucket),
        payment_method: c.type === 'income' ? 'transferencia' : params.paymentMethod,
        created_by: userId,
        original_amount: c.original_amount ?? null,
        original_currency: c.original_currency ?? null,
        ...(c.subItemId ? { budget_sub_item_id: c.subItemId } : {}),
      }
    })
    const { data, error } = await supabase.from('transactions').insert(rows).select('id')
    if (error) throw new Error(error.message)
    undo.insertedIds = ((data ?? []) as { id: string }[]).map((r) => r.id)
  }

  // Fijo reconocido: se recuerda la descripción del banco → categoría.
  const known = new Set(params.overrideKeys)
  for (const c of toInsert.filter((x) => x.kind === 'fixed' && x.categoryId)) {
    const key = getMerchantKey(c.description)
    if (!key || known.has(key)) continue
    const { error } = await supabase.from('merchant_category_overrides').insert({
      merchant_key: key, category_id: c.categoryId, household_id: householdId, created_by: userId,
    })
    if (!error) { undo.overrideKeys.push(key); known.add(key) }
  }

  await supabase.from('statement_imports').update({
    duplicates_detected: same.length,
    transactions_imported: undo.insertedIds.length,
    status: 'completed',
  }).eq('id', importId)

  return { inserted: undo.insertedIds.length, avoided: same.length, undo }
}

/** Revierte inserciones, actualizaciones y reglas creadas por confirmStatement. */
export async function undoStatement(supabase: Client, undo: ImportUndo): Promise<void> {
  if (undo.insertedIds.length > 0) await supabase.from('transactions').delete().in('id', undo.insertedIds)
  for (const u of undo.updated) {
    await supabase.from('transactions').update({
      date: u.date, amount: u.amount, statement_import_id: u.statement_import_id, bank_description: u.bank_description,
    }).eq('id', u.id)
  }
  for (const key of undo.overrideKeys) {
    await supabase.from('merchant_category_overrides').delete().eq('household_id', undo.householdId).eq('merchant_key', key)
  }
  await supabase.from('statement_imports').update({ transactions_imported: 0, duplicates_detected: 0, status: 'failed' }).eq('id', undo.importId)
}

/** "Agregaste 3 del banco · evitaste 2 repetidos". */
export function importToast(inserted: number, avoided: number): string {
  const first = `Agregaste ${inserted} del banco`
  if (avoided === 0) return first
  return `${first} · evitaste ${avoided} ${avoided === 1 ? 'repetido' : 'repetidos'}`
}
