// Carga de "Pagos del mes": pagos fijos activos + deudas con día de pago,
// con el pago de este mes si ya se hizo. Sirve con el cliente del usuario
// (RLS) o con service role (cron).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Pago } from './pagos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

const DEBT_EMOJI: Record<string, string> = { credit: '💳', loan: '🏦', informal: '🤝' }

export async function loadPagos(supabase: Client, householdId: string, month: string): Promise<Pago[]> {
  const [{ data: bills }, { data: debts }, { data: payments }] = await Promise.all([
    supabase.from('recurring_bills').select('*').eq('household_id', householdId).eq('active', true),
    supabase.from('debts').select('*').eq('household_id', householdId).not('due_day', 'is', null),
    supabase.from('bill_payments').select('*').eq('household_id', householdId).eq('month', `${month}-01`),
  ])
  type Pay = { bill_id: string | null; debt_id: string | null; paid_by: string | null; paid_at: string; transaction_id: string | null }
  const pays = (payments ?? []) as Pay[]
  const paidFor = (kind: 'bill' | 'debt', id: string) => {
    const hit = pays.find((x) => (kind === 'bill' ? x.bill_id : x.debt_id) === id)
    return hit ? { by: hit.paid_by, at: hit.paid_at, transactionId: hit.transaction_id } : null
  }

  type Bill = { id: string; name: string; emoji: string | null; amount: number; approx: boolean; due_day: number; responsible_id: string | null; remind_3d: boolean; remind_0d: boolean; notify_other: boolean; category_id: string | null }
  type Debt = { id: string; name: string; type: string; min_payment: number | null; due_day: number; is_paid: boolean | null; responsible_id?: string | null; remind_3d?: boolean; remind_0d?: boolean; notify_other?: boolean }

  const list: Pago[] = ((bills ?? []) as Bill[]).map((b) => ({
    kind: 'bill',
    id: b.id,
    emoji: b.emoji || '🧾',
    name: b.name,
    amount: Number(b.amount) || 0,
    approx: !!b.approx,
    dueDay: b.due_day,
    responsibleId: b.responsible_id,
    remind3d: b.remind_3d,
    remind0d: b.remind_0d,
    notifyOther: b.notify_other,
    categoryId: b.category_id,
    paid: paidFor('bill', b.id),
  }))

  for (const d of (debts ?? []) as Debt[]) {
    if (d.is_paid || !(Number(d.min_payment) > 0)) continue
    list.push({
      kind: 'debt',
      id: d.id,
      emoji: DEBT_EMOJI[d.type] ?? '💳',
      name: d.name,
      amount: Number(d.min_payment) || 0,
      approx: false,
      dueDay: d.due_day,
      responsibleId: d.responsible_id ?? null,
      remind3d: d.remind_3d ?? true,
      remind0d: d.remind_0d ?? true,
      notifyOther: d.notify_other ?? true,
      categoryId: null,
      note: d.type === 'credit' ? 'pago mínimo' : undefined,
      source: 'Deudas',
      paid: paidFor('debt', d.id),
    })
  }
  return list
}
