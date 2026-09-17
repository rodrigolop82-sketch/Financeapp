import { createClient } from '@/lib/supabase'
import type { UserSource, SourceMonthlyStatus } from '@/types'

export interface ChecklistItem {
  id: string
  label: string
  type: 'source' | 'income'
  done: boolean
  sourceId?: string
  sourceType?: string
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

  const [{ data: sources }, { data: statuses }, { data: incomeEntries }] = await Promise.all([
    supabase
      .from('user_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('source_monthly_status')
      .select('*')
      .eq('year_month', yearMonth),
    supabase
      .from('income_entries')
      .select('id, amount')
      .eq('household_id', householdId),
  ])

  const activeSources = (sources ?? []) as UserSource[]
  const monthStatuses = (statuses ?? []) as SourceMonthlyStatus[]

  const statusMap = new Map(monthStatuses.map(s => [s.user_source_id, s]))

  const items: ChecklistItem[] = activeSources.map(source => {
    const status = statusMap.get(source.id)
    return {
      id: `source-${source.id}`,
      label: `${source.bank_name}${source.nickname ? ` (${source.nickname})` : ''}`,
      type: 'source' as const,
      done: status?.loaded === true,
      sourceId: source.id,
      sourceType: source.type,
    }
  })

  const hasIncome = (incomeEntries ?? []).length > 0 &&
    (incomeEntries ?? []).some((e: { amount: number }) => e.amount > 0)

  items.push({
    id: 'income',
    label: 'Ingresos del mes confirmados',
    type: 'income',
    done: hasIncome,
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
