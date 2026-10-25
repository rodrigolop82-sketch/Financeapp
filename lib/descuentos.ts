// Códigos de descuento: reglas y textos, sin React ni base de datos.
// 1–99% lo cobra Recurrente con su cupón del mismo código; 100% es gratis
// y lo da la app (lib/billing/codes.ts).

import { priceLabel, type Cycle, type Tier } from './plans'

export interface DiscountCode {
  id: string
  code: string
  percentOff: number
  /** null = indefinido. */
  durationMonths: number | null
  tiers: Tier[]
  cycles: Cycle[]
  maxRedemptions: number | null
  expiresAt: string | null
  active: boolean
  note: string | null
  redemptions: number
  createdAt?: string
}

/** Lo que ve la persona en Planes al aplicar un código. */
export interface PublicCode {
  code: string
  percentOff: number
  durationMonths: number | null
  tiers: Tier[]
  cycles: Cycle[]
}

export interface DiscountCodeRow {
  id: string
  code: string
  percent_off: number
  duration_months: number | null
  tiers: string[] | null
  cycles: string[] | null
  max_redemptions: number | null
  expires_at: string | null
  active: boolean
  note: string | null
  created_at?: string
}

const TIERS: Tier[] = ['premium', 'family']
const CYCLES: Cycle[] = ['monthly', 'annual']

export function fromRow(r: DiscountCodeRow, redemptions = 0): DiscountCode {
  return {
    id: r.id,
    code: r.code,
    percentOff: r.percent_off,
    durationMonths: r.duration_months,
    tiers: TIERS.filter((t) => !r.tiers || r.tiers.includes(t)),
    cycles: CYCLES.filter((c) => !r.cycles || r.cycles.includes(c)),
    maxRedemptions: r.max_redemptions,
    expiresAt: r.expires_at,
    active: r.active,
    note: r.note,
    redemptions,
    createdAt: r.created_at,
  }
}

export function toPublic(c: DiscountCode): PublicCode {
  return { code: c.code, percentOff: c.percentOff, durationMonths: c.durationMonths, tiers: c.tiers, cycles: c.cycles }
}

export const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/

/** "  amigos 50 " → "AMIGOS50". */
export function normalizeCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.toUpperCase().replace(/\s+/g, '') : ''
}

export function isFree(c: { percentOff: number }): boolean {
  return c.percentOff >= 100
}

/** Por qué no se puede usar el código hoy, o null si se puede. */
export function codeProblem(c: DiscountCode, opts: { usedByUser: boolean; now?: number }): string | null {
  const now = opts.now ?? Date.now()
  if (!c.active) return 'Este código ya no está activo'
  if (c.expiresAt && Date.parse(c.expiresAt) <= now) return 'Este código ya venció'
  if (opts.usedByUser) return 'Ya usaste este código'
  if (c.maxRedemptions != null && c.redemptions >= c.maxRedemptions) return 'Este código ya se usó todas las veces posibles'
  return null
}

const TIER_NAME: Record<Tier, string> = { premium: 'Premium', family: 'Familiar' }
const CYCLE_NAME: Record<Cycle, string> = { monthly: 'mensual', annual: 'anual' }

/**
 * Por qué no aplica al plan elegido, o null si aplica. Gratis no se cobra,
 * así que el ciclo no importa.
 */
export function codeMismatch(c: PublicCode, tier: Tier, cycle: Cycle): string | null {
  if (!c.tiers.includes(tier)) {
    return `Este código es solo para ${c.tiers.map((t) => TIER_NAME[t]).join(' y ')}`
  }
  if (!isFree(c) && !c.cycles.includes(cycle)) {
    return `Este código es solo para el plan ${c.cycles.map((x) => CYCLE_NAME[x]).join(' y ')}`
  }
  return null
}

function months(n: number): string {
  return `${n} ${n === 1 ? 'mes' : 'meses'}`
}

/** "Gratis por 3 meses", "Gratis sin vencimiento", "50% por 3 meses", "50% para siempre". */
export function discountLabel(c: { percentOff: number; durationMonths: number | null }): string {
  if (isFree(c)) return c.durationMonths ? `Gratis por ${months(c.durationMonths)}` : 'Gratis sin vencimiento'
  return c.durationMonths ? `${c.percentOff}% por ${months(c.durationMonths)}` : `${c.percentOff}% para siempre`
}

/** Precio con el descuento, en centavos. */
export function discountedCents(cents: number, percentOff: number): number {
  return Math.max(0, Math.round(cents * (100 - Math.min(100, Math.max(0, percentOff))) / 100))
}

