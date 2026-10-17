// Ayudas de Cerrar el mes (puras).

/** Último día de un mes 'YYYY-MM' como 'YYYY-MM-DD'. */
export function lastDayOf(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m, 0).getDate()
  return `${yearMonth}-${String(d).padStart(2, '0')}`
}

/** Inicio avisa de cerrar el mes anterior del día 1 al 5 si sigue abierto. */
export function debeAvisarCierre(today: string, mesAnteriorCerrado: boolean): boolean {
  const day = Number(today.slice(8, 10))
  return day >= 1 && day <= 5 && !mesAnteriorCerrado
}

/** Título y texto de la tarjeta "Fin de mes" según los pasos que faltan. */
export function textoCierre(
  monthName: string,
  pendientes: { type: 'income' | 'source'; label: string }[],
): { title: string; body: string } {
  const n = pendientes.length
  if (n === 0) {
    return { title: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} está listo para cerrar`, body: 'Revisa tu puntaje del mes y ciérralo.' }
  }
  const partes = pendientes.map((p) => (p.type === 'income' ? 'registra tus ingresos' : `carga tu estado de cuenta de ${p.label}`))
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
  return {
    title: `Cerrar ${monthName}: ${n === 1 ? 'falta 1 paso' : `faltan ${n} pasos`}`,
    body: `${lista.charAt(0).toUpperCase()}${lista.slice(1)} para dejar el mes en orden.`,
  }
}
