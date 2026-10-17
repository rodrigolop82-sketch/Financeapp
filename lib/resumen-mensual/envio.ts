// F7: datos y envío del resumen mensual por correo (solo servidor, service
// role). Usa las mismas fuentes que la app: el puntaje guardado al cerrar el
// mes (monthly_snapshots) o, si el mes no se cerró, el mismo cálculo de la
// app (loadScoreInput + calculateScore). No hay una fórmula aparte.
//
// Seguridad: el envío del cron queda apagado salvo RESUMEN_MENSUAL_ENABLED
// = 'true'. monthly_email_log (UNIQUE user_id, month) evita duplicados.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getUserHousehold } from '../household'
import { loadScoreInput } from '../health-data'
import { calculateScore } from '../score-calculator'
import { categoryPlan } from '../plan-del-mes'
import { categoriasPasadas, siguientesPasos, type DeudaPaso } from '../siguiente-paso'
import { pasoEfecto, pasoTitulo } from '../siguiente-paso/texto'
import { formatMoney, type Currency } from '../format'
import { addMonths, longMonth } from '../como-te-fue'
import { monthRange } from '../movimientos'
import { sendEmail } from '../email'
import { resumenMensualEmail, type ResumenMensualInput } from './plantilla'
import { loadDeudas } from '@/lib/deudas-data'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>

export interface ResumenUser {
  id: string
  email: string
  full_name: string | null
  currency?: string | null
  show_decimals?: boolean | null
}

export type ResumenResult = 'sent' | 'already' | 'pref_off' | 'no_data' | 'skipped' | 'error'

export function resumenMensualEnabled(): boolean {
  return process.env.RESUMEN_MENSUAL_ENABLED === 'true'
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://zafiapp.com').replace(/\/$/, '')
}

async function monthScore(admin: Admin, householdId: string, userId: string, month: string): Promise<number | null> {
  const { data } = await admin.from('monthly_snapshots').select('health_score')
    .eq('household_id', householdId).eq('month', `${month}-01`).maybeSingle()
  const saved = (data as { health_score: number | null } | null)?.health_score
  if (saved != null) return Number(saved)
  const { input } = await loadScoreInput(admin, { householdId, userId, month })
  const r = calculateScore(input)
  return r.components.length > 0 ? r.total : null
}

/** Datos del correo del mes `month` ('YYYY-MM'). null si no hay hogar. */
export async function buildResumen(admin: Admin, user: ResumenUser, month: string): Promise<ResumenMensualInput | null> {
  const household = await getUserHousehold(admin, user.id)
  if (!household) return null
  const hid = household.id
  const fmt = (n: number) => formatMoney(n, { currency: (user.currency || 'GTQ') as Currency, showDecimals: !!user.show_decimals })

  const [{ input, raw }, prevScore, debtsRes, goalsRes] = await Promise.all([
    loadScoreInput(admin, { householdId: hid, userId: user.id, month }),
    monthScore(admin, hid, user.id, addMonths(month, -1)),
    loadDeudas<DeudaPaso>(admin, hid, { columns: 'id, name, balance, interest_rate, min_payment, is_paid' }).then((data) => ({ data })),
    admin.from('financial_goals').select('id, name, emoji, target_amount, current_amount, status')
      .or(`user_id.eq.${user.id},and(shared.eq.true,household_id.eq.${hid})`),
  ])

  // 1. Salud financiera: la guardada al cerrar el mes, o la de la app.
  const { data: snap } = await admin.from('monthly_snapshots').select('health_score')
    .eq('household_id', hid).eq('month', `${month}-01`).maybeSingle()
  const savedScore = (snap as { health_score: number | null } | null)?.health_score
  const live = calculateScore(input)
  const total = savedScore != null ? Number(savedScore) : live.components.length > 0 ? live.total : null

  // 2. Presupuesto: categorías de básico y gustos con plan, y las que se pasaron.
  const over = categoriasPasadas(raw.categories, raw.subItems, raw.txs, month)
  const planned = raw.categories.filter((c) => !c.archived_at && (c.bucket === 'needs' || c.bucket === 'wants') && categoryPlan(c, raw.subItems) > 0)

  // 3. Meta principal: la activa más avanzada (como en Inicio) y lo aportado en el mes.
  type GoalRow = { id: string; name: string; emoji: string | null; target_amount: number; current_amount: number; status: string }
  const ratio = (g: GoalRow) => (Number(g.target_amount) > 0 ? Number(g.current_amount) / Number(g.target_amount) : 0)
  const goal = ((goalsRes.data ?? []) as GoalRow[])
    .filter((g) => g.status === 'active' && ratio(g) < 1)
    .sort((a, b) => ratio(b) - ratio(a))[0] ?? null
  let contributed = 0
  if (goal) {
    const { from, to } = monthRange(month)
    const { data } = await admin.from('goal_contributions').select('amount').eq('goal_id', goal.id)
      .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
    contributed = ((data ?? []) as { amount: number | string }[]).reduce((s, c) => s + Number(c.amount), 0)
  }

  // 4. Siguiente paso (F1) con los datos del mes que cerró.
  const paso = siguientesPasos(input, { debts: (debtsRes.data ?? []) as DeudaPaso[], overCategories: over })[0]

  return {
    firstName: (user.full_name || '').trim().split(/\s+/)[0] ?? '',
    monthName: longMonth(month),
    appUrl: appUrl(),
    fmt,
    score: total === null ? null : { total, prev: prevScore },
    budget: planned.length > 0
      ? { inLine: planned.length - over.length, total: planned.length, over: over.map((o) => o.name) }
      : null,
    goal: goal ? { name: goal.name, emoji: goal.emoji || '🎯', pct: Math.round(ratio(goal) * 100), contributed } : null,
    step: paso ? { title: pasoTitulo(paso, fmt), effect: pasoEfecto(paso) } : null,
  }
}

