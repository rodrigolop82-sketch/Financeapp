import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { parseSourceUpdate } from '@/lib/networth/sources'
import { getVisibleSource, updateSourceBalance } from '@/lib/networth/data'

// Editar una cuenta propia o compartida: datos, saldo, compartir, cierre de
// mes, vínculo con su deuda, archivar o restaurar.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx

  const row = await getVisibleSource(ctx.admin, ctx.householdId, ctx.userId, params.id)
  if (!row) return NextResponse.json({ error: 'No encontramos esa cuenta' }, { status: 404 })

  const parsed = parseSourceUpdate(await request.json().catch(() => null), row.kind)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  const now = new Date().toISOString()

  if (v.restore) {
    const { error } = await ctx.admin.from('financial_sources').update({ archived_at: null, updated_at: now }).eq('id', row.id)
    return error ? NextResponse.json({ error: 'No se pudo restaurar' }, { status: 500 }) : NextResponse.json({ ok: true })
  }
  if (row.archived_at) return NextResponse.json({ error: 'Esa cuenta está archivada' }, { status: 409 })
  // Solo quien la creó decide si se comparte.
  if (v.shared !== undefined && row.owner_user_id && row.owner_user_id !== ctx.userId) {
    return NextResponse.json({ error: 'Solo quien agregó la cuenta puede cambiar si se comparte' }, { status: 403 })
  }
  if (v.debtId) {
    const { data: debt } = await ctx.admin.from('debts').select('id').eq('id', v.debtId).eq('household_id', ctx.householdId).maybeSingle()
    if (!debt) return NextResponse.json({ error: 'Esa deuda no es de tu hogar' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (v.name !== undefined) patch.name = v.name
  if (v.institution !== undefined) patch.institution = v.institution
  if (v.shared !== undefined) patch.shared = v.shared
  if (v.tracksStatements !== undefined) patch.tracks_statements = v.tracksStatements
  if (v.last4 !== undefined) patch.last4 = v.last4
  if (v.debtId !== undefined) patch.debt_id = v.debtId
  if (Object.keys(patch).length > 0) {
    const { error } = await ctx.admin.from('financial_sources').update({ ...patch, updated_at: now }).eq('id', row.id)
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
