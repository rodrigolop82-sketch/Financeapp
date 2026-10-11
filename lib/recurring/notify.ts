// Qué avisos de suscripciones tocan hoy (puro). El cron los envía con
// lib/recurring/cron.ts. Ambos son Premium: quien llama ya filtró el hogar.

import { daysBetween, type RecurringCharge } from './detect'

export interface RecurringNotice {
  kind: 'recurring_reminder' | 'price_alert'
  key: string
  title: string
  body: string
  url: string
}

/** Una alza solo se avisa si el cobro que subió es de los últimos 7 días. */
export const PRICE_ALERT_WINDOW_DAYS = 7

export function recurringNotices(
  householdId: string,
  charges: (RecurringCharge & { remindDaysBefore: 1 | 2 | 3 | null })[],
  today: string,
  fmt: (n: number) => string,
  features: { reminders: boolean; priceAlerts: boolean },
): RecurringNotice[] {
  const out: RecurringNotice[] = []
  for (const c of charges) {
    if (c.status !== 'active') continue
    const url = `/resumen/suscripciones/${encodeURIComponent(c.merchantKey)}`
    if (features.reminders && c.remindDaysBefore && daysBetween(today, c.nextExpectedDate) === c.remindDaysBefore) {
      const n = c.remindDaysBefore
      out.push({
        kind: 'recurring_reminder',
        key: `recurring:${householdId}:${c.merchantKey}:${c.nextExpectedDate}`,
        title: `${c.displayName} se cobra en ${n} ${n === 1 ? 'día' : 'días'}`,
        body: `${c.displayName} se cobra en ${n} ${n === 1 ? 'día' : 'días'}: ${fmt(c.typicalAmount)}`,
        url,
      })
    }
    const pc = c.priceChange
    if (features.priceAlerts && pc && pc.to > pc.from && daysBetween(c.lastDate, today) <= PRICE_ALERT_WINDOW_DAYS) {
      out.push({
        kind: 'price_alert',
        key: `price:${householdId}:${c.merchantKey}:${c.lastDate}`,
        title: 'Subió un cobro',
        body: `El cobro de ${c.displayName} subió de ${fmt(pc.from)} a ${fmt(pc.to)}`,
        url,
      })
    }
  }
  return out
}
