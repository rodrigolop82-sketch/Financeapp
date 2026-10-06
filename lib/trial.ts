// Fin de la prueba de 14 días: cuándo avisar y qué contar. Sin React.

export const TRIAL_DAYS = 14
/** Desde cuántos días antes del fin se avisa (día 11). */
export const TRIAL_WARN_DAYS = 3

const DAY = 86_400_000
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Días que faltan (redondeado hacia arriba) y días usados de la prueba. */
export function trialProgress(trialEndsAt: string, now: number = Date.now()): { daysLeft: number; daysUsed: number } {
  const left = Math.max(0, Math.ceil((Date.parse(trialEndsAt) - now) / DAY))
  return { daysLeft: left, daysUsed: Math.min(TRIAL_DAYS, Math.max(0, TRIAL_DAYS - left)) }
}

/** ¿Mostrar "Tu prueba termina en N días"? Solo al dueño, en prueba y sin plan pagado. */
export function shouldWarnTrial(opts: { trialEndsAt: string | null; trialActive: boolean; isOwner: boolean; paidPlan: string }, now: number = Date.now()): boolean {
  if (!opts.trialActive || !opts.trialEndsAt || !opts.isOwner || opts.paidPlan !== 'free') return false
  const { daysLeft } = trialProgress(opts.trialEndsAt, now)
  return daysLeft >= 1 && daysLeft <= TRIAL_WARN_DAYS
}

export function daysText(n: number): string {
  return `${n} ${n === 1 ? 'día' : 'días'}`
}

/** "El viernes 9 de octubre". */
export function trialEndText(trialEndsAt: string): string {
  const d = new Date(trialEndsAt)
  return `El ${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

export interface TrialSummary {
  trialEndsAt: string
  daysUsed: number
  imports: number
  importedRows: number
  /** Otra persona del hogar (null si no hay). */
  member: { name: string; expenses: number } | null
  /** % del gasto del hogar con quién lo pagó (0–100). */
  ownedSpendPct: number | null
  billsOnTime: number
  questions: number
}

export type SummaryRow = [emoji: string, name: string, help?: string]

/** "En estos N días": filas con uso real (se omiten las que están en 0). */
export function trialUsageRows(s: TrialSummary): SummaryRow[] {
  const rows: SummaryRow[] = []
  if (s.imports > 0) {
    rows.push(['📄',
      `Importaste ${s.imports} ${s.imports === 1 ? 'estado de cuenta' : 'estados de cuenta'}`,
      s.importedRows > 0 ? `${s.importedRows} movimientos sin escribir ni uno` : undefined])
  }
  if (s.member && s.member.expenses > 0) {
    rows.push(['👤',
      `${s.member.name} registró ${s.member.expenses} ${s.member.expenses === 1 ? 'gasto' : 'gastos'}`,
      s.ownedSpendPct !== null ? `El ${s.ownedSpendPct}% del gasto del hogar ya tiene quién lo pagó` : undefined])
  }
  if (s.billsOnTime > 0) {
    rows.push(['🔔', `${s.billsOnTime} ${s.billsOnTime === 1 ? 'pago a tiempo' : 'pagos a tiempo'}`, 'Cada uno recibió su recordatorio'])
  }
  if (s.questions > 0) {
    rows.push(['✨', `Le preguntaste a Zafi ${s.questions} ${s.questions === 1 ? 'vez' : 'veces'}`, 'Gratis son 15 al mes'])
  }
  return rows
}

/** "Si sigues con Gratis": lo que cambia. */
export function freeChangesRows(memberName: string | null): SummaryRow[] {
  const rows: SummaryRow[] = []
  if (memberName) rows.push(['', `${memberName} pasa a solo ver`, 'Ya no registra ni recibe sus recordatorios'])
  rows.push(['', 'Ves los últimos 3 meses'])
  rows.push(['', '2 importaciones y 15 preguntas al mes'])
  return rows
}
