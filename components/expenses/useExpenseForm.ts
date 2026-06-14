'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { localToday, localMonthStart } from '@/lib/dates'
import type { BudgetCategory } from '@/types'

export interface CategoryWithProgress extends BudgetCategory {
  spentAmount: number
  percentage: number
}

interface UseExpenseFormProps {
  householdId: string
  categories: BudgetCategory[]
  onSuccess: () => void
}

export interface UseExpenseFormReturn {
  amount: string
  setAmount: (v: string) => void
  selectedCategory: BudgetCategory | null
  setSelectedCategory: (cat: BudgetCategory) => void
  note: string
  setNote: (v: string) => void
  isSubmitting: boolean
  isSuccess: boolean
  recentCategories: BudgetCategory[]
  allCategories: CategoryWithProgress[]
  submit: () => Promise<void>
  reset: () => void
}

export function useExpenseForm({
  householdId,
  categories,
  onSuccess,
}: UseExpenseFormProps): UseExpenseFormReturn {
  const [amount, setAmount] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [recentCategories, setRecentCategories] = useState<BudgetCategory[]>([])
  const [spentByCat, setSpentByCat] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!householdId || categories.length === 0) return
    void loadCategoryData()
  }, [householdId, categories.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCategoryData() {
    const supabase = createClient()
    const { data: txData } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('household_id', householdId)
      .gte('date', localMonthStart())

    if (!txData) return

    const spent: Record<string, number> = {}
    const counts: Record<string, number> = {}
    for (const tx of txData) {
      if (tx.category_id) {
        spent[tx.category_id] = (spent[tx.category_id] ?? 0) + Number(tx.amount)
        counts[tx.category_id] = (counts[tx.category_id] ?? 0) + 1
      }
    }

    setSpentByCat(spent)

    const recent = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => categories.find(c => c.id === id))
      .filter((c): c is BudgetCategory => c !== undefined)

    setRecentCategories(recent)
  }

  const allCategories: CategoryWithProgress[] = categories.map(cat => {
    const spent = spentByCat[cat.id] ?? 0
    return {
      ...cat,
      spentAmount: spent,
      percentage: cat.budgeted_amount > 0
        ? Math.min((spent / cat.budgeted_amount) * 100, 100)
        : 0,
    }
  })

  async function submit() {
    const num = parseFloat(amount)
    if (!num || num <= 0) return

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('transactions').insert({
      household_id: householdId,
      amount: num,
      description: note.trim() || null,
      category_id: selectedCategory?.id ?? null,
      date: localToday(),
      source: 'manual' as const,
    })
    setIsSubmitting(false)

    if (!error) {
      setIsSuccess(true)
      onSuccess()
    }
  }

  function reset() {
    setAmount('')
    setSelectedCategory(null)
    setNote('')
    setIsSubmitting(false)
    setIsSuccess(false)
  }

  return {
    amount, setAmount,
    selectedCategory, setSelectedCategory,
    note, setNote,
    isSubmitting, isSuccess,
    recentCategories, allCategories,
    submit, reset,
  }
}
