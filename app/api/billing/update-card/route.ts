import { NextResponse } from 'next/server'
import { billing } from '@/lib/billing'
import { currentSubscription } from '@/lib/billing/service'
import { adminClient, sessionUser } from '@/lib/billing/server'

// Link para cambiar la tarjeta de la suscripción (cobro rechazado).
export async function GET() {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const current = await currentSubscription(adminClient(), user.id)
  if (!current?.provider_subscription_id) return NextResponse.json({ url: null }, { status: 404 })
  const url = await billing().updateCardUrl(current.provider_subscription_id).catch(() => null)
  return NextResponse.json({ url }, { status: url ? 200 : 404 })
}
