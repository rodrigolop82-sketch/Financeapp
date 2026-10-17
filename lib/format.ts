export type Currency = 'GTQ' | 'USD' | 'MXN' | 'COP' | 'HNL' | 'NIO' | 'CRC' | 'EUR'

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GTQ: 'Q',
  USD: '$',
  MXN: '$',
  COP: '$',
  HNL: 'L',
  NIO: 'C$',
  CRC: '₡',
  EUR: '€',
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
      return `${symbol} ${formatNumber(amount / 1_000_000, 1)}M`
    if (Math.abs(amount) >= 1_000)
      return `${symbol} ${formatNumber(amount / 1_000, 1)}k`
    return `${symbol} ${formatNumber(amount)}`
  }

  return `${symbol} ${formatNumber(amount, showDecimals ? 2 : 0)}`
}

const NUMBER_FORMATS = new Map<number, Intl.NumberFormat>()

/**
 * Número con el formato de toda la app (es-GT): coma para miles y punto
 * para decimales. "3,000", "4.7", "8,500.75". Usar esto en lugar de
 * toLocaleString()/toFixed() sueltos.
 */
export function formatNumber(n: number, decimals = 0): string {
  let nf = NUMBER_FORMATS.get(decimals)
  if (!nf) {
    nf = new Intl.NumberFormat('es-GT', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    NUMBER_FORMATS.set(decimals, nf)
  }
  // Redondear antes evita "-0" y deja el redondeo igual en todos lados.
  const factor = 10 ** decimals
  const rounded = Math.round(n * factor) / factor
  return nf.format(Object.is(rounded, -0) ? 0 : rounded)
}

/**
 * Cantidad de meses con un decimal si hace falta: "1 mes", "3 meses",
 * "4.7 meses". Para plazos largos en años usar formatTerm.
 */
export function formatMonthCount(months: number): string {
  const rounded = Math.round(months * 10) / 10
  const decimals = Number.isInteger(rounded) ? 0 : 1
  return `${formatNumber(rounded, decimals)} ${rounded === 1 ? 'mes' : 'meses'}`
}

/** Plazo en meses enteros: "8 meses", "1 año 4 m", "2 años", "+30 años". */
export function formatTerm(months: number): string {
  if (months >= 360) return '+30 años'
  if (months > 12) {
    const years = Math.floor(months / 12)
    const rest = months % 12
    return `${years} ${years === 1 ? 'año' : 'años'}${rest ? ` ${rest} m` : ''}`
  }
  return formatMonthCount(months)
}

/**
 * Para porcentajes — siempre un decimal.
 */
export function formatPercent(ratio: number): string {
  return `${formatNumber(ratio * 100, 1)}%`
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
