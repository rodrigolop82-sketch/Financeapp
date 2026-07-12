import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logAuditEvent } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const userId = user.id

  const [
    { data: transactions },
    { data: goals },
    { data: goalContributions },
    { data: chatMessages },
    { data: debts },
    { data: actionPlans },
  ] = await Promise.all([
    supabase.from('transactions').select('id, amount, description, category_id, date, source, note, created_at').order('date', { ascending: false }),
    supabase.from('financial_goals').select('id, name, emoji, target_amount, current_amount, monthly_contribution, target_date, goal_type, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('goal_contributions').select('id, goal_id, amount, note, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('chat_messages').select('id, role, content, model_used, input_mode, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('debts').select('id, name, type, balance, interest_rate, minimum_payment, created_at').order('created_at', { ascending: false }),
    supabase.from('action_plans').select('id, plan_data, created_at').order('created_at', { ascending: false }),
  ])

  await logAuditEvent(supabase, userId, 'data_export')

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    data: {
      transactions: transactions ?? [],
      goals: goals ?? [],
      goal_contributions: goalContributions ?? [],
      chat_messages: chatMessages ?? [],
      debts: debts ?? [],
      action_plans: actionPlans ?? [],
    },
  }

  const today = new Date().toISOString().slice(0, 10)

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="zafi-export-${today}.json"`,
    },
  })
}
