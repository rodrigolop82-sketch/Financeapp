import { NextResponse } from 'next/server'
import { billing, WebhookSignatureError } from '@/lib/billing'
import { applyBillingEvent } from '@/lib/billing/service'
import { adminClient } from '@/lib/billing/server'

// Webhook de Recurrente (firmado con Svix). Idempotente por svix-id; el
// estado se confirma con la API antes de tocar la base.
export async function POST(request: Request) {
  const raw = await request.text()
  let event
  try {
    event = await billing().parseWebhook(raw, request.headers)
  } catch (e) {
    if (e instanceof WebhookSignatureError) return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
    console.error('billing webhook parse', e)
    return NextResponse.json({ error: 'No se pudo leer el evento' }, { status: 500 })
  }

  try {
    const result = await applyBillingEvent(adminClient(), event)
    if (result === 'unmatched') console.warn('billing webhook sin usuario', event.rawType, event.id)
    return NextResponse.json({ received: true, result })
  } catch (e) {
    console.error('billing webhook apply', e)
    return NextResponse.json({ error: 'Error al procesar' }, { status: 500 })
  }
}
