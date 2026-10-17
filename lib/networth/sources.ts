// Mis cuentas: tipos, permisos y validación (puro, para vitest).
// · El saldo es opcional: una cuenta sin saldo sirve para el cierre de mes y
//   no cuenta en el patrimonio.
// · Las tarjetas de crédito no llevan saldo propio: se vinculan a su deuda de
//   Plan › Deudas, que es la que cuenta (sin doble conteo).
// · Cada cuenta es personal (de quien la creó) o compartida con el hogar.

// Las deudas (tarjetas aparte) viven solo en Plan › Deudas: "Otra deuda" ya
// no se crea como cuenta. 'loan' y 'other_liability' quedan en el tipo solo
// para leer filas viejas (la migración 20261104 las pasa a debts).
export const SOURCE_KINDS = [
  'bank_account', 'credit_card', 'cash', 'investment', 'vehicle', 'real_estate', 'other_asset',
] as const
export type SourceKind = (typeof SOURCE_KINDS)[number] | 'loan' | 'other_liability'

/** Mi patrimonio › Agregar deuda: abre la hoja de Plan › Deudas como "Informal". */
export const NUEVA_DEUDA_HREF = '/plan?s=deudas&nueva=1&tipo=informal'

export const KIND_LABEL: Record<SourceKind, string> = {
  bank_account: 'Cuenta bancaria',
  credit_card: 'Tarjeta de crédito',
  cash: 'Efectivo',
  investment: 'Inversión',
  vehicle: 'Vehículo',
  real_estate: 'Inmueble',
  other_asset: 'Otro activo',
  loan: 'Préstamo',
  other_liability: 'Otra deuda',
}

export const KIND_EMOJI: Record<SourceKind, string> = {
  bank_account: '🏦', credit_card: '💳', cash: '💵', investment: '📈', vehicle: '🚗', real_estate: '🏠', other_asset: '💎',
  loan: '🧾', other_liability: '🧾',
}

/** Tipos con estado de cuenta mensual (entran al cierre de mes por defecto). */
export function hasStatements(kind: SourceKind): boolean {
  return kind === 'bank_account' || kind === 'credit_card'
}

/** Tipos que se ven en Mis cuentas: los que tienen movimientos. El resto
 * (efectivo, inversiones, bienes y otras deudas) vive solo en Mi patrimonio. */
export const ACCOUNT_KINDS = ['bank_account', 'credit_card'] as const

export function isAccountKind(kind: SourceKind): boolean {
  return (ACCOUNT_KINDS as readonly string[]).includes(kind)
}

/** Tipos de activo entre los que se puede cambiar una cuenta ya creada. */
export const ASSET_KINDS = ['bank_account', 'cash', 'investment', 'vehicle', 'real_estate', 'other_asset'] as const

function isAssetKind(v: unknown): v is (typeof ASSET_KINDS)[number] {
  return typeof v === 'string' && (ASSET_KINDS as readonly string[]).includes(v)
}

export const MAX_BALANCE = 1_000_000_000

export function isSourceKind(v: unknown): v is (typeof SOURCE_KINDS)[number] {
  return typeof v === 'string' && (SOURCE_KINDS as readonly string[]).includes(v)
}

/** ¿Puede ver la cuenta? (además de ser del hogar) */
export function canSeeSource(row: { owner_user_id: string | null; shared: boolean }, userId: string): boolean {
  return row.shared || !row.owner_user_id || row.owner_user_id === userId
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

function parseLast4(v: unknown): Parsed<string | null> {
  if (v === undefined || v === null || v === '') return { ok: true, value: null }
  const d = String(v).replace(/\D/g, '')
  return d.length === 4 ? { ok: true, value: d } : { ok: false, error: 'Los últimos 4 dígitos son 4 números' }
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === ''

export interface NewSource {
  kind: (typeof SOURCE_KINDS)[number]
  name: string
  institution: string | null
  balance: number | null
  shared: boolean
  tracksStatements: boolean
  last4: string | null
  debtId: string | null
}

export function parseNewSource(body: unknown): Parsed<NewSource> {
  const b = (body ?? {}) as Record<string, unknown>
  if (!isSourceKind(b.kind)) return { ok: false, error: 'Elige un tipo' }
  const name = parseText(b.name, 60)
  if (!name) return { ok: false, error: 'Ponle un nombre' }
  let balance: number | null = null
  if (b.kind === 'credit_card') {
    if (!isEmpty(b.balance)) return { ok: false, error: 'El saldo de una tarjeta se toma de su deuda en Plan › Deudas' }
  } else if (!isEmpty(b.balance)) {
    const bal = parseBalance(b.balance)
    if (!bal.ok) return bal
    balance = bal.value
  }
  const last4 = parseLast4(b.last4)
  if (!last4.ok) return last4
  const debtId = b.kind === 'credit_card' && typeof b.debtId === 'string' && b.debtId ? b.debtId : null
  return {
    ok: true,
    value: {
      kind: b.kind,
      name,
      institution: parseText(b.institution, 60),
      balance,
      shared: b.shared === true,
      tracksStatements: typeof b.tracksStatements === 'boolean' ? b.tracksStatements : hasStatements(b.kind),
      last4: last4.value,
      debtId,
    },
  }
}

export interface SourceUpdate {
  kind?: (typeof ASSET_KINDS)[number]
  name?: string
  institution?: string | null
  balance?: number
  shared?: boolean
  tracksStatements?: boolean
  last4?: string | null
  debtId?: string | null
  archive?: boolean
  restore?: boolean
}

export function parseSourceUpdate(body: unknown, kind: SourceKind): Parsed<SourceUpdate> {
  const b = (body ?? {}) as Record<string, unknown>
  const out: SourceUpdate = {}
  if (b.kind !== undefined && b.kind !== kind) {
    if (!isAssetKind(kind) || !isAssetKind(b.kind)) return { ok: false, error: 'Solo los activos pueden cambiar de tipo' }
    out.kind = b.kind
  }
  if (b.name !== undefined) {
    const name = parseText(b.name, 60)
    if (!name) return { ok: false, error: 'Ponle un nombre' }
    out.name = name
  }
  if (b.institution !== undefined) out.institution = parseText(b.institution, 60)
  if (b.balance !== undefined) {
    if (kind === 'credit_card') return { ok: false, error: 'El saldo de una tarjeta se toma de su deuda en Plan › Deudas' }
    const bal = parseBalance(b.balance)
    if (!bal.ok) return bal
    out.balance = bal.value
  }
  if (typeof b.shared === 'boolean') out.shared = b.shared
  if (typeof b.tracksStatements === 'boolean') out.tracksStatements = b.tracksStatements
  if (b.last4 !== undefined) {
    const l = parseLast4(b.last4)
    if (!l.ok) return l
    out.last4 = l.value
  }
  if (b.debtId !== undefined) {
    if (kind !== 'credit_card') return { ok: false, error: 'Solo las tarjetas se vinculan con una deuda' }
    out.debtId = typeof b.debtId === 'string' && b.debtId ? b.debtId : null
  }
  if (b.archive === true) out.archive = true
  if (b.restore === true) out.restore = true
  if (Object.keys(out).length === 0) return { ok: false, error: 'Nada que cambiar' }
  return { ok: true, value: out }
}
