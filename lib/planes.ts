// Textos y reglas de la pantalla Planes, sin React para probarlos con vitest.

import { PRICES_CENTS, priceLabel, type Cycle, type Plan, type Tier } from './plans'

export type PlanFrom = 'import' | 'history' | 'ia' | 'reminders'

export const PLAN_FROMS: PlanFrom[] = ['import', 'history', 'ia', 'reminders']

export function planFrom(v: string | null | undefined): PlanFrom | null {
  return PLAN_FROMS.includes(v as PlanFrom) ? (v as PlanFrom) : null
}

export type Benefit = [emoji: string, name: string, help: string]

const PREMIUM_BENEFITS: Record<PlanFrom | 'learn' | 'viewer', Benefit> = {
  import: ['📄', 'Importa sin límite', 'Sube la foto o el PDF de cada tarjeta y Zafi registra todo. Gratis son 2 al mes.'],
  history: ['🗓️', 'Todo tu historial', 'Busca y compara meses y años. Gratis ves los últimos 3 meses.'],
  ia: ['✨', 'Pregúntale a Zafi sin límite', 'Gratis son 15 preguntas al mes.'],
  reminders: ['🔔', 'Recordatorios de pagos', 'Te avisamos antes de que venza cada tarjeta, préstamo o servicio.'],
  learn: ['📚', 'Aprende completo', 'Todas las lecciones, no solo las primeras.'],
  viewer: ['👀', 'Comparte en modo ver', '1 persona de tu casa puede ver tu plan.'],
}

const FAMILY_BENEFITS: Benefit[] = [
  ['👪', '2 adultos, cada uno con su cuenta', 'Los dos registran, ven el mismo plan y reciben sus avisos.'],
  ['🧾', 'Quién pagó y para qué', 'Cada gasto con dueño: de la casa o personal.'],
  ['⚖️', 'Cuentas claras', 'Bolsa común, mitad y mitad o según lo que gana cada uno.'],
  ['🔔', 'Cada pago con responsable', 'Le avisamos a quien le toca pagar.'],
  ['🎯', 'Metas compartidas', 'Cada aporte con nombre.'],
  ['👑', 'Todo lo de Premium', 'Importar, historial, Zafi y Aprende sin límite para los dos.'],
]

/** Beneficios del plan elegido; el que trajo al usuario (`from`) va primero. */
export function planBenefits(tier: Tier, from: PlanFrom | null): Benefit[] {
  if (tier === 'family') return FAMILY_BENEFITS
  const base = ['import', 'history', 'ia', 'reminders', 'learn', 'viewer'] as const
  const order = from ? [from, ...base.filter((k) => k !== from)] : [...base]
  return order.map((k) => PREMIUM_BENEFITS[k])
}

export function planHero(tier: Tier): { eyebrow: string; title: string; text: string } {
  return tier === 'family'
    ? {
        eyebrow: 'Premium Familiar',
        title: 'Su dinero en orden, entre los dos',
        text: 'Cada uno con su cuenta, el mismo plan y claro quién paga qué. Si ya usan Zafi, no pierden nada.',
      }
    : {
        eyebrow: 'Zafi Premium',
        title: 'Tu dinero en orden, sin límites',
        text: 'Captura todo sin escribir, revisa todo tu historial y recibe avisos antes de cada pago.',
      }
}

export function tierName(tier: Tier): string {
  return tier === 'family' ? 'Familiar' : 'Premium'
}

/** Precio de la tarjeta: monto, periodo y ayuda. */
export function planPrice(tier: Tier, cycle: Cycle): { amount: string; period: string; help: string } {
  const cents = PRICES_CENTS[tier][cycle]
  const amount = priceLabel(cents)
  if (cycle === 'annual') {
    const perMonth = tier === 'family' ? cents / 12 / 2 : cents / 12
    return { amount, period: 'al año', help: tier === 'family' ? `${priceLabel(perMonth)} al mes cada uno` : `${priceLabel(perMonth)} al mes` }
  }
  return { amount, period: 'al mes', help: tier === 'family' ? `${priceLabel(cents / 2)} cada uno` : 'Cancela cuando quieras' }
}

/** Plan preseleccionado: Familiar si el hogar es en pareja/familia o ya son 2+. */
export function defaultTier(opts: { householdType?: string | null; memberCount: number; current?: Tier | null; param?: string | null }): Tier {
  if (opts.param === 'family' || opts.param === 'premium') return opts.param
  if (opts.current) return opts.current
  return opts.householdType === 'family' || opts.memberCount >= 2 ? 'family' : 'premium'
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "9 de octubre" (con año si no es el actual). */
export function longDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const base = `${d.getDate()} de ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`
}

