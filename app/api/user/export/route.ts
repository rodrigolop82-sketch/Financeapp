import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logAuditEvent } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const userId = user.id

  const results = await Promise.all([
    supabase.from('transactions').select('id, amount, description, category_id, date, source, note, created_at').order('date', { ascending: false }),
    supabase.from('financial_goals').select('id, name, emoji, target_amount, current_amount, monthly_contribution, target_date, goal_type, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('goal_contributions').select('id, goal_id, amount, note, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('chat_messages').select('id, role, content, model_used, input_mode, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('debts').select('id, name, type, balance, interest_rate, min_payment, due_day, is_paid, created_at').order('created_at', { ascending: false }),
    supabase.from('action_plans').select('id, month, steps, completed_steps, generated_by, created_at').order('created_at', { ascending: false }),
  ])

  // Una tabla que falla no puede salir como lista vacía: la persona creería
  // que su exportación está completa.
  const TABLES = ['transactions', 'financial_goals', 'goal_contributions', 'chat_messages', 'debts', 'action_plans']
  const failed = results.findIndex((r) => r.error)
  if (failed !== -1) {
    console.error('[export] No se pudo leer una tabla', TABLES[failed], results[failed].error?.message)
    return NextResponse.json({ error: 'No pudimos exportar tus datos. Intenta de nuevo.' }, { status: 500 })
  }
  const [transactions, goals, goalContributions, chatMessages, debts, actionPlans] = results.map((r) => r.data ?? [])

  await logAuditEvent(supabase, userId, 'data_export')

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    data: {
      transactions,
      goals,
      goal_contributions: goalContributions,
      chat_messages: chatMessages,
      debts,
      action_plans: actionPlans,
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
