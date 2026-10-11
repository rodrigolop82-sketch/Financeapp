// Tipos de fuente y validación de lo que llega de la pantalla (puro).
// Las tarjetas y préstamos viven en el módulo Deudas: aquí solo se declaran
// otros pasivos, para no contarlos dos veces.

export const ASSET_KINDS = ['bank_account', 'cash', 'investment', 'property_or_vehicle', 'other_asset'] as const
export const MANUAL_LIABILITY_KINDS = ['other_liability'] as const
export const MANUAL_KINDS = [...ASSET_KINDS, ...MANUAL_LIABILITY_KINDS] as const
export type ManualKind = (typeof MANUAL_KINDS)[number]
export type SourceKind = ManualKind | 'credit_card' | 'loan'

export const KIND_LABEL: Record<SourceKind, string> = {
  bank_account: 'Cuenta bancaria',
  cash: 'Efectivo',
  investment: 'Inversión',
  property_or_vehicle: 'Casa o vehículo',
  other_asset: 'Otro activo',
  credit_card: 'Tarjeta de crédito',
  loan: 'Préstamo',
  other_liability: 'Otra deuda',
}

export const KIND_EMOJI: Record<SourceKind, string> = {
  bank_account: '🏦', cash: '💵', investment: '📈', property_or_vehicle: '🏠', other_asset: '💎',
  credit_card: '💳', loan: '🧾', other_liability: '🧾',
}

export const INSTITUTION_SUGGESTIONS = ['Banrural', 'BI', 'G&T Continental', 'BAM']

export const MAX_BALANCE = 1_000_000_000

export function isManualKind(v: unknown): v is ManualKind {
  return typeof v === 'string' && (MANUAL_KINDS as readonly string[]).includes(v)
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export function parseBalance(v: unknown): Parsed<number> {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v)
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return { ok: false, error: 'Escribe un saldo' }
  if (n < 0) return { ok: false, error: 'El saldo no puede ser negativo' }
  if (n > MAX_BALANCE) return { ok: false, error: 'Ese saldo es demasiado grande' }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

function parseText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ')
  return t ? t.slice(0, max) : null
}

export function parseNewSource(body: unknown): Parsed<{ kind: ManualKind; name: string; institution: string | null; balance: number }> {
  const b = (body ?? {}) as Record<string, unknown>
  if (!isManualKind(b.kind)) return { ok: false, error: 'Elige un tipo' }
  const name = parseText(b.name, 60)
  if (!name) return { ok: false, error: 'Ponle un nombre' }
  const bal = parseBalance(b.balance)
  if (!bal.ok) return bal
  return { ok: true, value: { kind: b.kind, name, institution: parseText(b.institution, 60), balance: bal.value } }
}

export function parseSourceUpdate(body: unknown): Parsed<{ name?: string; institution?: string | null; balance?: number; archive?: boolean }> {
  const b = (body ?? {}) as Record<string, unknown>
  const out: { name?: string; institution?: string | null; balance?: number; archive?: boolean } = {}
  if (b.name !== undefined) {
    const name = parseText(b.name, 60)
    if (!name) return { ok: false, error: 'Ponle un nombre' }
    out.name = name
  }
  if (b.institution !== undefined) out.institution = parseText(b.institution, 60)
  if (b.balance !== undefined) {
    const bal = parseBalance(b.balance)
    if (!bal.ok) return bal
    out.balance = bal.value
  }
  if (b.archive === true) out.archive = true
  if (Object.keys(out).length === 0) return { ok: false, error: 'Nada que cambiar' }
  return { ok: true, value: out }
}
