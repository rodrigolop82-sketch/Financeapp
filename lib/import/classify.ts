// Clasificación de cada cargo de un estado de cuenta contra lo que ya está
// registrado (Fase 7): ya importado, posible duplicado, coincide con un
// gasto fijo o nuevo. Funciones puras: lib/import/classify.test.ts.
import { getMerchantKey } from '../transactions/merchant-key'

export interface BankCharge {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  /** Categoría que sugirió la extracción (si encontró una). */
  category_id?: string | null
}

export interface ExistingTx {
  id: string
  date: string
  amount: number | string
  description: string | null
  category_id: string | null
  type: 'expense' | 'income'
  budget_sub_item_id?: string | null
  statement_import_id?: string | null
  bank_description?: string | null
}

export interface ClassifyCategory {
  id: string
  name: string
  bucket: string
}

export interface ClassifySubItem {
  id: string
  category_id: string
  name: string
}

export interface ClassifyContext {
  categories: ClassifyCategory[]
  subItems: ClassifySubItem[]
  /** merchant_category_overrides del hogar. */
  overrides: { merchant_key: string; category_id: string }[]
  /** Hojas fijas (parte, o categoría sin partes) de básico y gustos. */
  fixedLeafIds: string[]
  /** pendiente(h) del mes en curso por hoja. */
  pendingByLeaf: Record<string, number>
  /** 'YYYY-MM' en curso: solo sus cargos pueden coincidir con un fijo. */
  currentMonth: string
}

export type ChargeKind = 'imported' | 'duplicate' | 'fixed' | 'new'

export interface ClassifiedCharge {
  kind: ChargeKind
  /** Duplicado: la transacción registrada. Importado: la que ya lo trae. */
  matchId: string | null
  categoryId: string | null
  subItemId: string | null
}

/** Tolerancia de monto (2 % del cargo) y de fecha (5 días). */
export const AMOUNT_TOLERANCE = 0.02
export const DAYS_TOLERANCE = 5

