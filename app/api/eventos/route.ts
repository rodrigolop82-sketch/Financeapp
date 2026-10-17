import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { isPremium } from '@/lib/plans'
import { parseNuevoEvento, puedeCrearEvento } from '@/lib/eventos'

export const dynamic = 'force-dynamic'

// Crear un evento con sus conceptos. Pasa por aquí (y no por el cliente)
// para revisar el límite de Gratis: un evento activo a la vez.
export async function POST(request: Request) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const parsed = parseNuevoEvento(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value

  const { count } = await ctx.admin
    .from('eventos').select('id', { count: 'exact', head: true })
    .eq('household_id', ctx.householdId).is('archived_at', null)
  if (!puedeCrearEvento(isPremium(ctx.plan.plan), count ?? 0)) {
    return NextResponse.json({ error: 'limite', limit: true }, { status: 402 })
  }

  const { data, error } = await ctx.admin.from('eventos').insert({
    household_id: ctx.householdId, tipo: v.tipo, nombre: v.nombre,
    fecha_inicio: v.fechaInicio, fecha_fin: v.fechaFin, created_by: ctx.userId,
  }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo crear el evento' }, { status: 500 })

  if (v.conceptos.length > 0) {
    const { error: cErr } = await ctx.admin.from('evento_conceptos').insert(
      v.conceptos.map((c, i) => ({ evento_id: data.id, household_id: ctx.householdId, nombre: c.nombre, presupuesto: c.presupuesto, orden: i })),
    )
    if (cErr) {
      await ctx.admin.from('eventos').delete().eq('id', data.id)
      return NextResponse.json({ error: 'No se pudo crear el evento' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
