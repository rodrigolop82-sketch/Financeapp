'use client'

import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalsSummaryCard } from '@/components/goals/GoalsSummaryCard'
import { useGoals } from '@/hooks/useGoals'
import { Loader2, Plus, Target } from 'lucide-react'

export default function MetasPage() {
  const router = useRouter()
  const { goals, totalSaved, totalTarget, isLoading, error } = useGoals()

  if (isLoading) {
    return (
      <AppShell title="Metas" currentPath="/metas">
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-electric animate-spin" />
        </div>
      </AppShell>
    )
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')
  const pausedGoals = goals.filter(g => g.status === 'paused')

  return (
    <AppShell
      title="Metas"
      currentPath="/metas"
      headerRight={
        <button
          onClick={() => router.push('/metas/nueva')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#2563EB', color: '#fff',
            border: 'none', borderRadius: 10, padding: '8px 16px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Nueva meta
        </button>
      }
    >
      {error && (
        <div style={{
          padding: '12px 16px', background: '#FEF2F2',
          border: '1px solid #FECACA', borderRadius: 12,
          fontSize: 14, color: '#991B1B', marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {goals.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#EFF6FF', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={28} style={{ color: '#2563EB' }} />
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', marginBottom: 6 }}>
              Aún no tenés metas de ahorro
            </p>
            <p style={{ fontSize: 14, color: '#8B9AAE', lineHeight: 1.5 }}>
              Creá tu primera meta para empezar a ahorrar con propósito.
            </p>
          </div>
          <button
            onClick={() => router.push('/metas/nueva')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#2563EB', color: '#fff',
              border: 'none', borderRadius: 12, padding: '14px 28px',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            Crear mi primera meta
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, color: '#8B9AAE', marginBottom: 16, marginTop: -8 }}>
            {activeGoals.length} meta{activeGoals.length !== 1 ? 's' : ''} activa{activeGoals.length !== 1 ? 's' : ''}
          </div>

          <GoalsSummaryCard
            totalSaved={totalSaved}
            totalTarget={totalTarget}
            activeCount={activeGoals.length}
          />

          {activeGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} />
          ))}

          {completedGoals.length > 0 && (
            <>
              <p style={{
                fontSize: 11, fontWeight: 700, color: '#059669',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginTop: 24, marginBottom: 10,
              }}>
                Completadas
              </p>
              {completedGoals.map(goal => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </>
          )}

          {pausedGoals.length > 0 && (
            <>
              <p style={{
                fontSize: 11, fontWeight: 700, color: '#94A3B8',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginTop: 24, marginBottom: 10,
              }}>
                Pausadas
              </p>
              {pausedGoals.map(goal => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </>
          )}
        </>
      )}

      <div className="h-24" />
    </AppShell>
  )
}
