'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { AppShell } from '@/components/layout/AppShell'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ScoreComponentBar } from '@/components/score/ScoreComponentBar'
import { ScoreSparkline } from '@/components/score/ScoreSparkline'
import { useHealthScore } from '@/hooks/useHealthScore'
import { getRecommendedCapsules } from '@/lib/capsule-recommendations'
import { CapsuleRecommendations } from '@/components/education/CapsuleRecommendations'
import { ChevronLeft, Loader2 } from 'lucide-react'
import type { Household, CapsuleRecommendation } from '@/types'

export default function ScorePage() {
  const router = useRouter()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [household, setHousehold] = useState<Household | null>(null)
  const [recommendations, setRecommendations] = useState<CapsuleRecommendation[]>([])
  const { score, history, loading } = useHealthScore(householdId)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { router.push('/onboarding'); return }

      setHouseholdId(hh.id)
      setUserId(user.id)
      setHousehold(hh as Household)
      const name = (userProfile?.full_name || 'Usuario') as string
      setUserName(name.split(' ')[0])
    }
    init()
  }, [router])

  useEffect(() => {
    if (!userId || !score || score.components.length === 0) return
    getRecommendedCapsules(userId, score.components).then(setRecommendations).catch(() => {})
  }, [userId, score])

  if (!householdId || loading || !score) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    )
  }

  return (
    <AppShell title="Health Score" currentPath="/score" userName={userName} householdName={household?.name ?? ''}>
      {/* Back button */}
      <div style={{ padding: '12px 16px 0' }}>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-navy/60 hover:text-navy transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14 }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="font-sans font-medium">Volver</span>
        </button>
      </div>

      {/* Hero score */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 16px 24px',
      }}>
        <ScoreRing score={score.total} size={140} strokeWidth={8} variant="light" />
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <span className="font-outfit font-bold text-navy" style={{ fontSize: 20 }}>
            {score.emoji} {score.label}
          </span>
        </div>
      </div>

      {/* Components breakdown */}
      <div style={{
        margin: '0 16px 16px',
        padding: 16,
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(30,58,95,0.06)',
      }}>
        <h2 className="font-outfit font-bold text-navy" style={{ fontSize: 15, marginBottom: 14 }}>
          Desglose
        </h2>
        {score.components.map((c) => (
          <ScoreComponentBar key={c.key} component={c} />
        ))}
      </div>

      {/* History sparkline */}
      <div style={{
        margin: '0 16px 16px',
        padding: 16,
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(30,58,95,0.06)',
      }}>
        <h2 className="font-outfit font-bold text-navy" style={{ fontSize: 15, marginBottom: 12 }}>
          Evolución
        </h2>
        <ScoreSparkline data={history} />
      </div>

      {/* Insights */}
      {score.components.some(c => c.score < c.max * 0.5) && (
        <div style={{
          margin: '0 16px 16px',
          padding: 16,
          background: '#FFFBEB',
          borderRadius: 14,
          border: '1px solid #FDE68A',
        }}>
          <h2 className="font-outfit font-bold" style={{ fontSize: 15, marginBottom: 8, color: '#92400E' }}>
            Áreas de mejora
          </h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {score.components
              .filter(c => c.score < c.max * 0.5)
              .map(c => (
                <li key={c.key} className="font-sans text-amber-900" style={{ fontSize: 13, marginBottom: 4 }}>
                  {c.tip}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Capsule recommendations */}
      {recommendations.length > 0 && (
        <div style={{ margin: '0 16px 16px' }}>
          <h2 className="font-outfit font-bold text-navy" style={{ fontSize: 15, marginBottom: 10 }}>
            Mejora tu puntaje
          </h2>
          <CapsuleRecommendations recommendations={recommendations} />
        </div>
      )}

      <div className="h-24" />
    </AppShell>
  )
}
