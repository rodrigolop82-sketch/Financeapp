// Helpers puros del borrado con "Deshacer" (sin dependencias de React ni Supabase).

/** Tiempo que el toast de borrado deja para deshacer, en ms. */
export const DELETE_UNDO_MS = 6000;

export const DELETE_ERROR_MESSAGE = 'No se pudo borrar. Intenta de nuevo.';

/**
 * Devuelve una copia de `list` con `item` insertado en `index` (acotado al
 * largo de la lista). Si ya hay un elemento con el mismo id, no lo duplica.
 */
export function reinsertAt<T extends { id: string }>(list: T[], item: T, index: number): T[] {
  if (list.some((t) => t.id === item.id)) return list;
  const next = list.slice();
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}
