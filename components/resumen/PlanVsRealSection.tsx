'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { categoryPlan, planSummary } from '@/lib/plan-del-mes'
import { monthRange } from '@/lib/movimientos'
import { BudgetHealthHero } from '@/components/presupuesto/BudgetHealthHero'
import { BudgetComparativo } from '@/components/presupuesto/BudgetComparativo'
import type { BudgetCategory, BudgetSubItem, IncomeEntry } from '@/types'

/**
 * "Salud de tu presupuesto" y el comparativo real vs. plan. Antes vivían en
 * /presupuesto; desde el Plan del mes (Fase 5) se ven aquí, en "Cómo te fue".
 */
export function PlanVsRealSection({ initialMonth }: { initialMonth: string }) {
  const fmt = useFormatMoney()
  const supabase = useMemo(() => createClient(), [])
  const [householdId, setHouseholdId] = useState('')
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [subItems, setSubItems] = useState<BudgetSubItem[]>([])
  const [incomes, setIncomes] = useState<IncomeEntry[]>([])
  const [month, setMonth] = useState(initialMonth)
  const [spent, setSpent] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState<0 | 1 | 2>(0)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => { setMonth(initialMonth) }, [initialMonth])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const hh = await getUserHousehold(supabase, user.id)
      if (!hh || cancelled) return
      const [{ data: cats }, { data: subs }, { data: entries }] = await Promise.all([
        supabase.from('budget_categories').select('*').eq('household_id', hh.id),
        supabase.from('budget_sub_items').select('*').eq('household_id', hh.id),
        supabase.from('income_entries').select('*').eq('household_id', hh.id),
      ])
      if (cancelled) return
      setCategories(((cats ?? []) as BudgetCategory[]).filter((c) => !c.archived_at && c.bucket !== 'income'))
      setSubItems((subs ?? []) as BudgetSubItem[])
      setIncomes((entries ?? []) as IncomeEntry[])
      setHouseholdId(hh.id as string)
    }
    void load()
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    setLoading(true)
    const { from, to } = monthRange(month)
    supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('household_id', householdId)
      .eq('type', 'expense')
      .gte('date', from)
      .lte('date', to)
      .then(({ data }: { data: { category_id: string; amount: number }[] | null }) => {
        if (cancelled) return
        const byCat: Record<string, number> = {}
        for (const t of data ?? []) byCat[t.category_id] = (byCat[t.category_id] ?? 0) + Number(t.amount)
        setSpent(byCat)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [supabase, householdId, month])

  const getCategoryTotal = useCallback((id: string) => {
    const c = categories.find((x) => x.id === id)
    return c ? categoryPlan(c, subItems) : 0
  }, [categories, subItems])

  if (!householdId || categories.length === 0) return null
  const s = planSummary(categories, subItems, incomes)

  return (
    <section aria-label="Tu plan contra lo real" style={{ marginTop: 24 }}>
      <BudgetHealthHero
        income={s.income}
        bucketTotals={{ needs: s.needs, wants: s.wants, savings: s.savings }}
        categories={categories}
        spentByCategory={spent}
        expandedGroups={expandedGroups}
        onToggleGroup={(b) => setExpandedGroups((prev) => {
          const next = new Set(prev)
          if (next.has(b)) next.delete(b); else next.add(b)
          return next
        })}
        getCategoryTotal={getCategoryTotal}
        fmt={fmt}
      />
      <BudgetComparativo
        level={level}
        onSetLevel={setLevel}
        month={month}
        onMonthChange={setMonth}
        categories={categories}
        spentByCategory={spent}
        totalBudgeted={s.assigned}
        loading={loading}
        getCategoryTotal={getCategoryTotal}
        fmt={fmt}
      />
    </section>
  )
}