export interface Subscription {
  tier: Tier | null
  cycle: Cycle | null
  status: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  creditCents: number
}

export type PlanAction =
  | { kind: 'member'; text: string }
  | { kind: 'current'; text: string }
  | { kind: 'checkout' | 'change'; label: string; help: string }

/** Botón principal de Planes según el plan, la prueba y lo elegido. */
export function planAction(opts: {
  tier: Tier
  cycle: Cycle
  isOwner: boolean
  ownerName?: string | null
  trialActive: boolean
  trialEndsAt: string | null
  subscription: Subscription | null
  now?: Date
}): PlanAction {
  const { tier, cycle, subscription: sub } = opts
  const price = planPrice(tier, cycle)
  if (!opts.isOwner) {
    return { kind: 'member', text: opts.ownerName ? `Tu plan lo paga ${opts.ownerName}` : 'Tu plan lo paga el dueño del hogar' }
  }
  if (sub && (sub.status === 'active' || sub.status === 'past_due')) {
    if (sub.tier === tier && sub.cycle === cycle) {
      const date = longDate(sub.currentPeriodEnd, opts.now)
      return {
        kind: 'current',
        text: sub.cancelAtPeriodEnd
          ? `Tu plan sigue hasta el ${date}`
          : date ? `Es tu plan · se renueva el ${date}` : 'Es tu plan',
      }
    }
    const credit = sub.creditCents > 0 ? ` y te devolvemos ${priceLabel(sub.creditCents)} de tu plan actual` : ''
    return {
      kind: 'change',
      label: `Cambiar a ${tierName(tier)}${sub.tier === tier ? (cycle === 'annual' ? ' anual' : ' mensual') : ''}`,
      help: `Pagas ${price.amount} hoy${credit}.`,
    }
  }
  if (opts.trialActive && opts.trialEndsAt) {
    return {
      kind: 'checkout',
      label: `Activar ${tierName(tier)}`,
      help: `Tu prueba sigue hasta el ${longDate(opts.trialEndsAt, opts.now)}; el cobro empieza hoy · ${price.amount} ${price.period}`,
    }
  }
  return { kind: 'checkout', label: `Activar ${tierName(tier)}`, help: `Se cobra hoy · ${price.amount} ${price.period}` }
}

/** Fila de estado del plan en Mi cuenta (Tile 👑). */
export function planStatusRow(opts: {
  plan: Plan
  isOwner: boolean
  trialActive: boolean
  trialEndsAt: string | null
  subscription: Subscription | null
  household: { name: string; members: { name: string }[] } | null
  ownerName?: string | null
  now?: Date
}): { title: string; hint: string; tone: 'normal' | 'warn' | 'danger' } {
  const now = opts.now ?? new Date()
  const sub = opts.subscription
  if (sub?.status === 'past_due') {
    return { title: 'No pudimos cobrar tu plan', hint: 'Cambia tu tarjeta para seguir con tu plan', tone: 'danger' }
  }
  const names = opts.household && opts.household.members.length >= 2
    ? opts.household.members.map((m) => m.name).join(' y ')
    : ''
  if (sub && sub.status === 'active' && sub.tier) {
    const cycle = sub.cycle === 'annual' ? 'Anual' : 'Mensual'
    const date = longDate(sub.currentPeriodEnd, now)
    const when = sub.cancelAtPeriodEnd ? `sigue hasta el ${date}` : `se renueva el ${date}`
    if (sub.tier === 'family') {
      return {
        title: ['Familiar', opts.household?.name].filter(Boolean).join(' · '),
        hint: [cycle, names, date ? when : ''].filter(Boolean).join(' · '),
        tone: 'normal',
      }
    }
    return { title: 'Premium', hint: [cycle, date ? when : ''].filter(Boolean).join(' · '), tone: 'normal' }
  }
  if (opts.trialActive && opts.trialEndsAt) {
    const days = Math.max(1, Math.ceil((new Date(opts.trialEndsAt).getTime() - now.getTime()) / 86_400_000))
    return { title: 'Prueba Premium', hint: `Quedan ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'warn' }
  }
  if (!opts.isOwner && opts.plan === 'family') {
    return {
      title: ['Familiar', opts.household?.name].filter(Boolean).join(' · '),
      hint: opts.ownerName ? `Lo paga ${opts.ownerName}` : 'Lo paga el dueño del hogar',
      tone: 'normal',
    }
  }
  if (opts.plan !== 'free') {
    return { title: opts.plan === 'family' ? 'Familiar' : 'Premium', hint: 'Tu plan está activo', tone: 'normal' }
  }
  return { title: 'Plan Gratis', hint: 'Conoce lo que incluye Premium', tone: 'normal' }
}
