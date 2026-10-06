import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminClient } from '@/lib/billing/server'
import { getEffectivePlan } from '@/lib/plans'
import { loadPagos } from '@/lib/pagos-data'
import { paidCopy, pagosSummary } from '@/lib/pagos'
import { longMonth } from '@/lib/como-te-fue'
import { localToday } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { firstName } from '@/lib/hogar'
import { sendPushToUser } from '@/lib/push-send'

// Marcar un pago del mes como pagado (y, si se pide, registrar el gasto).
// Si el pago avisa al otro, le llega "Ana pagó la renta ✓".
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { kind?: string; id?: string; paidBy?: string | null; register?: boolean }
  if ((body.kind !== 'bill' && body.kind !== 'debt') || !body.id) return NextResponse.json({ error: 'Pago no válido' }, { status: 400 })

  const plan = await getEffectivePlan(user.id)
  if (!plan.householdId) return NextResponse.json({ error: 'Sin hogar' }, { status: 404 })
  if (plan.access !== 'full') return NextResponse.json({ error: 'Estás en modo solo ver' }, { status: 403 })

  const month = localToday().slice(0, 7)
  const items = await loadPagos(supabase, plan.householdId, month)
  const pago = items.find((p) => p.kind === body.kind && p.id === body.id)
  if (!pago) return NextResponse.json({ error: 'No encontramos ese pago' }, { status: 404 })
  if (pago.paid) return NextResponse.json({ ok: true, already: true })

  const paidBy = body.paidBy || user.id
  let transactionId: string | null = null
  if (body.register && pago.amount > 0) {
    const { data: tx, error } = await supabase.from('transactions').insert({
      household_id: plan.householdId,
      category_id: pago.categoryId,
      amount: pago.amount,
      description: pago.name,
      date: localToday(),
      source: 'manual',
      type: 'expense',
      transaction_type: pago.kind === 'debt' ? 'ahorro' : 'gasto',
      payment_method: pago.kind === 'debt' ? 'transferencia' : 'efectivo',
      created_by: user.id,
      paid_by: paidBy,
    }).select('id').single()
    if (error) return NextResponse.json({ error: 'No se pudo registrar el gasto' }, { status: 500 })
    transactionId = tx.id
  }

  const { error } = await supabase.from('bill_payments').insert({
    household_id: plan.householdId,
    month: `${month}-01`,
    paid_by: paidBy,
    transaction_id: transactionId,
    ...(pago.kind === 'bill' ? { bill_id: pago.id } : { debt_id: pago.id }),
  })
  if (error) {
    if (transactionId) await supabase.from('transactions').delete().eq('id', transactionId)
    return NextResponse.json({ error: 'No se pudo marcar como pagado' }, { status: 500 })
  }

  // Avisar al otro (o a los demás) del hogar.
  if (pago.notifyOther) {
    const admin = adminClient()
    const { data: members } = await admin.from('household_members').select('user_id, users(full_name, email)').eq('household_id', plan.householdId)
    type M = { user_id: string; users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null }
    const rows = (members ?? []) as M[]
    const payer = rows.find((m) => m.user_id === paidBy)
    const pu = payer ? (Array.isArray(payer.users) ? payer.users[0] : payer.users) : null
    const { paid, total } = pagosSummary(items.map((p) => (p === pago ? { ...p, paid: { by: paidBy, at: new Date().toISOString(), transactionId } } : p)))
    const copy = paidCopy(firstName(pu?.full_name, pu?.email), pago, paid, total, longMonth(month), (n) => formatMoney(n))
    await Promise.all(rows.filter((m) => m.user_id !== paidBy && m.user_id !== user.id).map((m) =>
      sendPushToUser(m.user_id, { ...copy, url: '/plan/pagos', tag: `bill-paid-${pago.id}`, key: `bill-paid:${pago.id}:${month}` }, 'bill').catch(() => 0)))
  }

  return NextResponse.json({ ok: true, transactionId })
}

// Deshacer "pagado" de este mes (borra también el gasto que se registró).
export async function DELETE(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { kind?: string; id?: string }
  if ((body.kind !== 'bill' && body.kind !== 'debt') || !body.id) return NextResponse.json({ error: 'Pago no válido' }, { status: 400 })

  const month = `${localToday().slice(0, 7)}-01`
  const col = body.kind === 'bill' ? 'bill_id' : 'debt_id'
  const { data: rows } = await supabase.from('bill_payments').select('id, transaction_id').eq(col, body.id).eq('month', month)
  for (const r of rows ?? []) {
    await supabase.from('bill_payments').delete().eq('id', r.id)
    if (r.transaction_id) await supabase.from('transactions').delete().eq('id', r.transaction_id)
  }
  return NextResponse.json({ ok: true })
}
