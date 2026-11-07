// Buscar duplicados en Movimientos: parejas de movimientos que parecen el mismo
// cargo registrado dos veces. Funciones puras: lib/duplicates/find.test.ts.
import { daysBetween, normalizeText } from '../import/classify'
import { looseText, namesSimilar } from '../import/name-match'

export interface DupTx {
  id: string
  date: string
  amount: number | string
  description: string | null
  category_id: string | null
  type: 'expense' | 'income'
  statement_import_id?: string | null
  bank_description?: string | null
  created_at?: string | null
  budget_sub_item_id?: string | null
  note?: string | null
  paid_by?: string | null
  scope?: 'shared' | 'personal' | null
  evento_concepto_id?: string | null
  payment_card?: string | null
}

export type DupConfidence = 'strong' | 'weak'

/** Campos que, al borrar uno, se pueden copiar al que se queda. */
export type MergeField = 'category_id' | 'budget_sub_item_id' | 'note' | 'paid_by' | 'scope' | 'evento_concepto_id' | 'payment_card'
export type MergePatch = Partial<Record<MergeField, string | null>>

export interface DuplicatePair {
  /** Clave estable de la pareja (ids ordenados). */
  key: string
  a: DupTx
  b: DupTx
  confidence: DupConfidence
  reasons: string[]
  keepId: string
  dropId: string
  /** Lo que ya había decidido el usuario en el que se borra y pasa al que se queda. */
  patch: MergePatch
}

/** Días de tolerancia: entre un cargo del banco y uno anotado a mano; entre dos del banco. */
export const MAX_DAYS_MANUAL = 3
export const MAX_DAYS_BANK = 1

const cents = (n: number | string) => Math.round(Number(n) * 100)

