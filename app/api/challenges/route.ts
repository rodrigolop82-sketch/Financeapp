import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { hasFeature } from '@/lib/entitlements/features'
import { computeStartBaseline, endsAt, getChallenges, loadTemplates, spendCategories } from '@/lib/challenges/data'
import { checkStart, parseStartRequest } from '@/lib/challenges/rules'
import { localToday } from '@/lib/dates'

export const dynamic = 'force-dynamic'

async function features(hid: string) {
  const [multiple, customize] = await Promise.all([hasFeature(hid, 'challenges.multiple'), hasFeature(hid, 'challenges.customize')])
  return { multiple, customize }
}

// Retos del hogar: activos (con progreso), historial y plantillas.
export async function GET() {
  const ctx = await householdContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    const [data, f] = await Promise.all([getChallenges(ctx.admin, ctx.householdId, localToday()), features(ctx.householdId)])
    return NextResponse.json({ ...data, features: f, canWrite: ctx.plan.access === 'full' })
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar tus retos' }, { status: 500 })
  }
}

// Empezar un reto. El gating (1 activo y meta fija en Gratis) se decide aquí.
export async function POST(request: Request) {
  const ctx = await householdContext({ write: true })
  if (ctx instanceof NextResponse) return ctx
  const req = parseStartRequest(await request.json().catch(() => null))
  if (!req) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })

  const [templates, categories, activeRes, f] = await Promise.all([
    loadTemplates(ctx.admin),
    spendCategories(ctx.admin, ctx.householdId),
    ctx.admin.from('user_challenges').select('template_id, category_id').eq('household_id', ctx.householdId).eq('status', 'active'),
    features(ctx.householdId),
  ])
  const template = templates.find((t) => t.id === req.templateId) ?? null
  const check = checkStart({
    template,
    request: req,
    active: ((activeRes.data ?? []) as { template_id: string; category_id: string | null }[]).map((a) => ({ templateId: a.template_id, categoryId: a.category_id })),
    validCategoryIds: new Set(categories.map((c) => c.id)),
    features: f,
  })
  if (!check.ok) return NextResponse.json({ error: check.error, premium: check.premium ?? false }, { status: check.status })

  const today = localToday()
  const baseline = check.categoryId && (template!.type === 'spend_reduction' || template!.type === 'no_spend_category')
    ? await computeStartBaseline(ctx.admin, ctx.householdId, check.categoryId, today).catch(() => null)
    : null
  const { data, error } = await ctx.admin.from('user_challenges').insert({
    household_id: ctx.householdId,
    template_id: template!.id,
    status: 'active',
    category_id: check.categoryId,
    baseline_daily: baseline,
    target_amount: check.targetAmount,
    started_at: today,
    ends_at: endsAt(today, template!.duration_days),
    created_by: ctx.userId,
  }).select('id').single()
  if (error) return NextResponse.json({ error: 'No se pudo empezar el reto' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

