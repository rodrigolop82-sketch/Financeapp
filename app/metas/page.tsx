'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { useMoneyFormat } from '@/lib/format'
import { Loader2, Plus, Trophy, Target, TrendingUp } from 'lucide-react'

interface SavingsGoal {
  id: string
  name: string
  icon: string
  target_amount: number
  saved_amount: number
  monthly_contribution: number
  target_date: string | null
  color: string
}

const GOAL_ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10l5-4 5 4v6H3V10zM6 16v-3h4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  car: <path d="M3 10l1.5-4h7L13 10M3 10v3h2v-1h6v1h2v-3M3 10h10M5.5 12a.5.5 0 100-1 .5.5 0 000 1zM10.5 12a.5.5 0 100-1 .5.5 0 000 1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  shield: <path d="M8 2L3 5v3c0 3.5 2.5 6 5 7 2.5-1 5-3.5 5-7V5L8 2z" stroke="currentColor" strokeWidth="1.3" fill="none"/>,
  plane: <path d="M2 8h4l2-5 2 5h4l-1.5 2H10l-1 4H7l-1-4H3.5L2 8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  book: <path d="M4 3h8v11H4zM4 3c1 0 4 .5 4 2M4 14c1 0 4-.5 4-2M8 5v7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  star: <path d="M8 2l1.8 3.6L14 6.2l-3 2.9.7 4.1L8 11.3l-3.7 1.9.7-4.1-3-2.9 4.2-.6L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>,
}

const PLACEHOLDER_GOALS: SavingsGoal[] = [
  { id: '1', name: 'Fondo de emergencia', icon: 'shield', target_amount: 15000, saved_amount: 8400, monthly_contribution: 800, target_date: null, color: '#2563EB' },
  { id: '2', name: 'Viaje familiar', icon: 'plane', target_amount: 12000, saved_amount: 3200, monthly_contribution: 600, target_date: '2027-06-01', color: '#8B5CF6' },
  { id: '3', name: 'Entrada de casa', icon: 'home', target_amount: 80000, saved_amount: 22000, monthly_contribution: 1500, target_date: '2029-01-01', color: '#059669' },
]

function GoalIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 12,
      background: `${color}15`, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, color,
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {GOAL_ICONS[icon] ?? GOAL_ICONS.star}
      </svg>
    </div>
  )
}

function monthsRemaining(targetDate: string | null, savedAmount: number, targetAmount: number, monthlyContribution: number): number | null {
  if (monthlyContribution <= 0) return null
  const remaining = targetAmount - savedAmount
  if (remaining <= 0) return 0
  return Math.ceil(remaining / monthlyContribution)
}

export default function MetasPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const { money } = useMoneyFormat()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      try {
        const { data } = await supabase
          .from('savings_goals')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })

        if (data && data.length > 0) {
          setGoals(data.map((g: Record<string, unknown>) => ({
            id: g.id as string,
            name: g.name as string,
            icon: (g.icon as string) ?? 'star',
            target_amount: g.target_amount as number,
            saved_amount: (g.saved_amount as number) ?? 0,
            monthly_contribution: (g.monthly_contribution as number) ?? 0,
            target_date: (g.target_date as string) ?? null,
            color: (g.color as string) ?? '#2563EB',
          })))
        } else {
          setGoals(PLACEHOLDER_GOALS)
        }
      } catch {
        setGoals(PLACEHOLDER_GOALS)
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric-light animate-spin" />
      </div>
    )
  }

  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalMonthly = goals.reduce((s, g) => s + g.monthly_contribution, 0)

  const closestGoal = goals.length > 0
    ? goals.reduce((best, g) => {
        const pct = g.target_amount > 0 ? g.saved_amount / g.target_amount : 0
        const bestPct = best.target_amount > 0 ? best.saved_amount / best.target_amount : 0
        return pct > bestPct && pct < 1 ? g : best
      }, goals[0])
    : null

  return (
    <AppShell
      title="Metas"
      currentPath="/metas"
      headerRight={
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#2563EB', color: '#fff',
          border: 'none', borderRadius: 10, padding: '8px 16px',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={16} strokeWidth={2.5} />
          Nueva meta
        </button>
      }
    >
      <div style={{ fontSize: 14, color: '#8B9AAE', marginBottom: 20, marginTop: -8 }}>
        {goals.length} meta{goals.length !== 1 ? 's' : ''} activa{goals.length !== 1 ? 's' : ''}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Total saved - navy card */}
        <div style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #2A4A6E 100%)',
          borderRadius: 16, padding: '20px 22px', color: '#fff',
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' as const,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Trophy size={13} />
            Ahorrado en total
          </div>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: 26, marginTop: 8,
          }}>
            {money(totalSaved)}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            de {money(totalTarget)} total
          </div>
        </div>

        {/* Closest goal */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            color: '#8B9AAE', textTransform: 'uppercase' as const,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Target size={13} />
            Meta más cercana
          </div>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: 20, color: '#1E3A5F', marginTop: 8,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {closestGoal?.name ?? '—'}
          </div>
          <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 2 }}>
            {closestGoal ? `${Math.round((closestGoal.saved_amount / closestGoal.target_amount) * 100)}% completada` : '—'}
          </div>
        </div>

        {/* Monthly suggestion */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            color: '#8B9AAE', textTransform: 'uppercase' as const,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <TrendingUp size={13} />
            Aporte mensual
          </div>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: 26, color: '#1E3A5F', marginTop: 8,
          }}>
            {money(totalMonthly)}
          </div>
          <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 2 }}>
            sugerido
          </div>
        </div>
      </div>

      {/* Goal cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {goals.map(goal => {
          const pct = goal.target_amount > 0
            ? Math.min(Math.round((goal.saved_amount / goal.target_amount) * 100), 100)
            : 0
          const months = monthsRemaining(goal.target_date, goal.saved_amount, goal.target_amount, goal.monthly_contribution)

          return (
            <div key={goal.id} style={{
              background: '#fff', borderRadius: 16, padding: '20px 22px',
              display: 'flex', gap: 14, alignItems: 'flex-start',
              cursor: 'pointer',
            }}>
              <GoalIcon icon={goal.icon} color={goal.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F' }}>
                      {goal.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 2 }}>
                      {money(goal.saved_amount)} de {money(goal.target_amount)}
                      {months != null && months > 0 && ` · ${months} mes${months !== 1 ? 'es' : ''}`}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: goal.color,
                    flexShrink: 0, marginLeft: 8,
                  }}>
                    {pct}%
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{
                  height: 6, background: '#F1F5F9', borderRadius: 3,
                  marginTop: 12, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: goal.color,
                    width: `${pct}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {goals.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          color: '#8B9AAE', fontSize: 14,
        }}>
          Aún no tenés metas de ahorro. Creá tu primera meta para empezar.
        </div>
      )}
    </AppShell>
  )
}
