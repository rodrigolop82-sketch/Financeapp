// Datos de "Buscar duplicados": carga de movimientos, parejas descartadas,
// borrado de los repetidos con "Deshacer" y descarte de parejas.
import type { SupabaseClient } from '@supabase/supabase-js'
import { pairKey, type DuplicatePair, type DupTx, type MergePatch } from './find'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

const COLS = 'id, date, amount, description, category_id, type, statement_import_id, bank_description, created_at, budget_sub_item_id, note, paid_by, scope, evento_concepto_id, payment_card'
const PAGE = 1000

export interface DuplicateScope {
  /** Hogares de 2: solo lo que pagó esta persona. */
  paidBy?: string
  /** Solo lo personal. */
  personal?: boolean
}

/** Movimientos del periodo, paginados de 1000 (mismo patrón que la importación). */
export async function loadDuplicateCandidates(
  supabase: Client,
  householdId: string,
  from: string,
  to: string,
  scope: DuplicateScope = {},
): Promise<DupTx[]> {
  const out: DupTx[] = []
  for (let page = 0; ; page++) {
    let q = supabase
      .from('transactions')
      .select(COLS)
      .eq('household_id', householdId)
      .gte('date', from)
      .lte('date', to)
    if (scope.personal) q = q.eq('scope', 'personal')
    else if (scope.paidBy) q = q.eq('paid_by', scope.paidBy)
    const { data, error } = await q
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as DupTx[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

/** Claves de las parejas que el usuario ya marcó como "Son distintos". */
export async function loadDismissedKeys(supabase: Client, householdId: string): Promise<Set<string>> {
  const keys = new Set<string>()
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('duplicate_dismissals')
      .select('tx_a_id, tx_b_id')
      .eq('household_id', householdId)
      .order('id', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as { tx_a_id: string; tx_b_id: string }[]) keys.add(pairKey(r.tx_a_id, r.tx_b_id))
    if (!data || data.length < PAGE) break
  }
  return keys
}

/** Guarda "Son distintos" para estas parejas (las ya guardadas se ignoran). */
export async function dismissPairs(supabase: Client, householdId: string, pairKeys: string[]): Promise<void> {
  if (pairKeys.length === 0) return
  const rows = pairKeys.map((k) => {
    const [a, b] = k.split('|')
    return { household_id: householdId, tx_a_id: a, tx_b_id: b }
  })
  const { error } = await supabase
    .from('duplicate_dismissals')
    .upsert(rows, { onConflict: 'tx_a_id,tx_b_id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

/** Para deshacer: la fila borrada completa y cómo estaba el que se quedó. */
export interface MergeUndo {
  restores: {
    keepId: string
    /** La fila borrada tal como estaba (para volver a insertarla con el mismo id). */
    droppedRow: Record<string, unknown>
    /** Valores anteriores de los campos que se copiaron al que se quedó. */
    keepBefore: MergePatch
  }[]
}

/**
 * Borra el repetido de cada pareja y pasa al que se queda lo que el usuario
 * ya había decidido. Si algo falla a la mitad, deshace lo hecho y lanza el error.
 */
export async function applyMerges(supabase: Client, pairs: DuplicatePair[]): Promise<MergeUndo> {
  const undo: MergeUndo = { restores: [] }
  try {
    for (const p of pairs) {
      const { data: row, error: readError } = await supabase.from('transactions').select('*').eq('id', p.dropId).single()
      if (readError || !row) throw new Error(readError?.message ?? 'No se encontró el movimiento')

      const keepBefore: MergePatch = {}
      for (const f of Object.keys(p.patch) as (keyof MergePatch)[]) keepBefore[f] = (p.a[f] ?? null) as string | null

      if (Object.keys(p.patch).length > 0) {
        const { error } = await supabase.from('transactions').update(p.patch).eq('id', p.keepId)
        if (error) throw new Error(error.message)
      }
      const { error: deleteError } = await supabase.from('transactions').delete().eq('id', p.dropId)
      if (deleteError) {
        if (Object.keys(p.patch).length > 0) await supabase.from('transactions').update(keepBefore).eq('id', p.keepId)
        throw new Error(deleteError.message)
      }
      undo.restores.push({ keepId: p.keepId, droppedRow: row as Record<string, unknown>, keepBefore })
    }
    return undo
  } catch (err) {
    await undoMerges(supabase, undo).catch(() => {})
    throw err
  }
}

/** Vuelve a insertar lo borrado (mismos ids) y revierte lo copiado al que se quedó. */
export async function undoMerges(supabase: Client, undo: MergeUndo): Promise<void> {
  for (const r of [...undo.restores].reverse()) {
    const { error } = await supabase.from('transactions').insert(r.droppedRow)
    // 23505: ya existe (ya se había restaurado): no es un error.
    if (error && (error as { code?: string }).code !== '23505') throw new Error(error.message)
    if (Object.keys(r.keepBefore).length > 0) {
      await supabase.from('transactions').update(r.keepBefore).eq('id', r.keepId)
    }
  }
}
