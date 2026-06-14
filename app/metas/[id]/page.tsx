'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { GoalDetailHero } from '@/components/goals/GoalDetailHero'
import { ContributionHistory } from '@/components/goals/ContributionHistory'
import { AddContributionSheet } from '@/components/goals/AddContributionSheet'
import { useGoals, type Goal, type Contribution } from '@/hooks/useGoals'
import { formatMoney } from '@/lib/format'
import { Loader2 } from 'lucide-react'

export interface SeasonalBoost {
  label: string
  amount: number
  newDate: string
}

export default function GoalDetailPage() {
  const params = useParams()
  const goalId = params.id as string
  const { goals, addContribution, getContributionHistory, isLoading } = useGoals()
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contribLoading, setContribLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [seasonalBoost] = useState<SeasonalBoost | null>(null)

  const goal: Goal | undefined = goals.find((g) => g.id === goalId)

  const loadContributions = useCallback(async () => {
    if (!goalId) return
    setContribLoading(true)
    try {
      const data = await getContributionHistory(goalId)
      setContributions(data)
    } catch {
      // silently fail
    } finally {
      setContribLoading(false)
    }
  }, [goalId, getContributionHistory])

  useEffect(() => {
    if (!isLoading && goal) {
      loadContributions()
    }
  }, [isLoading, goal, loadContributions])

  if (isLoading) {
    return (
      <AppShell title="Meta" currentPath="/metas">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 className="w-8 h-8 text-electric animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!goal) {
    return (
      <AppShell title="Meta" currentPath="/metas">
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px 0' }}>
          Meta no encontrada
        </p>
      </AppShell>
    )
  }

  const monthlyRate = goal.monthlyContribution ?? 0

  return (
    <AppShell title="Detalle de meta" currentPath="/metas">
      <GoalDetailHero
        emoji={goal.emoji}
        name={goal.name}
        currentAmount={goal.currentAmount}
        targetAmount={goal.targetAmount}
      />

      {/* Projection banner */}
      {goal.projection.status !== 'completed' && goal.projection.status !== 'no_data' && (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 20 }}>📅</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>
              {goal.projection.status === 'on_track'
                ? `A este ritmo: ${goal.projection.estimatedDate?.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}`
                : goal.projection.message
              }
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
              {monthlyRate > 0 && goal.projection.monthsRemaining
                ? `Con tu aporte mensual de ${formatMoney(monthlyRate)}, alcanzas tu meta en ${goal.projection.monthsRemaining} meses.`
                : ''}
              {seasonalBoost && (
                <> Si {seasonalBoost.label} se asigna aquí ({formatMoney(seasonalBoost.amount)}), la adelantas a {seasonalBoost.newDate}.</>
              )}
            </p>
          </div>
        </div>
      )}

      {goal.projection.status === 'no_data' && (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            {goal.projection.message}
          </p>
        </div>
      )}

      {/* Contribution history */}
      <p style={{
        fontSize: 11, fontWeight: 700, color: '#60A5FA',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 10,
      }}>
        Historial de aportes
      </p>
      <ContributionHistory contributions={contributions} isLoading={contribLoading} />

      {/* Spacer for floating FAB */}
      <div className="h-24" />

      {/* Floating Abonar FAB */}
      {goal.status === 'active' && (
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom))',
            right: 20,
            zIndex: 30,
            padding: '14px 28px',
            background: '#2563EB',
            border: 'none',
            borderRadius: 50,
            color: 'white',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          💰 Abonar
        </button>
      )}

      <AddContributionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        goalName={goal.name}
        goalEmoji={goal.emoji}
        currentAmount={goal.currentAmount}
        targetAmount={goal.targetAmount}
        onConfirm={async (amount, note) => {
          await addContribution(goalId, amount, note)
          await loadContributions()
        }}
        monthlyContribution={goal.monthlyContribution}
      />
    </AppShell>
  )
}
