'use client'
import { formatMoney } from '@/lib/format'
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
  const delta = data.spentMonth - data.spentLastMonth
  const isUp = delta > 0

  return (
    <div>
      <HeroCard
        spent={data.spentMonth}
        budget={data.budget}
        daysLeft={data.daysLeft}
      />

      {/* Month-over-month comparison */}
      {data.spentLastMonth > 0 && (
        <div style={{
          margin: '0 16px 12px',
          padding: '12px 16px',
          background: isUp ? '#FEF2F2' : '#F0FDF4',
          borderRadius: 12,
          border: `1px solid ${isUp ? '#FECACA' : '#BBF7D0'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: isUp ? '#991B1B' : '#065F46' }}>
              {isUp ? '↑' : '↓'} {Math.abs(data.monthDeltaPct)}% vs mes anterior
            </span>
            <span style={{ fontSize: 11, color: isUp ? '#B91C1C' : '#047857', marginLeft: 8 }}>
              ({isUp ? '+' : ''}{formatMoney(delta)})
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            Ant: {formatMoney(data.spentLastMonth)}
          </span>
        </div>
      )}

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
