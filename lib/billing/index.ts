// Capa de cobros independiente del proveedor. El resto de la app solo
// importa de aquí; cambiar de proveedor = otra implementación de
// BillingProvider.

import { recurrente } from './recurrente'
import type { BillingProvider } from './types'

export * from './types'

export function billing(): BillingProvider {
  return recurrente
}
