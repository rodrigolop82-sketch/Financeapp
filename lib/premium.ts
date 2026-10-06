// Textos del aviso único de Premium (PremiumSheet / PremiumInline / LimitMeter).
// Sin React, para probarlos con vitest.

export type PremiumReason = 'import' | 'ia' | 'history' | 'familia'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export interface GateText {
  emoji: string
  title: string
  subtitle: string
  meter?: { used: number; limit: number; noun: string }
  plan: string
  perks: string[]
  cta: string
  href: string
}

/** Contenido de la hoja según lo que pasó. `today` es YYYY-MM-DD. */
export function premiumGate(reason: PremiumReason, ctx: {
  today: string
  used?: number
  limit?: number
  /** Nombre de la otra persona del hogar (para 'familia'). */
  memberName?: string | null
  /** El hogar ya es de 2: los beneficios se dicen "Con Premium Familiar". */
  family?: boolean
}): GateText {
  const month = Number(ctx.today.slice(5, 7)) - 1
  const thisMonth = MONTHS[month]
  const next = MONTHS[(month + 1) % 12]
  const plan = ctx.family ? 'Con Premium Familiar' : 'Con Premium'
  const href = (from: string) => (ctx.family ? `/planes?tier=family&from=${from}` : `/planes?from=${from}`)
  switch (reason) {
    case 'import': {
      const limit = ctx.limit ?? 2
      return {
        emoji: '📄',
        title: `Ya usaste tus ${limit} importaciones de ${thisMonth}`,
        subtitle: `Se renuevan el 1 de ${next}.`,
        meter: { used: ctx.used ?? limit, limit, noun: 'importaciones' },
        plan,
        perks: ['Importa todos los estados que quieras', 'Varias tarjetas en un mismo mes'],
        cta: 'Ver Premium',
        href: href('import'),
      }
    }
    case 'ia': {
      const limit = ctx.limit ?? 15
      return {
        emoji: '✨',
        title: `Usaste tus ${limit} preguntas del mes`,
        subtitle: `Se renuevan el 1 de ${next}.`,
        meter: { used: ctx.used ?? limit, limit, noun: 'preguntas' },
        plan,
        perks: ['Pregúntale a Zafi sin límite'],
        cta: 'Ver Premium',
        href: href('ia'),
      }
    }
    case 'history':
      return {
        emoji: '🗓️',
        title: 'Gratis muestra los últimos 3 meses',
        subtitle: 'Tus movimientos de antes siguen guardados. No se borra nada.',
        plan,
        perks: ['Busca en todo tu historial', 'Compara este año con el anterior'],
        cta: 'Ver Premium',
        href: href('history'),
      }
    case 'familia': {
      const name = ctx.memberName || 'Tu pareja'
      return {
        emoji: '👪',
        title: `${name} ya puede ver tu plan`,
        subtitle: 'Para que también registre y reciba sus avisos, pasen a Familiar: $ 2 más al mes.',
        plan: 'Con Premium Familiar',
        perks: [`${name} también registra sus gastos`, 'Cada uno recibe sus recordatorios', 'Cuentas claras entre los dos'],
        cta: 'Ver Familiar',
        href: '/planes?tier=family',
      }
    }
  }
}

/** Texto del medidor antes del límite: "Te queda 1 importación gratis este mes". */
export function meterText(kind: 'import' | 'ia', used: number, limit: number): string {
  const left = Math.max(0, limit - used)
  if (kind === 'import') {
    return left === 0
      ? 'Ya usaste tus importaciones gratis de este mes'
      : `Te ${left === 1 ? 'queda' : 'quedan'} ${left} ${left === 1 ? 'importación gratis' : 'importaciones gratis'} este mes`
  }
  return left === 0
    ? 'Ya usaste tus preguntas gratis de este mes'
    : `Te ${left === 1 ? 'queda' : 'quedan'} ${left} ${left === 1 ? 'pregunta gratis' : 'preguntas gratis'} este mes`
}

/** Color del medidor: azul antes de la mitad, ámbar desde la mitad. */
export function meterColor(used: number, limit: number): string {
  return limit > 0 && used / limit >= 0.5 ? '#F59E0B' : '#2563EB'
}

/** "Hay 41 resultados más antes de agosto." — para el final de la lista. */
export function hiddenHistoryText(count: number, before: string, today: string): { strong: string; rest: string } {
  const m = MONTHS[Number(before.slice(5, 7)) - 1]
  const y = before.slice(0, 4)
  const when = y === today.slice(0, 4) ? m : `${m} de ${y}`
  return {
    strong: `Hay ${count} ${count === 1 ? 'resultado más' : 'resultados más'}`,
    rest: `antes de ${when}. Siguen guardados; con Premium los ves todos.`,
  }
}
