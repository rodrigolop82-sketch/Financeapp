// Pagos del mes con responsable: estado, orden, recordatorios y textos.
// Sin React, para probarlo con vitest.

import { dueDateIn } from './avisos'

export type PagoKind = 'bill' | 'debt'

export interface Pago {
  kind: PagoKind
  id: string
  emoji: string
  name: string
  amount: number
  approx: boolean
  dueDay: number
  /** null = cualquiera de los dos. */
  responsibleId: string | null
  remind3d: boolean
  remind0d: boolean
  notifyOther: boolean
  categoryId: string | null
  /** "pago mínimo" en deudas. */
  note?: string
  /** De dónde viene ("Deudas"). */
  source?: string
  paid: { by: string | null; at: string; transactionId: string | null } | null
}

export type PagoStatus = 'paid' | 'late' | 'today' | 'soon' | 'later'

/** `today` es YYYY-MM-DD; el mes del pago es el de `today`. */
export function pagoStatus(p: Pago, today: string): { status: PagoStatus; days: number } {
  const due = dueDateIn(today.slice(0, 7), p.dueDay)
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000)
  if (p.paid) return { status: 'paid', days }
  if (days < 0) return { status: 'late', days }
  if (days === 0) return { status: 'today', days }
  if (days <= 3) return { status: 'soon', days }
  return { status: 'later', days }
}

/** Por pagar: atrasados primero, luego por día de pago. */
export function sortPending(list: Pago[], today: string): Pago[] {
  return list
    .filter((p) => !p.paid)
    .sort((a, b) => {
      const la = pagoStatus(a, today).status === 'late' ? 0 : 1
      const lb = pagoStatus(b, today).status === 'late' ? 0 : 1
      return la - lb || a.dueDay - b.dueDay || a.name.localeCompare(b.name)
    })
}

export function pagosSummary(list: Pago[]): { paid: number; total: number; pending: number } {
  const paid = list.filter((p) => p.paid).length
  return { paid, total: list.length, pending: list.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0) }
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** "jueves 8" para el próximo pago. */
export function dueWeekday(p: Pago, today: string): string {
  const d = new Date(dueDateIn(today.slice(0, 7), p.dueDay) + 'T12:00:00')
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`
}

/** "6 oct" para "Pagó Ana el 6 oct". */
export function shortDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

/** Badge del estado (o null si falta más de 3 días). */
export function statusBadge(p: Pago, today: string): { text: string; tone: 'danger' | 'warn' | 'ok' } | null {
  const { status, days } = pagoStatus(p, today)
  if (status === 'paid') return { text: 'Pagado', tone: 'ok' }
  if (status === 'late') return { text: 'Atrasado', tone: 'danger' }
  if (status === 'today') return { text: 'Hoy', tone: 'warn' }
  if (status === 'soon') return { text: `En ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'warn' }
  return null
}

export interface Reminder { pago: Pago; to: string[]; when: '3d' | '0d' }

/**
 * Recordatorios de hoy: 3 días antes y el día que vence, al responsable (o a
 * los dos si es "cualquiera"). Solo pagos sin pagar.
 */
export function remindersFor(list: Pago[], today: string, people: string[]): Reminder[] {
  const out: Reminder[] = []
  for (const p of list) {
    if (p.paid) continue
    const { days } = pagoStatus(p, today)
    const when = days === 3 && p.remind3d ? '3d' : days === 0 && p.remind0d ? '0d' : null
    if (!when) continue
    const to = p.responsibleId ? [p.responsibleId] : people
    if (to.length) out.push({ pago: p, to, when })
  }
  return out
}

/** Texto del push de recordatorio: "Luis, la Tarjeta Visa vence el jueves". */
export function reminderCopy(r: Reminder, name: string, today: string, fmt: (n: number) => string): { title: string; body: string } {
  const day = r.when === '0d' ? 'hoy' : `el ${dueWeekday(r.pago, today).split(' ')[0]}`
  const amount = `${r.pago.approx ? '≈ ' : ''}${fmt(r.pago.amount)}`
  return {
    title: `${name}, ${r.pago.name} vence ${day}`,
    body: `${r.pago.note ? `${r.pago.note.charAt(0).toUpperCase()}${r.pago.note.slice(1)} ` : ''}${amount}. Toca para marcarlo como pagado.`,
  }
}

/** "Ana pagó la renta ✓" / "Q 3,500 · Ya van 2 de 6 pagos de octubre." */
export function paidCopy(payer: string, p: Pago, done: number, total: number, monthName: string, fmt: (n: number) => string): { title: string; body: string } {
  return {
    title: `${payer} pagó ${p.name} ✓`,
    body: `${fmt(p.amount)} · Ya van ${done} de ${total} pagos de ${monthName}.`,
  }
}