/**
 * Manda el resumen de `month` a un usuario. Respeta la preferencia y no
 * repite: primero reserva (user_id, month) en monthly_email_log; si el envío
 * falla, libera la reserva para reintentar.
 */
export async function sendResumenToUser(
  admin: Admin,
  user: ResumenUser,
  month: string,
  deps: { build?: typeof buildResumen; send?: typeof sendEmail } = {},
): Promise<ResumenResult> {
  const build = deps.build ?? buildResumen
  const send = deps.send ?? sendEmail
  const { data: pref } = await admin.from('notification_preferences').select('resumen_mensual_correo').eq('user_id', user.id).maybeSingle()
  if (!(pref as { resumen_mensual_correo?: boolean } | null)?.resumen_mensual_correo) return 'pref_off'

  const { error: claimErr } = await admin.from('monthly_email_log').insert({ user_id: user.id, month })
  if (claimErr) return claimErr.code === '23505' ? 'already' : 'error'
  const release = () => admin.from('monthly_email_log').delete().eq('user_id', user.id).eq('month', month)

  try {
    const data = await build(admin, user, month)
    if (!data) { await release(); return 'no_data' }
    const mail = resumenMensualEmail(data)
    const res = await send({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html })
    if (!res.ok) { await release(); return res.skipped ? 'skipped' : 'error' }
    return 'sent'
  } catch {
    await release()
    return 'error'
  }
}

/** Cron diario: solo el día 1 (hora de Guatemala) y solo con RESUMEN_MENSUAL_ENABLED. */
export async function sendMonthlySummaries(admin: Admin, today: string): Promise<Record<string, number> | { skipped: string }> {
  if (today.slice(8, 10) !== '01') return { skipped: 'not_day_1' }
  if (!resumenMensualEnabled()) return { skipped: 'disabled' }
  const month = addMonths(today.slice(0, 7), -1)
  const { data: prefs } = await admin.from('notification_preferences').select('user_id').eq('resumen_mensual_correo', true)
  const ids = ((prefs ?? []) as { user_id: string }[]).map((p) => p.user_id)
  const counts: Record<string, number> = {}
  for (let i = 0; i < ids.length; i += 200) {
    const { data: users } = await admin.from('users').select('id, email, full_name, currency, show_decimals').in('id', ids.slice(i, i + 200))
    for (const u of (users ?? []) as ResumenUser[]) {
      const r = await sendResumenToUser(admin, u, month)
      counts[r] = (counts[r] ?? 0) + 1
    }
  }
  return counts
}
