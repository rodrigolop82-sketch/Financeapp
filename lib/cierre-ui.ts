// Ayudas de Cerrar el mes (puras).

/** Último día de un mes 'YYYY-MM' como 'YYYY-MM-DD'. */
export function lastDayOf(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m, 0).getDate()
  return `${yearMonth}-${String(d).padStart(2, '0')}`
}
