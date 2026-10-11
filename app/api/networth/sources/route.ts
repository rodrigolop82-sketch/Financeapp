import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { parseNewSource } from '@/lib/networth/sources'

// Agregar una fuente con su saldo (y su primer registro histórico).
export async function POST(request: Request) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const parsed = parseNewSource(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  const now = new Date().toISOString()
  const { data, error } = await ctx.admin.from('financial_sources').insert({
    household_id: ctx.householdId, kind: v.kind, name: v.name, institution: v.institution,
    current_balance: v.balance, balance_updated_at: now, created_by: ctx.userId,
  }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo agregar la fuente' }, { status: 500 })
  const { error: snapErr } = await ctx.admin.from('source_balance_snapshots').insert({
    household_id: ctx.householdId, source_id: data.id, balance: v.balance, recorded_at: now, origin: 'manual',
  })
  if (snapErr) {
    await ctx.admin.from('financial_sources').delete().eq('id', data.id)
    return NextResponse.json({ error: 'No se pudo agregar la fuente' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id })
}
