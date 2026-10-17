// Una sola fuente de verdad para las deudas: la tabla `debts`. El puntaje,
// Plan › Deudas, el plan de pago, Siguiente paso, Mis cuentas, Mi patrimonio,
// las lecciones y Zafi leen de aquí y usan la misma definición de "activa".
// financial_profiles.total_debt es solo lo que la persona contó al empezar;
// no se usa cuando ya hay deudas registradas.

import type { SupabaseClient } from '@supabase/supabase-js'
import { capKeyByName } from './recomendaciones'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>

export interface DeudaBase {
  id?: string
  balance: number | string | null
  min_payment?: number | string | null
  is_paid?: boolean | null
}

/** Activa: no está marcada como pagada y todavía tiene saldo. */
export function esDeudaActiva(d: DeudaBase): boolean {
  return !d.is_paid && (Number(d.balance) || 0) > 0
}

export function deudasActivas<T extends DeudaBase>(debts: T[]): T[] {
  return debts.filter(esDeudaActiva)
}

export interface ResumenDeudas {
  /** Hay al menos una deuda activa. */
  hayDeudas: boolean
  cantidad: number
  /** Σ pagos mínimos al mes de las activas. */
  cuotaMensual: number
  /** Σ saldos de las activas. */
  saldoTotal: number
}

export function resumenDeudas(debts: DeudaBase[]): ResumenDeudas {
  const activas = deudasActivas(debts)
  return {
    hayDeudas: activas.length > 0,
    cantidad: activas.length,
    cuotaMensual: activas.reduce((s, d) => s + (Number(d.min_payment) || 0), 0),
    saldoTotal: activas.reduce((s, d) => s + (Number(d.balance) || 0), 0),
  }
}

/**
 * Deudas del hogar. Por defecto solo las activas; con `todas` también las
 * pagadas (Plan › Deudas las muestra aparte). null si la consulta falla.
 */
export async function loadDeudas<T extends DeudaBase = DeudaBase & Record<string, unknown>>(
  supabase: Client,
  householdId: string,
  { columns = '*', todas = false }: { columns?: string; todas?: boolean } = {},
): Promise<T[] | null> {
  const { data, error } = await supabase
    .from('debts')
    .select(columns)
    .eq('household_id', householdId)
    .order('balance', { ascending: true })
  if (error) return null
  const rows = (data ?? []) as unknown as T[]
  return todas ? rows : deudasActivas(rows)
}

/** Categoría de Ahorro y deudas que es pago a deudas ("Pago de deudas extra"). */
export function esCategoriaPagoDeuda(c: { name: string; bucket: string; cap_key?: string | null }): boolean {
  return c.bucket === 'savings' && (c.cap_key === 'deudas' || capKeyByName(c.name) === 'deudas')
}

/**
 * Qué hacer en Plan del mes con una categoría de pago a deudas ("Pago de
 * deudas extra"): normal si hay deudas activas; sin deudas se oculta, salvo
 * que tenga monto o movimientos, y entonces se muestra con un aviso (el
 * monto sigue sumando en el plan y no se puede esconder).
 */
export function filaPagoDeuda(plan: number, spent: number, hayDeudas: boolean): 'normal' | 'ocultar' | 'aviso' {
  if (hayDeudas) return 'normal'
  return plan > 0 || spent > 0 ? 'aviso' : 'ocultar'
}
