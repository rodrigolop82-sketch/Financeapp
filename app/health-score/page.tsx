'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { calculateHealthScore, type ScoreBreakdown } from '@/lib/scoring'
import { Loader2, Lightbulb } from 'lucide-react'

const SCORE_COLORS: Record<string, string> = {
  red: '#EF4444',
  orange: '#F59E0B',
  yellow: '#EAB308',
  green: '#22C55E',
  emerald: '#10B981',
}

const SCORE_BG: Record<string, string> = {
  red: '#FEE2E2',
  orange: '#FEF3C7',
  yellow: '#FEF9C3',
  green: '#DCFCE7',
  emerald: '#D1FAE5',
}

const COMPONENT_INFO = [
  { key: 'savingsRate', label: 'Tasa de ahorro', max: 30, icon: '💰' },
  { key: 'debtBurden', label: 'Carga de deuda', max: 25, icon: '💳' },
  { key: 'emergencyFund', label: 'Fondo de emergencia', max: 20, icon: '🛡️' },
  { key: 'expenseRatio', label: 'Ratio de gastos', max: 15, icon: '📊' },
  { key: 'incomeStability', label: 'Estabilidad de ingreso', max: 10, icon: '📈' },
] as const

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const strokeColor = SCORE_COLORS[color] ?? '#8B9AAE'
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const pct = score / 100
  const dashOffset = circumference * (1 - pct * 0.75)

  return (
    <div style={{ position: 'relative', width: 200, height: 180, margin: '0 auto' }}>
      <svg width="200" height="180" viewBox="0 0 200 180">
        <circle
          cx="100" cy="110" r={radius}
          fill="none" stroke="#E2E8F0" strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          transform="rotate(135, 100, 110)"
        />
        <circle
          cx="100" cy="110" r={radius}
          fill="none" stroke={strokeColor} strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          transform="rotate(135, 100, 110)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -30%)', textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
          fontSize: 48, color: '#1E3A5F', lineHeight: 1,
        }}>
          {score}
        </div>
        <div style={{ fontSize: 13, color: '#8B9AAE', fontWeight: 600, marginTop: 4 }}>
          de 100
        </div>
      </div>
    </div>
  )
}

function ComponentBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const barColor = pct >= 70 ? '#22C55E' : pct >= 40 ? '#EAB308' : '#EF4444'

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1E3A5F' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: barColor }}>
          {value}/{max}
        </span>
      </div>
      <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          background: barColor, width: `${pct}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

export default function HealthScorePage() {
  const [score, setScore] = useState<ScoreBreakdown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('financial_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        const result = calculateHealthScore({
          total_income: profile.total_income ?? 0,
          total_fixed_expenses: profile.total_fixed_expenses ?? 0,
          total_debt: profile.total_debt ?? 0,
          total_savings: profile.total_savings ?? 0,
          has_emergency_fund: profile.has_emergency_fund ?? false,
          income_type: profile.income_type ?? 'fixed',
        })
        setScore(result)
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

  if (!score) {
    return (
      <AppShell title="Puntaje Zafi" currentPath="/health-score">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8B9AAE' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1E3A5F', marginBottom: 8 }}>
            Aún no tenemos datos
          </div>
          <div style={{ fontSize: 14 }}>
            Completá tu perfil financiero para calcular tu puntaje Zafi.
          </div>
        </div>
      </AppShell>
    )
  }

  const accentColor = SCORE_COLORS[score.color] ?? '#8B9AAE'
  const labelBg = SCORE_BG[score.color] ?? '#F1F5F9'

  return (
    <AppShell title="Puntaje Zafi" currentPath="/health-score">
      {/* Score gauge card */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #2A4A6E 100%)',
        borderRadius: 20, padding: '32px 24px 24px', marginBottom: 24,
        textAlign: 'center',
      }}>
        <ScoreGauge score={score.total} color={score.color} />
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: `${accentColor}25`, borderRadius: 20,
          padding: '6px 16px', marginTop: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: accentColor, marginRight: 8,
          }} />
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: accentColor, textTransform: 'capitalize',
          }}>
            {score.label}
          </span>
        </div>
      </div>

      {/* Breakdown card */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px 22px', marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
          color: '#8B9AAE', textTransform: 'uppercase' as const, marginBottom: 20,
        }}>
          Desglose del puntaje
        </div>

        {COMPONENT_INFO.map(({ key, label, max }) => (
          <ComponentBar
            key={key}
            label={label}
            value={score.components[key]}
            max={max}
            color={score.color}
          />
        ))}
      </div>

      {/* Insights card */}
      {score.insights.length > 0 && (
        <div style={{
          background: labelBg, borderRadius: 16,
          padding: '20px 22px', marginBottom: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          }}>
            <Lightbulb size={16} color={accentColor} />
            <span style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: accentColor, textTransform: 'uppercase' as const,
            }}>
              Sugerencias para mejorar
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {score.insights.map((insight, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: `${accentColor}20`, color: accentColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 14, color: '#1E3A5F', lineHeight: 1.5 }}>
                  {insight}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}
