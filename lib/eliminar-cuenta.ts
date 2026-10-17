// Eliminar mi cuenta (C5): reglas puras. La ruta es
// app/api/cuenta/eliminar y el borrado lo hace la función SQL
// eliminar_cuenta (migración 20261102), en una sola transacción.

/** Lo que la persona escribe para confirmar. */
export const CONFIRMACION = 'ELIMINAR'

export function confirmacionValida(texto: unknown): boolean {
  return typeof texto === 'string' && texto.trim().toUpperCase() === CONFIRMACION
}

/** Suscripciones que hay que cancelar en el proveedor antes de borrar. */
export function suscripcionesPorCancelar<T extends { provider_subscription_id: string | null; status: string | null }>(subs: T[]): string[] {
  return subs
    .filter((s) => s.provider_subscription_id && s.status !== 'cancelled' && s.status !== 'expired')
    .map((s) => s.provider_subscription_id!)
}
