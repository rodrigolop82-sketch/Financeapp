// Paginación de Movimientos: ayudas puras para recargar sin perder lo que el
// usuario ya desplegó con "Ver más" (lib/movimientos-paging.test.ts).

/** El API de búsqueda nunca devuelve más de esto por llamada. */
export const API_MAX_LIMIT = 100

/** Tope de llamadas al volver a cubrir lo desplegado (evita bucles largos). */
export const MAX_RELOAD_CALLS = 8

/**
 * Cuántas filas pedir en la siguiente llamada para volver a cubrir `target`
 * filas ya desplegadas, dado que se llevan `loaded` y `calls` llamadas.
 * Devuelve 0 cuando ya no hace falta pedir más.
 */
export function nextReloadLimit(target: number, loaded: number, calls: number): number {
  if (calls >= MAX_RELOAD_CALLS) return 0
  const missing = target - loaded
  if (missing <= 0) return 0
  return Math.min(API_MAX_LIMIT, missing)
}

/** Agrega `page` al final de `prev` sin repetir ids y sin la fila `skipId` (borrado pendiente). */
export function appendUnique<T extends { id: string }>(prev: T[], page: T[], skipId?: string | null): T[] {
  const seen = new Set(prev.map((r) => r.id))
  const out = prev.slice()
  for (const r of page) {
    if (seen.has(r.id) || r.id === skipId) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}

/** Clave de lo que se está mirando: si no cambia, una recarga debe ser silenciosa. */
export function filterKey(parts: (string | null | undefined)[]): string {
  return parts.map((p) => p ?? '').join('|')
}
