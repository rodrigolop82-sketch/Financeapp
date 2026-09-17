import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUserPlan } from '@/lib/plans'
import { getUsage } from '@/lib/usage'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const plan = await getUserPlan(user.id)
  const [ai, imports] = await Promise.all([
    getUsage(user.id, 'ai_message'),
    getUsage(user.id, 'statement_import'),
  ])

  return NextResponse.json({ plan, ai, imports })
}