export function normalizeText(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

function words(s: string): string[] {
  return normalizeText(s).split(' ').filter(Boolean)
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(dayNumber(a) - dayNumber(b))
}

function cents(n: number | string): number {
  return Math.round(Number(n) * 100)
}

export function amountsClose(a: number | string, bankAmount: number): boolean {
  return Math.abs(Number(a) - bankAmount) <= AMOUNT_TOLERANCE * bankAmount + 1e-9
}

/** Palabras del banco → texto que debe contener el nombre de la parte. */
const PART_KEYWORDS: { prefixes: string[]; targets: string[] }[] = [
  { prefixes: ['cond', 'cuota', 'mantenim'], targets: ['mantenim'] },
  { prefixes: ['renta', 'alquiler', 'hipoteca'], targets: ['renta', 'hipoteca', 'alquiler'] },
]

/** Palabras del banco → nombres de categoría que suelen corresponder. */
const CATEGORY_KEYWORDS: { prefixes: string[]; names: string[] }[] = [
  { prefixes: ['super', 'walmart', 'pricesmart', 'paiz', 'despensa', 'maxi'], names: ['super', 'alimentacion', 'supermercado'] },
  { prefixes: ['netflix', 'spotify', 'disney', 'hbo', 'youtube', 'icloud', 'apple'], names: ['suscripciones'] },
  { prefixes: ['uber', 'shell', 'puma', 'texaco', 'gasolin'], names: ['transporte'] },
  { prefixes: ['farmacia', 'hospital', 'clinica'], names: ['salud'] },
  { prefixes: ['eegsa', 'energuate', 'claro', 'tigo', 'empagua'], names: ['servicios'] },
  { prefixes: ['restaurante', 'campero', 'pizza', 'mcdonald', 'starbucks'], names: ['restaurantes'] },
]

function hasPrefix(tokens: string[], prefixes: string[]): boolean {
  return tokens.some((t) => prefixes.some((p) => t.startsWith(p)))
}

/**
 * Categoría (y parte) sugerida: primero la regla del comercio
 * (merchant_category_overrides), si no palabras clave, y si no la que
 * sugirió la extracción. En categorías con partes, la parte por palabras clave.
 */
export function suggestCategory(
  charge: Pick<BankCharge, 'description' | 'category_id'>,
  ctx: Pick<ClassifyContext, 'categories' | 'subItems' | 'overrides'>,
): { categoryId: string | null; subItemId: string | null } {
  const tokens = words(charge.description)
  const key = getMerchantKey(charge.description)
  const override = key ? ctx.overrides.find((o) => o.merchant_key === key) : undefined

  // Parte por palabras clave (Vivienda · Mantenimiento con "COND ... CUOTA").
  let part: ClassifySubItem | undefined
  for (const rule of PART_KEYWORDS) {
    if (!hasPrefix(tokens, rule.prefixes)) continue
    part = ctx.subItems.find((s) =>
      rule.targets.some((t) => normalizeText(s.name).includes(t))
      && (!override || s.category_id === override.category_id))
    if (part) break
  }

  let categoryId: string | null = override?.category_id ?? part?.category_id ?? null
  if (!categoryId) {
    for (const rule of CATEGORY_KEYWORDS) {
      if (!hasPrefix(tokens, rule.prefixes)) continue
      const cat = ctx.categories.find((c) => c.bucket !== 'income'
        && rule.names.some((n) => normalizeText(c.name).startsWith(n)))
      if (cat) { categoryId = cat.id; break }
    }
  }
  categoryId ??= charge.category_id ?? null
  const subItemId = part && part.category_id === categoryId ? part.id : null
  return { categoryId, subItemId }
}

function firstWord(s: string | null | undefined): string | null {
  const w = words(s ?? '')[0]
  return w && w.length >= 3 ? w : null
}

/** Ya importado: mismo bank_description + fecha + monto en una transacción con statement_import_id. */
export function isAlreadyImported(charge: BankCharge, existing: ExistingTx[]): ExistingTx | undefined {
  return existing.find((t) => !!t.statement_import_id
    && (t.bank_description ?? '') === charge.description
    && t.date === charge.date
    && cents(t.amount) === cents(charge.amount))
}

/** ¿Puede `t` (registrada a mano) ser el mismo pago que el cargo? */
export function couldBeSamePayment(charge: BankCharge, categoryId: string | null, t: ExistingTx): boolean {
  if (t.statement_import_id) return false
  if (t.type !== charge.type) return false
  if (!amountsClose(t.amount, charge.amount)) return false
  if (daysBetween(t.date, charge.date) > DAYS_TOLERANCE) return false
  if (categoryId && t.category_id === categoryId) return true
  const w = firstWord(t.description)
  return !!w && normalizeText(charge.description).includes(w)
}

/**
 * Clasifica cada cargo, en este orden: ya importado → posible duplicado
 * (emparejamiento uno a uno, por fecha más cercana) → coincide con un gasto
 * fijo → nuevo.
 */
export function classifyCharges(charges: BankCharge[], existing: ExistingTx[], ctx: ClassifyContext): ClassifiedCharge[] {
  const out: ClassifiedCharge[] = charges.map((c) => ({ kind: 'new', matchId: null, ...suggestCategory(c, ctx) }))

  // 1. Ya importados antes.
  const usedExisting = new Set<string>()
  charges.forEach((c, i) => {
    const t = isAlreadyImported(c, existing)
    if (t) { out[i].kind = 'imported'; out[i].matchId = t.id; usedExisting.add(t.id) }
  })

  // 2. Posibles duplicados: todas las parejas posibles, de la fecha más cercana a la más lejana.
  const pairs: { i: number; t: ExistingTx; days: number; diff: number }[] = []
  charges.forEach((c, i) => {
    if (out[i].kind !== 'new') return
    for (const t of existing) {
      if (usedExisting.has(t.id) || !couldBeSamePayment(c, out[i].categoryId, t)) continue
      pairs.push({ i, t, days: daysBetween(t.date, c.date), diff: Math.abs(Number(t.amount) - c.amount) })
    }
  })
  pairs.sort((a, b) => a.days - b.days || a.diff - b.diff)
  for (const p of pairs) {
    if (out[p.i].kind !== 'new' || usedExisting.has(p.t.id)) continue
    out[p.i].kind = 'duplicate'
    out[p.i].matchId = p.t.id
    usedExisting.add(p.t.id)
  }

  // 3. Coincide con un gasto fijo pendiente del mes.
  const fixed = new Set(ctx.fixedLeafIds)
  const withParts = new Set(ctx.subItems.map((s) => s.category_id))
  const pendingLeft = { ...ctx.pendingByLeaf }
  charges.forEach((c, i) => {
    const r = out[i]
    if (r.kind !== 'new' || c.type !== 'expense' || !c.date.startsWith(ctx.currentMonth)) return
    const leaf = r.subItemId ?? (r.categoryId && !withParts.has(r.categoryId) ? r.categoryId : null)
    if (!leaf || !fixed.has(leaf)) return
    const pending = pendingLeft[leaf] ?? 0
    if (pending > 0 && Math.abs(pending - c.amount) <= AMOUNT_TOLERANCE * c.amount + 1e-9) {
      r.kind = 'fixed'
      pendingLeft[leaf] = 0
    }
  })

  return out
}

/** "Super La Torre" a partir de "SUPERMERCADOS LA TORRE Z10": mayúscula inicial por palabra. */
export function cleanBankName(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(\S)/g, (_, sp: string, ch: string) => sp + ch.toUpperCase())
}
