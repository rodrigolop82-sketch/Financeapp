import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'

// Acciones sobre un reto activo: abandonar o marcar "Ya los revisé".
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const body = (await request.json().catch(() => ({}))) as { action?: unknown }

  const { data: row } = await ctx.admin
    .from('user_challenges')
    .select('id, status, result')
    .eq('id', params.id)
    .eq('household_id', ctx.householdId)
    .maybeSingle()
  if (!row || row.status !== 'active') return NextResponse.json({ error: 'Ese reto ya no está activo' }, { status: 404 })

  const now = new Date().toISOString()
  if (body.action === 'abandon') {
    const { error } = await ctx.admin.from('user_challenges').update({ status: 'abandoned', updated_at: now }).eq('id', row.id)
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'reviewed') {
    const result = { ...((row.result as Record<string, unknown> | null) ?? {}), reviewed: true }
    const { error } = await ctx.admin.from('user_challenges').update({ result, updated_at: now }).eq('id', row.id)
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
