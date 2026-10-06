import type { Cycle, Tier } from '@/lib/plans'

export type BillingEventType = 'activated' | 'renewed' | 'payment_failed' | 'cancelled' | 'refunded' | 'ignored'

/** Evento del proveedor ya normalizado. El resto de la app solo ve esto. */
export interface BillingEvent {
  /** Id único del evento (idempotencia). */
  id: string
  type: BillingEventType
  /** Nombre original del evento del proveedor, para el registro. */
  rawType: string
  providerSubscriptionId: string | null
  checkoutId: string | null
  userId: string | null
  tier: Tier | null
  cycle: Cycle | null
  periodStart: string | null
  periodEnd: string | null
  /** Id del cobro (el que se reembolsa). */
  paymentId: string | null
  amountCents: number | null
  payload: unknown
}

export interface CheckoutInput {
  userId: string
  email: string
  name?: string | null
  tier: Tier
  cycle: Cycle
  successUrl: string
  cancelUrl: string
}

/** Estado de una suscripción consultado al proveedor. */
export interface ProviderSubscription {
  id: string
  status: 'active' | 'past_due' | 'cancelled' | 'unknown'
  periodStart: string | null
  periodEnd: string | null
}

export interface BillingProvider {
  name: string
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>
  /**
   * Cancela una suscripción. Con `atPeriodEnd` y un proveedor que no lo
   * soporta, devuelve `{ deferred: true }`: quien llama la marca y el cron
   * la cancela de verdad antes de la renovación.
   */
  cancel(subscriptionId: string, opts: { atPeriodEnd: boolean }): Promise<{ deferred: boolean }>
  refund(paymentId: string, amountCents: number): Promise<void>
  /** Link para que el cliente cambie su tarjeta, si el proveedor lo da. */
  updateCardUrl(subscriptionId: string): Promise<string | null>
  getSubscription(subscriptionId: string): Promise<ProviderSubscription | null>
  /** Verifica la firma y normaliza. Lanza WebhookSignatureError si no es válida. */
  parseWebhook(rawBody: string, headers: Headers): Promise<BillingEvent>
}

export class WebhookSignatureError extends Error {}
