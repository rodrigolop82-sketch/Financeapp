'use client'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { GoalsSummaryCard } from '@/components/goals/GoalsSummaryCard'
import { GoalCard } from '@/components/goals/GoalCard'
import { useGoals } from '@/hooks/useGoals'

export default function MetasPage() {
  const { goals, totalSaved, totalTarget, isLoading, error, reload } = useGoals()
  const activeGoals = goals.filter((g) => g.status === 'active')
  const completedGoals = goals.filter((g) => g.status === 'completed')

  return (
    <AppShell title="Mis metas" currentPath="/metas">
      {/* Top-right add button */}
      {!isLoading && !error && goals.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Link href="/metas/nueva" style={{
            width: 42, height: 42, borderRadius: '50%',
            background: '#DBEAFE',
            border: '1.5px solid #93C5FD',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none', color: '#2563EB', fontSize: 22, fontWeight: 600,
          }}>
            +
          </Link>
        </div>
      )}

      {isLoading ? (
        <div>
          <div style={{
            height: 110, borderRadius: 16, marginBottom: 16,
            background: '#E2E8F0',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          {[1, 2].map((i) => (
            <div key={i} style={{
              height: 110, borderRadius: 14, marginBottom: 10,
              background: '#E2E8F0',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontSize: 14, color: '#EF4444', marginBottom: 12 }}>{error}</p>
          <button
            onClick={reload}
            style={{
              padding: '10px 24px', borderRadius: 10,
              background: '#2563EB', border: 'none',
              color: 'white', fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      ) : goals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🎯</p>
          <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.6, marginBottom: 20 }}>
            Crea tu primera meta y Zafi te dirá cuándo la alcanzarás
          </p>
          <Link href="/metas/nueva" style={{
            display: 'inline-block', padding: '14px 28px',
            background: '#2563EB', borderRadius: 12,
            color: 'white', fontSize: 15, fontWeight: 600,
            textDecoration: 'none',
          }}>
            ＋ Crear nueva meta
          </Link>
        </div>
      ) : (
        <div>
          <GoalsSummaryCard
            totalSaved={totalSaved}
            totalTarget={totalTarget}
            activeCount={activeGoals.length}
          />

          {activeGoals.length > 0 && (
            <p style={{
              fontSize: 11, fontWeight: 700, color: '#10B981',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 10,
            }}>
              Activas
            </p>
          )}

          {activeGoals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}

          {completedGoals.length > 0 && (
            <>
              <p style={{
                fontSize: 11, fontWeight: 700, color: '#94A3B8',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                margin: '20px 0 10px',
              }}>
                Completadas
              </p>
              {completedGoals.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </>
          )}
        </div>
      )}

      <div className="h-6" />
    </AppShell>
  )
}
