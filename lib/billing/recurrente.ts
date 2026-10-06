// Recurrente (https://docs.recurrente.com): checkouts alojados, suscripciones
// y webhooks firmados con Svix. Única implementación de BillingProvider.
//
// Por confirmar en las docs (ver docs/recurrente.md): el formato exacto de
// `items` (price_id o product_id), dónde trae cada evento la suscripción y el
// periodo, si DELETE /subscriptions acepta "al terminar el periodo" y si hay
// link para cambiar la tarjeta. Por eso el webhook no confía en el cuerpo:
// lee lo que puede, y confirma con GET /checkouts y GET /subscriptions.

import { catalogId, fromCatalogId, isCycle, isTier } from './catalog'
import { verifySvixSignature } from './svix'
import {
  WebhookSignatureError,
  type BillingEvent,
  type BillingEventType,
  type BillingProvider,
  type CheckoutInput,
  type ProviderSubscription,
} from './types'

const API = process.env.RECURRENTE_API_URL || 'https://app.recurrente.com/api'

type Json = Record<string, unknown>

function obj(v: unknown): Json | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null
}

/** Primer valor no vacío entre varias rutas ("a.b.c"). */
export function pick(source: unknown, paths: string[]): unknown {
  for (const path of paths) {
    let cur: unknown = source
    for (const key of path.split('.')) {
      cur = obj(cur)?.[key]
      if (cur === undefined || cur === null) break
    }
    if (cur !== undefined && cur !== null && cur !== '') return cur
  }
  return null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null
}

function int(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null
}

function iso(v: unknown): string | null {
  if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000).toISOString()
  if (typeof v !== 'string' || !v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Nombre del evento de Recurrente → tipo normalizado. */
export function mapEventType(raw: string): BillingEventType {
  switch (raw) {
    case 'subscription.create':
    case 'subscription.created':
    case 'subscription.activated':
      return 'activated'
    case 'intent.succeeded':
    case 'payment_intent.succeeded':
    case 'subscription.renewed':
      return 'renewed'
    case 'intent.failed':
    case 'payment_intent.failed':
    case 'subscription.past_due':
    case 'subscription.paused':
      return 'payment_failed'
    case 'subscription.cancel':
    case 'subscription.cancelled':
    case 'subscription.canceled':
      return 'cancelled'
    case 'refund.create':
    case 'refund.created':
    case 'refund.succeeded':
      return 'refunded'
    default:
      return 'ignored'
  }
}

/** Lo que se puede leer del cuerpo del webhook, sin llamar a la API. */
export function normalizeRecurrentePayload(payload: unknown, eventId: string): BillingEvent {
  const rawType = str(pick(payload, ['event_type', 'type', 'event'])) ?? 'unknown'
  const type = mapEventType(rawType)
  const topId = str(pick(payload, ['id']))
  const isIntent = !!topId && topId.startsWith('in_')

  const subscriptionId = str(pick(payload, ['subscription.id', 'subscription_id', 'data.subscription.id']))
    ?? (rawType.startsWith('subscription.') && topId && !isIntent ? topId : null)
  const checkoutId = str(pick(payload, ['checkout.id', 'checkout_id', 'data.checkout.id']))
    ?? (topId?.startsWith('ch_') ? topId : null)
  const paymentId = isIntent
    ? topId
    : str(pick(payload, ['intent.id', 'payment_intent.id', 'payment.id', 'latest_intent.id', 'checkout.latest_intent.id', 'intent_id']))

  const metadata = obj(pick(payload, ['metadata', 'checkout.metadata', 'subscription.metadata', 'data.metadata']))
  const catalog = fromCatalogId(str(pick(payload, [
    'price.id', 'product.id', 'subscription.price.id', 'subscription.product.id', 'price_id', 'product_id',
  ])))
  const tier = isTier(metadata?.tier) ? metadata.tier : catalog?.tier ?? null
  const cycle = isCycle(metadata?.cycle) ? metadata.cycle : catalog?.cycle ?? null

  return {
    id: eventId,
    type,
    rawType,
    providerSubscriptionId: subscriptionId,
    checkoutId,
    userId: str(metadata?.user_id),
    tier,
    cycle,
    periodStart: iso(pick(payload, ['subscription.current_period_start', 'current_period_start'])),
    periodEnd: iso(pick(payload, ['subscription.current_period_end', 'current_period_end'])),
    paymentId,
    amountCents: int(pick(payload, ['amount_in_cents', 'total_in_cents', 'payment.amount_in_cents', 'intent.amount_in_cents', 'checkout.total_in_cents'])),
    payload,
  }
}

export function mapSubscriptionStatus(raw: unknown): ProviderSubscription['status'] {
  switch (raw) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due'
    case 'cancelled':
    case 'canceled':
    case 'ended':
    case 'expired':
      return 'cancelled'
    default:
      return 'unknown'
  }
}

class RecurrenteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function call<T = Json>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const secret = process.env.RECURRENTE_SECRET_KEY
  if (!secret) throw new Error('Falta RECURRENTE_SECRET_KEY')
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'X-SECRET-KEY': secret,
      ...(process.env.RECURRENTE_PUBLIC_KEY ? { 'X-PUBLIC-KEY': process.env.RECURRENTE_PUBLIC_KEY } : {}),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : {}
  if (!res.ok) {
    const message = str(pick(data, ['message', 'error'])) ?? `Recurrente ${res.status}`
    throw new RecurrenteError(message, res.status)
  }
  return data as T
}

async function findOrCreateCustomer(email: string, name?: string | null): Promise<string | null> {
  try {
    const data = await call('POST', '/users', { email, full_name: name || email })
    return str(pick(data, ['id', 'user.id']))
  } catch {
    // El checkout también pide el correo; sin cliente previo sigue funcionando.
    return null
  }
}

export const recurrente: BillingProvider = {
  name: 'recurrente',

  async createCheckout(input: CheckoutInput) {
    const catalog = catalogId(input.tier, input.cycle)
    const customerId = await findOrCreateCustomer(input.email, input.name)
    const item = catalog.startsWith('prod_') ? { product_id: catalog, quantity: 1 } : { price_id: catalog, quantity: 1 }
    const data = await call('POST', '/checkouts', {
      items: [item],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(customerId ? { user_id: customerId } : {}),
      metadata: { user_id: input.userId, tier: input.tier, cycle: input.cycle },
    })
    const id = str(pick(data, ['id']))
    const url = str(pick(data, ['checkout_url', 'url']))
    if (!id || !url) throw new Error('Recurrente no devolvió el checkout')
    return { id, url }
  },

  async cancel(subscriptionId, { atPeriodEnd }) {
    // Recurrente cancela al momento; "al terminar el periodo" lo hace el cron
    // (app/api/cron/billing) antes de la renovación.
    if (atPeriodEnd) return { deferred: true }
    try {
      await call('DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`)
    } catch (e) {
      // Ya cancelada: no es error.
      if (!(e instanceof RecurrenteError && (e.status === 404 || e.status === 422))) throw e
    }
    return { deferred: false }
  },

  async refund(paymentId, amountCents) {
    if (amountCents <= 0) return
    await call('POST', '/refunds', { intent_id: paymentId, amount_in_cents: amountCents }, {
      'Idempotency-Key': `refund-${paymentId}-${amountCents}`,
    })
  },

  async updateCardUrl(subscriptionId) {
    const data = await call('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`).catch(() => null)
    return str(pick(data, ['update_payment_method_url', 'payment_method_update_url', 'manage_url', 'customer_portal_url']))
      ?? process.env.RECURRENTE_UPDATE_CARD_URL
      ?? null
  },

  async getSubscription(subscriptionId) {
    try {
      const data = await call('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`)
      return {
        id: str(pick(data, ['id'])) ?? subscriptionId,
        status: mapSubscriptionStatus(pick(data, ['status'])),
        periodStart: iso(pick(data, ['current_period_start'])),
        periodEnd: iso(pick(data, ['current_period_end'])),
      }
    } catch (e) {
      if (e instanceof RecurrenteError && e.status === 404) return null
      throw e
    }
  },

  async parseWebhook(rawBody, headers) {
    const eventId = headers.get('svix-id')
    const ok = verifySvixSignature({
      secret: process.env.RECURRENTE_WEBHOOK_SECRET ?? '',
      id: eventId,
      timestamp: headers.get('svix-timestamp'),
      signature: headers.get('svix-signature'),
      body: rawBody,
    })
    if (!ok || !eventId) throw new WebhookSignatureError('Firma inválida')

    const event = normalizeRecurrentePayload(JSON.parse(rawBody), eventId)
    if (event.type === 'ignored' || event.type === 'refunded') return event

    // Confirmar con la API: metadata y cobro desde el checkout, estado y
    // periodo desde la suscripción.
    if (event.checkoutId) {
      const checkout = await call('GET', `/checkouts/${encodeURIComponent(event.checkoutId)}`).catch(() => null)
      if (checkout) {
        const meta = obj(pick(checkout, ['metadata']))
        event.userId ??= str(meta?.user_id)
        if (!event.tier && isTier(meta?.tier)) event.tier = meta.tier
        if (!event.cycle && isCycle(meta?.cycle)) event.cycle = meta.cycle
        event.paymentId ??= str(pick(checkout, ['latest_intent.id', 'payment.id']))
        event.amountCents ??= int(pick(checkout, ['total_in_cents', 'amount_in_cents']))
        event.providerSubscriptionId ??= str(pick(checkout, ['subscription.id', 'subscription_id']))
      }
    }
    if (event.providerSubscriptionId) {
      const sub = await this.getSubscription(event.providerSubscriptionId)
      if (sub) {
        event.periodStart = sub.periodStart ?? event.periodStart
        event.periodEnd = sub.periodEnd ?? event.periodEnd
        // Lo que dice la API manda sobre el nombre del evento.
        if (sub.status === 'cancelled') event.type = 'cancelled'
        else if (sub.status === 'past_due' && event.type !== 'cancelled') event.type = 'payment_failed'
      }
    }
    return event
  },
}