/** Ayuda bajo el botón de pagar con un código parcial ya aplicado. */
export function codePriceHelp(c: { percentOff: number; durationMonths: number | null }, cents: number, period: string): string {
  const now = priceLabel(discountedCents(cents, c.percentOff))
  if (!c.durationMonths) return `Se cobra hoy · ${now} ${period} con tu código`
  return `Se cobra hoy · ${now} ${period} con tu código por ${months(c.durationMonths)}; después ${priceLabel(cents)} ${period}`
}

/** Ayuda bajo el botón de activar con un código gratis. */
export function freeCodeHelp(c: { durationMonths: number | null }): string {
  return c.durationMonths ? `Gratis por ${months(c.durationMonths)} · sin tarjeta` : 'Gratis sin vencimiento · sin tarjeta'
}

/** Fin del plan gratis: hoy + N meses de calendario; null = sin vencimiento. */
export function grantEnd(months: number | null, now: Date = new Date()): string | null {
  if (!months) return null
  const d = new Date(now)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  // 31 de enero + 1 mes = 28/29 de febrero, no 3 de marzo.
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.toISOString()
}

export interface NewCodeInput {
  code: string
  percentOff: number
  durationMonths: number | null
  tiers: Tier[]
  cycles: Cycle[]
  maxRedemptions: number | null
  expiresAt: string | null
  note: string | null
}

function intOrNull(v: unknown): number | null | 'bad' {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) ? n : 'bad'
}

/** Valida lo que manda el formulario del admin. */
export function parseNewCode(body: unknown, now: number = Date.now()): { ok: true; value: NewCodeInput } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const code = normalizeCode(b.code)
  if (!CODE_PATTERN.test(code)) return { ok: false, error: 'El código lleva de 3 a 32 letras, números, - o _' }

  const percent = intOrNull(b.percentOff)
  if (percent === null || percent === 'bad' || percent < 1 || percent > 100) {
    return { ok: false, error: 'El descuento va de 1% a 100%' }
  }

  const duration = intOrNull(b.durationMonths)
  if (duration === 'bad' || (duration !== null && (duration < 1 || duration > 120))) {
    return { ok: false, error: 'La duración va de 1 a 120 meses, o indefinida' }
  }

  const tiers = TIERS.filter((t) => Array.isArray(b.tiers) && b.tiers.includes(t))
  if (tiers.length === 0) return { ok: false, error: 'Elige al menos un plan' }
  // Gratis no se cobra: el ciclo no aplica.
  const cycles = percent === 100 ? [...CYCLES] : CYCLES.filter((c) => Array.isArray(b.cycles) && b.cycles.includes(c))
  if (cycles.length === 0) return { ok: false, error: 'Elige mensual, anual o los dos' }

  const max = intOrNull(b.maxRedemptions)
  if (max === 'bad' || (max !== null && max < 1)) return { ok: false, error: 'Los usos máximos son 1 o más (o sin límite)' }

  let expiresAt: string | null = null
  if (typeof b.expiresAt === 'string' && b.expiresAt) {
    // "2026-12-31" vence al terminar ese día (hora de Guatemala, UTC-6).
    const raw = /^\d{4}-\d{2}-\d{2}$/.test(b.expiresAt) ? `${b.expiresAt}T23:59:59-06:00` : b.expiresAt
    const t = Date.parse(raw)
    if (Number.isNaN(t)) return { ok: false, error: 'La fecha de vencimiento no es válida' }
    if (t <= now) return { ok: false, error: 'La fecha de vencimiento ya pasó' }
    expiresAt = new Date(t).toISOString()
  }

  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 200) : null
  return { ok: true, value: { code, percentOff: percent, durationMonths: duration, tiers, cycles, maxRedemptions: max, expiresAt, note } }
}

/** Código al azar para el botón "Generar": sin 0/O ni 1/I. */
export function randomCode(length = 8, rnd: () => number = Math.random): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(rnd() * chars.length)]).join('')
}

export type CodeStatus = 'Activo' | 'Pausado' | 'Vencido' | 'Agotado'

/** Estado para la lista del admin. */
export function codeStatus(c: DiscountCode, now: number = Date.now()): CodeStatus {
  if (!c.active) return 'Pausado'
  if (c.expiresAt && Date.parse(c.expiresAt) <= now) return 'Vencido'
  if (c.maxRedemptions != null && c.redemptions >= c.maxRedemptions) return 'Agotado'
  return 'Activo'
}
