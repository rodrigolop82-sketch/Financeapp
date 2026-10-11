import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { parseSourceUpdate } from '@/lib/networth/sources'
import { updateSourceBalance } from '@/lib/networth/data'

// Editar nombre/institución, actualizar el saldo, archivar o restaurar.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null

  const { data: row } = await ctx.admin.from('financial_sources').select('id, archived_at').eq('id', params.id).eq('household_id', ctx.householdId).maybeSingle()
  if (!row) return NextResponse.json({ error: 'No encontramos esa fuente' }, { status: 404 })

  if (body?.restore === true) {
    const { error } = await ctx.admin.from('financial_sources').update({ archived_at: null, updated_at: new Date().toISOString() }).eq('id', row.id)
    return error ? NextResponse.json({ error: 'No se pudo restaurar' }, { status: 500 }) : NextResponse.json({ ok: true })
  }

  const parsed = parseSourceUpdate(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  if (row.archived_at) return NextResponse.json({ error: 'Esa fuente está archivada' }, { status: 409 })

  const now = new Date().toISOString()
  if (v.name !== undefined || v.institution !== undefined) {
    const patch: Record<string, unknown> = { updated_at: now }
    if (v.name !== undefined) patch.name = v.name
    if (v.institution !== undefined) patch.institution = v.institution
    const { error } = await ctx.admin.from('financial_sources').update(patch).eq('id', row.id)
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  if (v.balance !== undefined && !(await updateSourceBalance(ctx.admin, ctx.householdId, row.id, v.balance))) {
    return NextResponse.json({ error: 'No se pudo actualizar el saldo' }, { status: 500 })
  }
  if (v.archive) {
    // El historial se conserva: solo deja de contar desde hoy.
    const { error } = await ctx.admin.from('financial_sources').update({ archived_at: now, updated_at: now }).eq('id', row.id)
    if (error) return NextResponse.json({ error: 'No se pudo archivar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
