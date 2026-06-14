'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useDynamicChallenges, type Challenge } from '@/hooks/useDynamicChallenges'
import { Loader2 } from 'lucide-react'

const STATUS_CONFIG: Record<Challenge['status'], { label: string; bg: string; color: string; border: string; barColor: string }> = {
  on_track: { label: 'En camino', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', barColor: '#2563EB' },
  at_risk: { label: 'En riesgo', bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', barColor: '#F59E0B' },
  completed: { label: '¡Logrado!', bg: '#F0FDF4', color: '#065F46', border: '#BBF7D0', barColor: '#10B981' },
  failed: { label: 'Excedido', bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', barColor: '#EF4444' },
}

const CATEGORY_LABELS: Record<string, string> = {
  spending: 'Gasto',
  saving: 'Ahorro',
  habits: 'Hábitos',
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const config = STATUS_CONFIG[challenge.status]
  const isInverse = challenge.category === 'spending' && challenge.status !== 'completed'

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${config.border}`,
      padding: '16px 18px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 24 }}>{challenge.icon}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1E3A5F', margin: 0, lineHeight: 1.3 }}>
              {challenge.title}
            </p>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: config.bg, color: config.color,
              display: 'inline-block', marginTop: 4,
            }}>
              {config.label}
            </span>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
          background: '#F1F5F9', color: '#64748B',
        }}>
          {CATEGORY_LABELS[challenge.category]}
        </span>
      </div>

      <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px', lineHeight: 1.5 }}>
        {challenge.description}
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${isInverse ? Math.min(challenge.progress, 100) : challenge.progress}%`,
            background: config.barColor,
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>
          {challenge.unit === 'Q'
            ? `Q${challenge.current.toLocaleString()} / Q${challenge.target.toLocaleString()}`
            : `${challenge.current} / ${challenge.target} ${challenge.unit}`
          }
        </span>
        <span style={{
          fontSize: 13, fontWeight: 800, color: config.color,
          fontFamily: 'Outfit, sans-serif',
        }}>
          {challenge.progress}%
        </span>
      </div>
    </div>
  )
}

export default function PlanPage() {
  const { challenges, loading, error } = useDynamicChallenges()

  const completed = challenges.filter(c => c.status === 'completed').length
  const total = challenges.length
  const overallProgress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <AppShell title="Retos del mes" currentPath="/plan">
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2 className="w-8 h-8 text-electric animate-spin" />
        </div>
      )}

      {error && (
        <div style={{ margin: '0 16px', padding: '16px', background: '#FFF5F5', borderRadius: 12, color: '#DC2626', fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div>
          {/* Hero */}
          <div style={{
            margin: '0 16px 16px',
            padding: '18px 20px',
            background: 'linear-gradient(135deg, #0F1F36, #1E3A5F)',
            borderRadius: 16,
            color: '#fff',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Progreso general
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 800, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>
                {completed}/{total}
              </span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                retos completados
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${overallProgress}%`,
                background: completed === total && total > 0 ? '#10B981' : '#2563EB',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '8px 0 0', textAlign: 'right' }}>
              {overallProgress}% completado
            </p>
          </div>

          {/* Subtitle */}
          <div style={{ margin: '0 16px 12px' }}>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              Retos generados automáticamente a partir de tus gastos reales. El progreso se actualiza solo.
            </p>
          </div>

          {/* Challenge cards */}
          <div style={{ margin: '0 16px' }}>
            {challenges.map(c => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>

          {challenges.length === 0 && (
            <div style={{
              margin: '0 16px', padding: '40px 20px', textAlign: 'center',
              background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0',
            }}>
              <p style={{ fontSize: 32, margin: '0 0 8px' }}>🎯</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F', margin: '0 0 4px' }}>
                Sin datos suficientes
              </p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                Registrá gastos por unos días para que se generen tus retos.
              </p>
            </div>
          )}

          <div className="h-6" />
        </div>
      )}
    </AppShell>
  )
}
