// Avisos del hogar que manda el cron diario: recordatorios de pagos a quien
// le toca (3 días antes y el día) y, los domingos, "Su semana en casa".
// Solo servidor (service role).

import type { SupabaseClient } from '@supabase/supabase-js'
import { getEffectivePlan } from './plans'
import { loadPagos } from './pagos-data'
import { reminderCopy, remindersFor } from './pagos'
import { firstName } from './hogar'
import { sendPushToUser } from './push-send'
import { daysInMonth } from './avisos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>
type Fmt = (n: number) => string

interface Member { user_id: string; role: string; access: string | null; name: string }

async function membersOf(admin: Admin, householdId: string): Promise<Member[]> {
  const { data } = await admin.from('household_members').select('user_id, role, access, users(full_name, email)').eq('household_id', householdId)
  type Row = { user_id: string; role: string; access: string | null; users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null }
  return ((data ?? []) as Row[]).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    return { user_id: r.user_id, role: r.role, access: r.access, name: firstName(u?.full_name, u?.email) }
  })
}

async function alreadySent(admin: Admin, userId: string, key: string): Promise<boolean> {
  const { data } = await admin.from('notification_log').select('id').eq('user_id', userId).contains('payload', { key }).limit(1)
  return !!data && data.length > 0
}

/** Hogares con pagos fijos activos o deudas con día de pago. */
async function householdsWithPagos(admin: Admin): Promise<string[]> {
  const [{ data: bills }, { data: debts }] = await Promise.all([
    admin.from('recurring_bills').select('household_id').eq('active', true),
    admin.from('debts').select('household_id').not('due_day', 'is', null).eq('is_paid', false),
  ])
  return Array.from(new Set([...(bills ?? []), ...(debts ?? [])].map((r: { household_id: string }) => r.household_id)))
}

export async function sendBillReminders(admin: Admin, today: string, fmt: Fmt): Promise<number> {
  let sent = 0
  for (const hh of await householdsWithPagos(admin)) {
    try {
      const { data: house } = await admin.from('households').select('owner_id').eq('id', hh).single()
      if (!house) continue
      // Recordatorios: Premium y Familiar (o prueba).
      const plan = await getEffectivePlan(house.owner_id)
      if (plan.plan === 'free') continue
      const members = await membersOf(admin, hh)
      const full = members.filter((m) => m.role === 'owner' || m.user_id === house.owner_id || (plan.plan === 'family' && m.access !== 'view'))
      const ids = full.length ? full.map((m) => m.user_id) : [house.owner_id]
      const pagos = await loadPagos(admin, hh, today.slice(0, 7))
      // Deudas sin responsable: del dueño.
      const withOwner = pagos.map((p) => (p.kind === 'debt' && !p.responsibleId ? { ...p, responsibleId: house.owner_id } : p))
      for (const r of remindersFor(withOwner, today, ids)) {
        for (const userId of r.to) {
          const key = `bill:${r.pago.kind}:${r.pago.id}:${today}:${r.when}`
          if (await alreadySent(admin, userId, key)) continue
          const name = members.find((m) => m.user_id === userId)?.name ?? ''
          const copy = reminderCopy(r, name, today, fmt)
          sent += await sendPushToUser(userId, { ...copy, url: '/plan/pagos', tag: `bill-${r.pago.id}`, key }, 'bill')
        }
      }
    } catch (e) {
      console.error('[cron/bills] Error con un hogar', hh, e)
    }
  }
  return sent
}

/** Domingos: "Su semana en casa · Gastaron Q X. Alimentación va 8% arriba de lo planeado." */
export async function sendWeeklySummaries(admin: Admin, today: string, fmt: Fmt): Promise<number> {
  const { data: shared } = await admin.from('household_members').select('household_id').eq('role', 'member')
  let sent = 0
  for (const hh of Array.from(new Set((shared ?? []).map((r: { household_id: string }) => r.household_id)))) {
    try {
      const { data: house } = await admin.from('households').select('owner_id').eq('id', hh).single()
      if (!house) continue
      const plan = await getEffectivePlan(house.owner_id)
      if (plan.plan !== 'family') continue

      const weekAgo = new Date(Date.parse(today + 'T12:00:00Z') - 6 * 86_400_000).toISOString().slice(0, 10)
      const month = today.slice(0, 7)
      const [{ data: week }, { data: monthTx }, { data: cats }] = await Promise.all([
        admin.from('transactions').select('amount').eq('household_id', hh).eq('type', 'expense').gte('date', weekAgo).lte('date', today),
        admin.from('transactions').select('amount, category_id, scope').eq('household_id', hh).eq('type', 'expense').gte('date', `${month}-01`).lte('date', today),
        admin.from('budget_categories').select('id, name, budgeted_amount').eq('household_id', hh),
      ])
      const spent = (week ?? []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
      if (spent <= 0) continue

      // La categoría más pasada de lo planeado a esta altura del mes.
      const elapsed = Number(today.slice(8, 10)) / daysInMonth(month)
      const byCat = new Map<string, number>()
      for (const t of (monthTx ?? []) as { amount: number; category_id: string | null; scope?: string }[]) {
        if (!t.category_id || t.scope === 'personal') continue
        byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + Number(t.amount))
      }
      let worst: { name: string; pct: number } | null = null
      for (const c of (cats ?? []) as { id: string; name: string; budgeted_amount: number | null }[]) {
        const planned = Number(c.budgeted_amount) * elapsed
        if (!(planned > 0)) continue
        const pct = Math.round(((byCat.get(c.id) ?? 0) / planned - 1) * 100)
        if (pct >= 5 && (!worst || pct > worst.pct)) worst = { name: c.name, pct }
      }
      const body = `Gastaron ${fmt(spent)}. ${worst ? `${worst.name} va ${worst.pct}% arriba de lo planeado.` : 'Van bien con el plan del mes.'}`

      for (const m of await membersOf(admin, hh)) {
        if (m.access === 'view' && m.user_id !== house.owner_id) continue
        const key = `weekly:${hh}:${today}`
        if (await alreadySent(admin, m.user_id, key)) continue
        sent += await sendPushToUser(m.user_id, { title: 'Su semana en casa', body, url: '/familia', tag: 'weekly', key }, 'weekly')
      }
    } catch (e) {
      console.error('[cron/weekly] Error con un hogar', hh, e)
    }
  }
  return sent
}
