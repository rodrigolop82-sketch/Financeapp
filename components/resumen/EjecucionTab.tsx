'use client'
import { HeroCard } from './HeroCard'
import { StatsRow } from './StatsRow'
import { StreakCardResumen } from './StreakCardResumen'
import { CategoryList } from './CategoryList'
import { SmartAlert } from '@/components/dashboard/SmartAlert'
import type { MonthExecutionData } from '@/hooks/useMonthExecution'

interface EjecucionTabProps {
  data: MonthExecutionData
}

export function EjecucionTab({ data }: EjecucionTabProps) {
  return (
    <div>
      <HeroCard
        spent={data.spentMonth}
        budget={data.budget}
        daysLeft={data.daysLeft}
      />
      <StatsRow
        dailyAvg={data.dailyAvg}
        projectedSavings={data.projectedSavings}
      />
      {data.alert && <SmartAlert alert={data.alert} />}
      <StreakCardResumen
        currentStreak={data.currentStreak}
        bestStreak={data.bestStreak}
        weekDays={data.weekDayStatus}
      />
      <CategoryList categories={data.categories} />
    </div>
  )
}