/** Clave de una pareja sin importar el orden. */
export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`
}

const isBank = (t: DupTx) => !!t.statement_import_id

/** El texto más fiel al original: lo que dijo el banco, si lo hay. */
const textOf = (t: DupTx) => t.bank_description || t.description || ''

function nameMatch(a: DupTx, b: DupTx): 'same' | 'similar' | null {
  const exact = looseText(textOf(a)) !== '' && looseText(textOf(a)) === looseText(textOf(b))
  if (exact || (looseText(a.description) !== '' && looseText(a.description) === looseText(b.description))) return 'same'
  if (namesSimilar(textOf(a), textOf(b)) || namesSimilar(a.description, b.description)) return 'similar'
  return null
}

function dayReason(days: number): string {
  if (days === 0) return 'Mismo día'
  if (days === 1) return '1 día de diferencia'
  return `${days} días de diferencia`
}

/** Cuál se queda: el del banco; si ambos o ninguno, el más antiguo. */
export function chooseKeeper(a: DupTx, b: DupTx): { keep: DupTx; drop: DupTx } {
  if (isBank(a) !== isBank(b)) return isBank(a) ? { keep: a, drop: b } : { keep: b, drop: a }
  const ka = a.created_at ?? ''
  const kb = b.created_at ?? ''
  if (ka !== kb) return ka < kb ? { keep: a, drop: b } : { keep: b, drop: a }
  return a.id < b.id ? { keep: a, drop: b } : { keep: b, drop: a }
}

const blank = (v: unknown) => v === null || v === undefined || v === ''

/**
 * Lo que decidió el usuario en el movimiento que se borra y no se debe perder.
 * Si se borra el que anotó él a mano, su categoría, parte, nota, quién pagó y
 * alcance ganan sobre lo sugerido al importar. En los demás casos solo se
 * llenan los campos vacíos del que se queda.
 */
export function mergePatch(keep: DupTx, drop: DupTx): MergePatch {
  const patch: MergePatch = {}
  const userMadeDrop = !isBank(drop) && isBank(keep)
  const fields: MergeField[] = ['category_id', 'budget_sub_item_id', 'note', 'paid_by', 'scope', 'evento_concepto_id', 'payment_card']
  for (const f of fields) {
    const from = drop[f] ?? null
    const to = keep[f] ?? null
    if (blank(from) || from === to) continue
    const overwrite = userMadeDrop && (f === 'category_id' || f === 'budget_sub_item_id' || f === 'scope')
    if (blank(to) || overwrite) patch[f] = from as string
  }
  // La parte pertenece a su categoría: si cambió la categoría y no hay parte nueva, se quita la vieja.
  if (patch.category_id && !('budget_sub_item_id' in patch) && keep.budget_sub_item_id) patch.budget_sub_item_id = null
  // "Compartido" es el valor por defecto: no se copia como si fuera una decisión.
  if (patch.scope === 'shared') delete patch.scope
  return patch
}

interface Candidate {
  a: DupTx
  b: DupTx
  days: number
  confidence: DupConfidence
  reasons: string[]
}

/**
 * Parejas de posibles duplicados. Mismo tipo y mismo monto (centavos); fecha a
 * ≤3 días (≤1 si los dos vienen de un estado de cuenta). "Muy probable":
 * nombre parecido, o misma categoría a ≤1 día. "Revisa con cuidado": mismo
 * monto a ≤1 día sin parecido. Uno a uno, de la fecha más cercana a la más
 * lejana. `dismissed` son las parejas que el usuario ya dijo que son distintas.
 */
export function findDuplicatePairs(txs: DupTx[], dismissed: ReadonlySet<string> = new Set()): DuplicatePair[] {
  const groups = new Map<string, DupTx[]>()
  for (const t of txs) {
    const k = `${t.type}|${cents(t.amount)}`
    const g = groups.get(k)
    if (g) g.push(t)
    else groups.set(k, [t])
  }

  const candidates: Candidate[] = []
  groups.forEach((group) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (dismissed.has(pairKey(a.id, b.id))) continue
        // Dos cargos de un mismo estado de cuenta son líneas distintas.
        if (a.statement_import_id && a.statement_import_id === b.statement_import_id) continue
        // Hogares de 2: de quién pagó cada uno manda.
        if (a.paid_by && b.paid_by && a.paid_by !== b.paid_by) continue
        const days = daysBetween(a.date, b.date)
        const limit = isBank(a) && isBank(b) ? MAX_DAYS_BANK : MAX_DAYS_MANUAL
        if (days > limit) continue
        const name = nameMatch(a, b)
        const sameCat = !!a.category_id && a.category_id === b.category_id
        let confidence: DupConfidence
        if (name || (sameCat && days <= 1)) confidence = 'strong'
        else if (days <= 1) confidence = 'weak'
        else continue
        const reasons = ['Mismo monto', dayReason(days)]
        if (name === 'same') reasons.push('Mismo nombre')
        else if (name === 'similar') reasons.push('Nombre parecido')
        if (sameCat) reasons.push('Misma categoría')
        candidates.push({ a, b, days, confidence, reasons })
      }
    }
  })

  candidates.sort((x, y) =>
    x.days - y.days
    || (x.confidence === y.confidence ? 0 : x.confidence === 'strong' ? -1 : 1)
    || pairKey(x.a.id, x.b.id).localeCompare(pairKey(y.a.id, y.b.id)))

  const used = new Set<string>()
  const out: DuplicatePair[] = []
  for (const c of candidates) {
    if (used.has(c.a.id) || used.has(c.b.id)) continue
    used.add(c.a.id)
    used.add(c.b.id)
    const { keep, drop } = chooseKeeper(c.a, c.b)
    out.push({
      key: pairKey(c.a.id, c.b.id),
      a: keep,
      b: drop,
      confidence: c.confidence,
      reasons: c.reasons,
      keepId: keep.id,
      dropId: drop.id,
      patch: mergePatch(keep, drop),
    })
  }

  // Lo más seguro primero, y dentro de cada grupo lo más reciente.
  out.sort((x, y) =>
    (x.confidence === y.confidence ? 0 : x.confidence === 'strong' ? -1 : 1)
    || (x.a.date < y.a.date ? 1 : x.a.date > y.a.date ? -1 : 0)
    || x.key.localeCompare(y.key))
  return out
}

/** Nombre corto para mostrar la pareja: el de la transacción que se queda, sin ruido. */
export function pairTitle(p: DuplicatePair): string {
  const raw = p.a.description || p.a.bank_description || p.b.description || p.b.bank_description || 'Movimiento'
  return normalizeText(raw) ? raw.trim() : 'Movimiento'
}

/** "Estado de cuenta", "Lo anotaste tú" o "Importado de nuevo" (el banco que se repite). */
export function originLabel(t: DupTx, other: DupTx): string {
  if (!isBank(t)) return 'Lo anotaste tú'
  if (isBank(other)) {
    const older = (t.created_at ?? '') <= (other.created_at ?? '')
    return older ? 'Estado de cuenta' : 'Importado de nuevo'
  }
  return 'Estado de cuenta'
}

/** Frase de "cuál se queda" para mostrar en cada pareja. */
export function keepNote(p: DuplicatePair): string {
  if (p.confidence === 'weak') return 'Los nombres no se parecen. Revisa antes de borrar.'
  const keepBank = isBank(p.a)
  const dropBank = isBank(p.b)
  if (keepBank && !dropBank) return 'Se queda el del banco; se borra el que anotaste.'
  if (keepBank && dropBank) return 'Los dos vienen del banco; se borra el importado después.'
  return 'Se queda el más antiguo; se borra el otro.'
}
