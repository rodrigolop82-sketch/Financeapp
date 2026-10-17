import { createClient } from '@/lib/supabase'
import { monthRange } from '@/lib/movimientos'
import { resumirMovimientos } from '@/lib/metricas-mes'
import { loadMetricasInput } from '@/lib/metricas-mes-data'

interface StatementSource { id: string; kind: string; name: string; institution: string | null; last4: string | null }
interface StatementStatus { source_id: string; loaded: boolean }

/** Tipo de Mis cuentas → el que usa la lista del cierre. */
const CHECKLIST_TYPE: Record<string, string> = {
  credit_card: 'tarjeta_credito',
  bank_account: 'cuenta_bancaria',
  cash: 'efectivo',
}

export interface ChecklistItem {
  id: string
  label: string
  type: 'source' | 'income'
  done: boolean
  sourceId?: string
  sourceType?: string
}

/** Estado del paso de ingresos (lib/metricas-mes: ingresos registrados). */
export interface IngresosPaso {
  /** Ingresos registrados en el mes. */
  registrados: number
  /** La persona confirmó que no hubo ingresos ese mes. */
  sinIngresos: boolean
}

export interface MonthCloseChecklist {
  yearMonth: string
  /** Pasos obligatorios: ingresos + un estado de cuenta por banco. */
  items: ChecklistItem[]
  ingresos: IngresosPaso
  completedCount: number
  totalCount: number
  /** Todos los pasos obligatorios listos: se puede cerrar. */
  canClose: boolean
}

/**
 * Pasos obligatorios del cierre (puro). El de ingresos está listo si hay
 * ingresos registrados o si la persona marcó "No hubo ingresos"; cada banco
 * con cierre de mes, cuando su estado de cuenta está cargado. Los ahorros
 * fuera de Zafi son opcionales y no cuentan.
 */
export function pasosCierre(
  yearMonth: string,
  ingresos: IngresosPaso,
  sources: { id: string; label: string; sourceType: string; done: boolean }[],
): MonthCloseChecklist {
  const items: ChecklistItem[] = [
    {
      id: 'income',
      label: 'Ingresos del mes',
      type: 'income',
      done: ingresos.registrados > 0 || ingresos.sinIngresos,
    },
    ...sources.map((s) => ({
      id: `source-${s.id}`,
      label: s.label,
      type: 'source' as const,
      done: s.done,
      sourceId: s.id,
      sourceType: s.sourceType,
    })),
  ]
  const completedCount = items.filter((i) => i.done).length
  return { yearMonth, items, ingresos, completedCount, totalCount: items.length, canClose: completedCount === items.length }
}

export async function getMonthCloseChecklist(
  householdId: string,
  yearMonth: string,
): Promise<MonthCloseChecklist> {
  const supabase = createClient()
  const { from, to } = monthRange(yearMonth)

  const [{ data: sources }, { data: statuses }, metricas, sinIngresos] = await Promise.all([
    // Mis cuentas con cierre de mes (RLS: propias y compartidas del hogar).
    supabase
      .from('financial_sources')
      .select('id, kind, name, institution, last4')
      .eq('household_id', householdId)
      .eq('tracks_statements', true)
      .is('archived_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('source_statement_status')
      .select('source_id, loaded')
      .eq('year_month', yearMonth),
    loadMetricasInput(supabase, householdId, from, to),
    loadSinIngresos(householdId, yearMonth),
  ])

  const statusMap = new Map(((statuses ?? []) as StatementStatus[]).map((s) => [s.source_id, s]))
  const m = resumirMovimientos(metricas.txs, metricas.categories, metricas.intereses)

  return pasosCierre(
    yearMonth,
    { registrados: m.ingresos, sinIngresos },
    ((sources ?? []) as StatementSource[]).map((source) => ({
      id: source.id,
      label: source.institution && !source.name.includes(source.institution) ? `${source.institution} (${source.name})` : source.name,
      sourceType: CHECKLIST_TYPE[source.kind] ?? 'cuenta_bancaria',
      done: statusMap.get(source.id)?.loaded === true,
    })),
  )
}

/** ¿El hogar marcó "No hubo ingresos" ese mes? (false sin la migración). */
export async function loadSinIngresos(householdId: string, yearMonth: string): Promise<boolean> {
  const { data, error } = await createClient()
    .from('income_month_confirmations')
    .select('sin_ingresos')
    .eq('household_id', householdId)
    .eq('year_month', yearMonth)
    .maybeSingle()
  return !error && !!(data as { sin_ingresos?: boolean } | null)?.sin_ingresos
}

/** Marca o desmarca "No hubo ingresos" para el mes. */
export async function setSinIngresos(householdId: string, yearMonth: string, value: boolean) {
  return createClient().from('income_month_confirmations').upsert(
    { household_id: householdId, year_month: yearMonth, confirmed: true, sin_ingresos: value, confirmed_at: new Date().toISOString() },
    { onConflict: 'household_id,year_month' },
  )
}

export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-')
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${months[parseInt(month, 10) - 1]} ${year}`
}

export function getPreviousYearMonth(): string {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}
