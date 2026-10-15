import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature, PREMIUM_REQUIRED } from '@/lib/entitlements/features'
import { localDate } from '@/lib/networth/compute'
import { validateManualMonth } from '@/lib/networth/manual'

export const dynamic = 'force-dynamic'

// "Editar historial" del patrimonio (F3, Premium como la gráfica). Cada
// usuario edita solo sus propios meses.

async function context() {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  if (!(await hasFeature(ctx.householdId, 'networth.history'))) {
    return NextResponse.json({ error: PREMIUM_REQUIRED, premium: true }, { status: 403 })
  }
  return ctx
}

/** Guarda (o corrige) un mes: { month, assets, liabilities }. */
export async function POST(request: Request) {
  const ctx = await context()
  if (ctx instanceof NextResponse) return ctx
  const body = (await request.json().catch(() => null)) as { month?: unknown; assets?: unknown; liabilities?: unknown } | null
  const currentMonth = localDate(new Date().toISOString()).slice(0, 7)
  const invalid = validateManualMonth(body ?? {}, currentMonth)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  const { error } = await ctx.admin.from('networth_manual_months').upsert({
    user_id: ctx.userId,
    month: body!.month as string,
    assets: body!.assets as number,
    liabilities: body!.liabilities as number,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,month' })
  if (error) return NextResponse.json({ error: 'No se pudo guardar el mes' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** Quita el dato manual de un mes (?month=YYYY-MM): vuelve el calculado. */
export async function DELETE(request: Request) {
  const ctx = await context()
  if (ctx instanceof NextResponse) return ctx
  const month = new URL(request.url).searchParams.get('month') ?? ''
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Elige un mes válido.' }, { status: 400 })
  const { error } = await ctx.admin.from('networth_manual_months').delete().eq('user_id', ctx.userId).eq('month', month)
  if (error) return NextResponse.json({ error: 'No se pudo quitar el mes' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
