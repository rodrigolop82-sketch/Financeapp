'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { GoalDetailHero } from '@/components/goals/GoalDetailHero'
import { ContributionHistory } from '@/components/goals/ContributionHistory'
import { AddContributionSheet } from '@/components/goals/AddContributionSheet'
import { useGoals, type Goal, type Contribution } from '@/hooks/useGoals'
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

  const projectionColor = goal.projection.status === 'behind' ? '#FCD34D' :
    goal.projection.status === 'completed' ? '#34D399' : 'rgba(255,255,255,0.6)'

  const projectionIcon = goal.projection.status === 'on_track' ? '📅' :
    goal.projection.status === 'behind' ? '⚠️' :
    goal.projection.status === 'completed' ? '✅' : ''

  return (
    <AppShell title={goal.name} currentPath="/metas">
      <GoalDetailHero
        emoji={goal.emoji}
        name={goal.name}
        currentAmount={goal.currentAmount}
        targetAmount={goal.targetAmount}
      />

      {/* Projection banner */}
      {goal.projection.status !== 'completed' && (
        <div style={{
          background: goal.projection.status === 'behind'
            ? 'rgba(252,211,77,0.08)'
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${goal.projection.status === 'behind'
            ? 'rgba(252,211,77,0.2)'
            : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 13, color: projectionColor }}>
            {projectionIcon} {goal.projection.message}
          </p>

          {/* Seasonal boost slot — ready for Feature 3 */}
          {seasonalBoost && (
            <p style={{ fontSize: 12, color: '#93C5FD', marginTop: 6 }}>
              💰 Si {seasonalBoost.label} se asigna aquí ({`Q${seasonalBoost.amount.toLocaleString('es-GT')}`}), la adelantas a {seasonalBoost.newDate}
            </p>
          )}
        </div>
      )}

      {/* Add contribution button */}
      {goal.status === 'active' && (
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            width: '100%', padding: '14px',
            background: '#2563EB', border: 'none',
            borderRadius: 12, color: 'white',
            fontSize: 15, fontWeight: 600,
            cursor: 'pointer', marginBottom: 20,
          }}
        >
          + Registrar abono
        </button>
      )}

      {/* Contribution history */}
      <p style={{
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 10,
      }}>
        Historial de aportes
      </p>
      <ContributionHistory contributions={contributions} isLoading={contribLoading} />

      <div className="h-6" />

      <AddContributionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConfirm={async (amount, note) => {
          await addContribution(goalId, amount, note)
          await loadContributions()
        }}
        monthlyContribution={goal.monthlyContribution}
      />
    </AppShell>
  )
}
