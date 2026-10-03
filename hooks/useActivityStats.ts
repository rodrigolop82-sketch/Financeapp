'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { localDaysAgo, localMonthStart, localToday } from '@/lib/dates'

export interface ActivityStats {
  spentToday: number
  todayCount: number
  spentWeek: number
  /** % de cambio contra los 7 días anteriores. */
  weekVsPrev: number
  spentMonth: number
  /** Lo planeado en categorías de gasto activas (0 = sin plan). */
  monthBudget: number
  currentStreak: number
  bestStreak: number
  weekDayStatus: ('done' | 'today' | 'miss')[]
}

/**
 * Actividad del mes en curso: gastos de hoy/semana/mes y racha de días con
 * registros. Antes vivía en Inicio; ahora la usa Cómo te fue (/resumen).
 */
export function useActivityStats(householdId: string | null): ActivityStats | null {
  const [stats, setStats] = useState<ActivityStats | null>(null)

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    const supabase = createClient()
    const today = localToday()
    const monthStart = localMonthStart()
    const weekStart = localDaysAgo(7)
    const prevWeekStart = localDaysAgo(14)

    Promise.all([
      supabase.from('transactions').select('amount, date').eq('household_id', householdId).eq('type', 'expense').gte('date', monthStart),
      supabase.from('transactions').select('amount').eq('household_id', householdId).eq('type', 'expense').gte('date', prevWeekStart).lt('date', weekStart),
      supabase.from('transactions').select('date').eq('household_id', householdId),
      supabase.from('budget_categories').select('budgeted_amount, bucket, archived_at').eq('household_id', householdId),
    ]).then(([monthRes, prevRes, datesRes, catsRes]) => {
      if (cancelled) return
      const month = (monthRes.data ?? []) as { amount: number; date: string }[]
      const prev = (prevRes.data ?? []) as { amount: number }[]
      const allDates = (datesRes.data ?? []) as { date: string }[]
      const cats = (catsRes.data ?? []) as { budgeted_amount: number; bucket: string; archived_at: string | null }[]

      const spentMonth = month.reduce((s, t) => s + Number(t.amount), 0)
      const spentToday = month.filter((t) => t.date === today).reduce((s, t) => s + Number(t.amount), 0)
      const todayCount = month.filter((t) => t.date === today).length
      const spentWeek = month.filter((t) => t.date >= weekStart).reduce((s, t) => s + Number(t.amount), 0)
      const spentPrevWeek = prev.reduce((s, t) => s + Number(t.amount), 0)
      const weekVsPrev = spentPrevWeek > 0 ? Math.round((spentWeek - spentPrevWeek) / spentPrevWeek * 100) : 0
      const monthBudget = cats
        .filter((c) => c.bucket !== 'income' && !c.archived_at)
        .reduce((s, c) => s + Math.max(0, Number(c.budgeted_amount) || 0), 0)

      const txDates = new Set(month.map((t) => t.date))
      let currentStreak = 0
      let offset = txDates.has(today) ? 0 : 1
      while (txDates.has(localDaysAgo(offset))) { currentStreak++; offset++ }

      const sorted = Array.from(new Set(allDates.map((r) => r.date))).sort()
      let bestStreak = 0
      let run = 0
      let prevDate: string | null = null
      for (const d of sorted) {
        const gap = prevDate
          ? Math.round((new Date(d + 'T12:00:00').getTime() - new Date(prevDate + 'T12:00:00').getTime()) / 86400000)
          : 0
        run = prevDate && gap === 1 ? run + 1 : 1
        bestStreak = Math.max(bestStreak, run)
        prevDate = d
      }
      bestStreak = Math.max(bestStreak, currentStreak)

      const now = new Date()
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
      const weekDayStatus = Array.from({ length: 7 }, (_, i): 'done' | 'today' | 'miss' => {
        const ds = localDaysAgo(dayOfWeek - i)
        if (ds === today) return 'today'
        return txDates.has(ds) ? 'done' : 'miss'
      })

      setStats({ spentToday, todayCount, spentWeek, weekVsPrev, spentMonth, monthBudget, currentStreak, bestStreak, weekDayStatus })
    })
    return () => { cancelled = true }
  }, [householdId])

  return stats
}
