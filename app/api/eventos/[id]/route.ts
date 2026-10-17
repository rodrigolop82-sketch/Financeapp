import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { isPremium } from '@/lib/plans'
import { puedeCrearEvento } from '@/lib/eventos'

export const dynamic = 'force-dynamic'

// Terminar (archivar) o reactivar un evento: { archivado: boolean }.
// Reactivar cuenta como un evento activo más (límite de Gratis).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const body = await request.json().catch(() => null) as { archivado?: unknown } | null
  if (typeof body?.archivado !== 'boolean') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { data: ev } = await ctx.admin.from('eventos').select('id, archived_at')
    .eq('id', params.id).eq('household_id', ctx.householdId).maybeSingle()
  if (!ev) return NextResponse.json({ error: 'No encontramos ese evento' }, { status: 404 })

  if (!body.archivado && ev.archived_at) {
    const { count } = await ctx.admin.from('eventos').select('id', { count: 'exact', head: true })
      .eq('household_id', ctx.householdId).is('archived_at', null)
    if (!puedeCrearEvento(isPremium(ctx.plan.plan), count ?? 0)) {
      return NextResponse.json({ error: 'limite', limit: true }, { status: 402 })
    }
  }
  const now = new Date().toISOString()
  const { error } = await ctx.admin.from('eventos')
    .update({ archived_at: body.archivado ? (ev.archived_at ?? now) : null, updated_at: now })
    .eq('id', ev.id).eq('household_id', ctx.householdId)
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
