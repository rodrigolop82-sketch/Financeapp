import { NextResponse } from 'next/server'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { firstName, type Person } from '@/lib/hogar'
import { getEffectivePlan } from '@/lib/plans'

// Personas de mi hogar (con nombre: la tabla users solo deja leer la propia
// fila). Acceso efectivo: si el hogar no es Familiar, los miembros solo ven.
export async function GET() {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const plan = await getEffectivePlan(user.id)
  if (!plan.householdId) return NextResponse.json({ householdId: null, me: user.id, people: [] })

  const admin = adminClient()
  const [{ data: hh }, { data: rows }] = await Promise.all([
    admin.from('households').select('owner_id').eq('id', plan.householdId).single(),
    admin.from('household_members').select('*, users(full_name, email)').eq('household_id', plan.householdId),
  ])
  type Row = { user_id: string; role: string; access?: string | null; monthly_income?: number | null; users: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null }
  const family = plan.plan === 'family'
  const people: Person[] = ((rows ?? []) as Row[]).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    const owner = r.user_id === hh?.owner_id || r.role === 'owner'
    return {
      id: r.user_id,
      name: firstName(u?.full_name, u?.email),
      fullName: u?.full_name || u?.email || 'Usuario',
      owner,
      access: owner ? 'full' : family && r.access !== 'view' ? 'full' : 'view',
      monthlyIncome: r.monthly_income ?? null,
    }
  })
  if (hh && !people.some((p) => p.id === hh.owner_id)) {
    const { data: o } = await admin.from('users').select('full_name, email').eq('id', hh.owner_id).single()
    people.push({ id: hh.owner_id, name: firstName(o?.full_name, o?.email), fullName: o?.full_name || o?.email || 'Usuario', owner: true, access: 'full' })
  }
  people.sort((a, b) => Number(b.owner) - Number(a.owner))
  return NextResponse.json({ householdId: plan.householdId, me: user.id, people })
}
