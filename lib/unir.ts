// Unir dos cuentas: lo que se calcula antes de unir (repetidos, plan del mes
// combinado, metas parecidas). Sin React ni Supabase, para probarlo.

import { getMerchantKey } from './transactions/merchant-key'

export function normName(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export interface PreviewTx { id: string; date: string; amount: number; description: string | null; type: string }

export interface Duplicate { guestId: string; hostId: string; name: string; amount: number; date: string }

/** Mismo día, monto y comercio en los dos hogares. Cada movimiento se usa una vez. */
export function findDuplicates(host: PreviewTx[], guest: PreviewTx[]): Duplicate[] {
  const key = (t: PreviewTx) => `${t.date}|${Math.round(Number(t.amount) * 100)}|${t.type}|${getMerchantKey(t.description) ?? ''}`
  const pool = new Map<string, PreviewTx[]>()
  for (const t of host) {
    if (!getMerchantKey(t.description)) continue
    const k = key(t)
    pool.set(k, [...(pool.get(k) ?? []), t])
  }
  const out: Duplicate[] = []
  for (const t of guest) {
    if (!getMerchantKey(t.description)) continue
    const list = pool.get(key(t))
    const hit = list?.shift()
    if (hit) out.push({ guestId: t.id, hostId: hit.id, name: t.description ?? '', amount: Number(t.amount), date: t.date })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export interface PreviewCat { id: string; name: string; bucket: string; icon?: string | null; budgeted_amount: number | null; parent_category_id?: string | null }

export type BudgetPick = 'sum' | 'host' | 'guest'

export interface PlanRow {
  /** Categoría del invitado (clave de choices.budget), o null si solo la tiene el hogar. */
  guestId: string | null
  hostId: string | null
  name: string
  icon: string | null
  host: number
  guest: number
  /** Montos parecidos en Vivienda o Servicios: quizá la registraron los dos. */
  looksSame: boolean
  pick: BudgetPick
}

const SAME_CHECK = ['vivienda', 'servicios']

export function looksSame(name: string, a: number, b: number): boolean {
  if (!(a > 0 && b > 0)) return false
  if (!SAME_CHECK.some((p) => normName(name).startsWith(p))) return false
  return Math.abs(a - b) <= 0.1 * Math.max(a, b)
}

/** Plan del mes de los dos por categoría (gastos), como lo junta merge_households. */
export function planRows(host: PreviewCat[], guest: PreviewCat[]): PlanRow[] {
  const rows: PlanRow[] = []
  const used = new Set<string>()
  for (const g of guest) {
    if (g.bucket === 'income') continue
    const h = host.find((c) => c.bucket === g.bucket && normName(c.name) === normName(g.name))
    if (h) used.add(h.id)
    const hv = Number(h?.budgeted_amount) || 0
    const gv = Number(g.budgeted_amount) || 0
    if (hv <= 0 && gv <= 0) continue
    const same = looksSame(g.name, hv, gv)
    rows.push({ guestId: g.id, hostId: h?.id ?? null, name: h?.name ?? g.name, icon: h?.icon ?? g.icon ?? null, host: hv, guest: gv, looksSame: same, pick: same ? 'host' : 'sum' })
  }
  for (const h of host) {
    if (h.bucket === 'income' || used.has(h.id) || !(Number(h.budgeted_amount) > 0)) continue
    rows.push({ guestId: null, hostId: h.id, name: h.name, icon: h.icon ?? null, host: Number(h.budgeted_amount) || 0, guest: 0, looksSame: false, pick: 'host' })
  }
  return rows.sort((a, b) => b.host + b.guest - (a.host + a.guest))
}

export function rowValue(r: PlanRow, pick: BudgetPick = r.pick): number {
  if (!r.hostId || !r.guestId) return r.host + r.guest
  return pick === 'sum' ? r.host + r.guest : pick === 'host' ? r.host : r.guest
}

export interface PreviewGoal { id: string; name: string; current_amount: number; goal_type?: string | null; emoji?: string | null }

/** Meta del hogar con la que se podría unir (nombre igual o contenido, o ambas de emergencia). */
export function similarGoal(g: PreviewGoal, host: PreviewGoal[]): PreviewGoal | null {
  const n = normName(g.name)
  return host.find((h) => {
    const m = normName(h.name)
    return m === n || (n.length >= 4 && m.includes(n)) || (m.length >= 4 && n.includes(m))
      || (g.goal_type === 'emergency_fund' && h.goal_type === 'emergency_fund')
  }) ?? null
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "Agosto y septiembre" / "De marzo a septiembre" / "Septiembre". */
export function monthsSpan(dates: string[]): string {
  if (dates.length === 0) return ''
  const sorted = [...dates].sort()
  const first = sorted[0].slice(0, 7)
  const last = sorted[sorted.length - 1].slice(0, 7)
  const name = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1]
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (first === last) return cap(name(first))
  const y1 = first.slice(0, 4)
  const y2 = last.slice(0, 4)
  const months = (Number(y2) - Number(y1)) * 12 + Number(last.slice(5, 7)) - Number(first.slice(5, 7))
  const label = (m: string) => (y1 !== y2 ? `${name(m)} ${m.slice(0, 4)}` : name(m))
  return months === 1 ? `${cap(label(first))} y ${label(last)}` : `De ${label(first)} a ${label(last)}`
}

/** Mensaje para el error de merge_households. */
export function mergeErrorText(code: string, ownerName: string): string {
  switch (code) {
    case 'invite_invalid': return 'Esta invitación ya no sirve. Pídele a ' + ownerName + ' un link nuevo.'
    case 'own_household': return 'Este es tu propio hogar.'
    case 'already_member': return 'Ya eres parte de este hogar.'
    case 'no_seat': return 'Este hogar ya tiene a sus 2 personas.'
    case 'already_in_household': return 'Ya estás en otro hogar. Sal de ese hogar antes de unirte a este.'
    case 'host_not_family': return `Para juntar sus cuentas, ${ownerName} necesita el plan Familiar. Le avisamos.`
    case 'goal_not_found': return 'Una de las metas ya no existe. Vuelve a intentarlo.'
    default: return 'No pudimos unir las cuentas. Intenta de nuevo.'
  }
}
