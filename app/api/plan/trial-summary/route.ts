import { NextResponse } from 'next/server'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { getEffectivePlan } from '@/lib/plans'
import { TRIAL_DAYS, trialProgress, type TrialSummary } from '@/lib/trial'
import { dueDateIn } from '@/lib/avisos'

// Uso real durante la prueba, para "Tu prueba termina en N días".
export async function GET() {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const plan = await getEffectivePlan(user.id)
  if (!plan.isOwner || !plan.trialEndsAt) return NextResponse.json({ error: 'Sin prueba' }, { status: 404 })

  const admin = adminClient()
  const since = new Date(Date.parse(plan.trialEndsAt) - TRIAL_DAYS * 86_400_000).toISOString()
  const hh = plan.householdId

  const [imports, questions, members, txs] = await Promise.all([
    hh
      ? admin.from('statement_imports').select('transactions_imported').eq('household_id', hh).eq('status', 'completed').gte('created_at', since)
      : Promise.resolve({ data: [] as { transactions_imported: number | null }[] }),
    admin.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('role', 'user').gte('created_at', since),
    hh
      ? admin.from('household_members').select('user_id, role, users(full_name, email)').eq('household_id', hh)
      : Promise.resolve({ data: [] }),
    hh
      ? admin.from('transactions').select('created_by, amount, source').eq('household_id', hh).eq('type', 'expense').gte('created_at', since)
      : Promise.resolve({ data: [] as { created_by: string | null; amount: number; source: string | null }[] }),
  ])

  type M = { user_id: string; role: string; users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null }
  const other = ((members.data ?? []) as M[]).find((m) => m.role !== 'owner' && m.user_id !== user.id)
  const otherUser = other ? (Array.isArray(other.users) ? other.users[0] : other.users) : null
  const rows = (txs.data ?? []) as { created_by: string | null; amount: number; source: string | null }[]
  const total = rows.reduce((s, t) => s + Number(t.amount), 0)
  const owned = rows.filter((t) => t.created_by).reduce((s, t) => s + Number(t.amount), 0)
  const importRows = (imports.data ?? []) as { transactions_imported: number | null }[]

  const summary: TrialSummary = {
    trialEndsAt: plan.trialEndsAt,
    daysUsed: trialProgress(plan.trialEndsAt).daysUsed,
    imports: importRows.length,
    importedRows: importRows.reduce((n, r) => n + (r.transactions_imported ?? 0), 0),
    member: other
      ? {
          name: (otherUser?.full_name || otherUser?.email?.split('@')[0] || 'Tu pareja').split(' ')[0],
          expenses: rows.filter((t) => t.created_by === other.user_id).length,
        }
      : null,
    ownedSpendPct: other && total > 0 ? Math.round((owned / total) * 100) : null,
    billsOnTime: hh ? await billsPaidOnTime(admin, hh, since) : 0,
    questions: questions.count ?? 0,
  }
  return NextResponse.json(summary)
}

/** Pagos del mes marcados como pagados a más tardar el día que vencían. */
async function billsPaidOnTime(admin: ReturnType<typeof adminClient>, householdId: string, since: string): Promise<number> {
  const { data: pays, error } = await admin
    .from('bill_payments')
    .select('bill_id, debt_id, month, paid_at')
    .eq('household_id', householdId)
    .gte('paid_at', since)
  if (error || !pays?.length) return 0
  const [{ data: bills }, { data: debts }] = await Promise.all([
    admin.from('recurring_bills').select('id, due_day').eq('household_id', householdId),
    admin.from('debts').select('id, due_day').eq('household_id', householdId),
  ])
  const day = new Map<string, number>([...(bills ?? []), ...(debts ?? [])].map((r: { id: string; due_day: number | null }) => [r.id, r.due_day ?? 31]))
  return (pays as { bill_id: string | null; debt_id: string | null; month: string; paid_at: string }[]).filter((p) => {
    const due = dueDateIn(p.month.slice(0, 7), day.get((p.bill_id ?? p.debt_id)!) ?? 31)
    return p.paid_at.slice(0, 10) <= due
  }).length
}
