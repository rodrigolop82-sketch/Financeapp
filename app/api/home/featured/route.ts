import { NextResponse } from 'next/server'
import { householdContext } from '@/lib/server/household-context'
import { resolveFeaturedCard } from '@/lib/home/featured-card-server'

export const dynamic = 'force-dynamic'

// Tarjeta destacada de Inicio (una sola, por prioridad).
export async function GET() {
  const ctx = await householdContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    return NextResponse.json({ card: await resolveFeaturedCard(ctx.admin, ctx.householdId) })
  } catch {
    return NextResponse.json({ card: null })
  }
}
