/**
 * Date utilities that respect the user's local timezone.
 *
 * The app's primary market is Guatemala (UTC-6). Using
 * `new Date().toISOString().split('T')[0]` returns the UTC date,
 * which is wrong after 6 PM local time. These helpers use the
 * local timezone on the client and America/Guatemala on the server.
 */

const TZ = 'America/Guatemala'

function formatLocal(date: Date): string {
  // On client: uses browser timezone. On server: force Guatemala.
  if (typeof window !== 'undefined') {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // Server-side: use Intl to get Guatemala date
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  return parts // en-CA format is YYYY-MM-DD
}

/** Returns today's date as YYYY-MM-DD in the user's local timezone */
export function localToday(): string {
  return formatLocal(new Date())
}

/** Returns the first day of the current month as YYYY-MM-DD (local timezone) */
export function localMonthStart(): string {
  const today = localToday()
  return today.slice(0, 8) + '01'
}

/** Returns the current month as YYYY-MM (local timezone) */
export function localMonth(): string {
  return localToday().slice(0, 7)
}

/** Returns the date N days ago as YYYY-MM-DD (local timezone) */
export function localDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatLocal(d)
}
