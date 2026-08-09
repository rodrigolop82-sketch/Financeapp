export const EXCHANGE_RATES: Record<string, number> = {
  GTQ: 1,
  USD: 7.75,
  EUR: 8.50,
  MXN: 0.45,
}

export function toGTQ(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency.toUpperCase()]
  if (!rate || rate === 1) return amount
  return Math.round(amount * rate * 100) / 100
}

export function detectCurrency(symbol: string | null | undefined): string {
  if (!symbol) return 'GTQ'
  const s = symbol.trim().toUpperCase()
  if (s === '$' || s === 'USD' || s === 'US$') return 'USD'
  if (s === '€' || s === 'EUR') return 'EUR'
  if (s === 'MXN' || s === 'MX$') return 'MXN'
  return 'GTQ'
}
