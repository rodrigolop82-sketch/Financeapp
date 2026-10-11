import { createClient } from '@/lib/supabase'

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
  /** income item only: true when the household hasn't configured any income entries yet */
  needsSetup?: boolean
}

export interface MonthCloseChecklist {
  yearMonth: string
  items: ChecklistItem[]
  completedCount: number
  totalCount: number
  percentComplete: number
  isFullyClosed: boolean
}

export async function getMonthCloseChecklist(
  userId: string,
  householdId: string,
  yearMonth: string,
): Promise<MonthCloseChecklist> {
  const supabase = createClient()

  const [{ data: sources }, { data: statuses }, { data: incomeEntries }, { data: incomeConfirmation }] = await Promise.all([
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
    supabase
      .from('income_entries')
      .select('id, amount')
      .eq('household_id', householdId),
    supabase
      .from('income_month_confirmations')
      .select('id')
      .eq('household_id', householdId)
      .eq('year_month', yearMonth)
      .eq('confirmed', true)
      .maybeSingle(),
  ])

  const activeSources = (sources ?? []) as StatementSource[]
  const monthStatuses = (statuses ?? []) as StatementStatus[]

  const statusMap = new Map(monthStatuses.map(s => [s.source_id, s]))

  const items: ChecklistItem[] = activeSources.map(source => {
    const status = statusMap.get(source.id)
    return {
      id: `source-${source.id}`,
      label: source.institution && !source.name.includes(source.institution) ? `${source.institution} (${source.name})` : source.name,
      type: 'source' as const,
      done: status?.loaded === true,
      sourceId: source.id,
      sourceType: CHECKLIST_TYPE[source.kind] ?? 'cuenta_bancaria',
    }
  })

  // Having income entries configured at all is necessary (there's something
  // to confirm) but not sufficient — "done" for a given month means the
  // household explicitly confirmed their income for THAT month, tracked in
  // income_month_confirmations. Without this, switching months in the
  // checklist always showed the same (global) status.
  const hasIncomeEntries = (incomeEntries ?? []).length > 0 &&
    (incomeEntries ?? []).some((e: { amount: number }) => e.amount > 0)
  const confirmedThisMonth = !!incomeConfirmation

  items.push({
    id: 'income',
    label: 'Ingresos del mes confirmados',
    type: 'income',
    done: hasIncomeEntries && confirmedThisMonth,
    needsSetup: !hasIncomeEntries,
  })

  const completedCount = items.filter(i => i.done).length
  const totalCount = items.length
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100

  return {
    yearMonth,
    items,
    completedCount,
    totalCount,
    percentComplete,
    isFullyClosed: percentComplete === 100,
  }
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
