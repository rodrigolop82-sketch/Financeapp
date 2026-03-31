export type Currency = 'GTQ' | 'USD' | 'MXN' | 'COP' | 'HNL' | 'NIO' | 'CRC'

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GTQ: 'Q',
  USD: '$',
  MXN: '$',
  COP: '$',
  HNL: 'L',
  NIO: 'C$',
  CRC: '₡',
}

export interface FormatOptions {
  currency?: Currency
  showDecimals?: boolean
  compact?: boolean
}

/**
 * Función principal — usar en TODOS los componentes que muestren dinero.
 */
export function formatMoney(
  amount: number,
  options: FormatOptions = {}
): string {
  const { currency = 'GTQ', showDecimals = false, compact = false } = options
  const symbol = CURRENCY_SYMBOLS[currency]

  if (compact) {
    if (Math.abs(amount) >= 1_000_000)
      return `${symbol} ${(amount / 1_000_000).toFixed(1)}M`
    if (Math.abs(amount) >= 1_000)
      return `${symbol} ${(amount / 1_000).toFixed(1)}k`
    return `${symbol} ${Math.round(amount)}`
  }

  const decimals = showDecimals ? 2 : 0
  const formatted = new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(showDecimals ? amount : Math.round(amount))

  return `${symbol} ${formatted}`
}

/**
 * Para porcentajes — siempre un decimal.
 */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

/**
 * Para el puntaje Zafi — siempre entero.
 */
export function formatScore(score: number): string {
  return Math.round(score).toString()
}

/**
 * Hook que expone money(), percent() y score() con las preferencias del usuario.
 * Re-exportado desde /lib/hooks/useFormatMoney.ts para compatibilidad.
 */
export { useMoneyFormat } from '@/lib/hooks/useFormatMoney'

/**
 * Limpia el nombre de una transacción para mostrarlo correctamente.
 */
export function cleanTransactionName(raw: string): string {
  return raw
    .trim()
    .replace(/^(en |de |para |al |a la |del |en el |en la )/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^./, c => c.toUpperCase())
    .slice(0, 40)
    .trim()
}
