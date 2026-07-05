'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { Loader2, BookOpen, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface ModuleData {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  color: string
  order_index: number
  is_premium: boolean
  total_capsules: number
  completed: number
}

const ICON_MAP: Record<string, string> = {
  'credit-card': '💳',
  'trending-down': '📉',
  'pie-chart': '🥧',
  'trending-up': '📈',
  'home': '🏠',
}

export default function AprendePage() {
  const [modules, setModules] = useState<ModuleData[]>([])
  const [userPlan, setUserPlan] = useState<'free' | 'premium'>('free')
  const [loading, setLoading] = useState(true)
  const [continueModule, setContinueModule] = useState<ModuleData | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [modulesRes, userRes, progressRes] = await Promise.all([
        supabase.from('capsule_modules').select('*, capsules(count)').order('order_index'),
        supabase.from('users').select('plan').eq('id', user.id).single(),
        supabase.from('user_capsule_progress').select('capsule_id, capsules!inner(module_id)').eq('user_id', user.id),
      ])

      setUserPlan(userRes.data?.plan ?? 'free')

      const completedByModule: Record<string, number> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progressRes.data?.forEach((p: any) => {
        const moduleId = p.capsules?.module_id
        if (moduleId) {
          completedByModule[moduleId] = (completedByModule[moduleId] ?? 0) + 1
        }
      })

      if (modulesRes.data && modulesRes.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = modulesRes.data.map((m: any) => ({
          ...m,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          total_capsules: (m.capsules as any)?.[0]?.count ?? 0,
          completed: completedByModule[m.id] ?? 0,
        }))
        setModules(mapped)

        const inProgress = mapped.find(
          (m: ModuleData) => m.completed > 0 && m.completed < m.total_capsules
        )
        if (inProgress) setContinueModule(inProgress)
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

  return (
    <AppShell title="Aprende" currentPath="/aprende">
      <div style={{ fontSize: 14, color: '#8B9AAE', marginBottom: 24, marginTop: -8 }}>
        Cápsulas de 3–5 minutos conectadas a tu situación financiera real
      </div>

      {/* Continue learning card */}
      {continueModule && (
        <Link href={`/aprende/${continueModule.slug}`} style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1E3A5F 0%, #2A4A6E 100%)',
            borderRadius: 20, padding: '24px 22px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 16,
            cursor: 'pointer',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <BookOpen size={24} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const,
                marginBottom: 4,
              }}>
                Continuar aprendiendo
              </div>
              <div style={{
                fontFamily: "'DM Serif Display', serif", fontSize: 18,
                color: '#fff', fontWeight: 400,
              }}>
                {continueModule.title}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                {continueModule.completed}/{continueModule.total_capsules} cápsulas completadas
              </div>
              {/* Progress bar */}
              <div style={{
                height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2,
                marginTop: 10, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: '#2563EB',
                  width: `${Math.round((continueModule.completed / continueModule.total_capsules) * 100)}%`,
                }} />
              </div>
            </div>
            <ChevronRight size={20} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
          </div>
        </Link>
      )}

      {/* Modules grid */}
      {modules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 14, color: '#8B9AAE' }}>
            Los módulos de educación todavía no están disponibles.
          </div>
          <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 4 }}>
            Ejecutá la migración de base de datos para cargar el contenido.
          </div>
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            color: '#8B9AAE', textTransform: 'uppercase' as const, marginBottom: 12,
          }}>
            Todos los módulos
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {modules.map(mod => {
              const isLocked = mod.is_premium && userPlan === 'free'
              const progressPct = mod.total_capsules > 0
                ? Math.round((mod.completed / mod.total_capsules) * 100)
                : 0

              return (
                <Link
                  key={mod.id}
                  href={isLocked ? '/cuenta?upgrade=true' : `/aprende/${mod.slug}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    background: '#fff', borderRadius: 16, padding: '20px 16px',
                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    minHeight: 140, display: 'flex', flexDirection: 'column',
                  }}>
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `${mod.color}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 12,
                    }}>
                      <span style={{ fontSize: 20 }}>
                        {ICON_MAP[mod.icon] ?? '📚'}
                      </span>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#1E3A5F',
                      marginBottom: 4, lineHeight: 1.3,
                    }}>
                      {mod.title}
                    </div>

                    {/* Description */}
                    <div style={{
                      fontSize: 12, color: '#8B9AAE', lineHeight: 1.4,
                      flex: 1,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                    }}>
                      {mod.description}
                    </div>

                    {/* Footer */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 6,
                      }}>
                        <span style={{ fontSize: 11, color: '#8B9AAE' }}>
                          {mod.completed}/{mod.total_capsules}
                        </span>
                        {mod.is_premium && isLocked && (
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            padding: '2px 8px', borderRadius: 8,
                            background: '#FEF3C7', color: '#92400E',
                          }}>
                            Premium
                          </span>
                        )}
                        {progressPct === 100 && (
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            padding: '2px 8px', borderRadius: 8,
                            background: '#D1FAE5', color: '#065F46',
                          }}>
                            Completado
                          </span>
                        )}
                      </div>
                      <div style={{
                        height: 4, background: '#F1F5F9', borderRadius: 2,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: progressPct === 100 ? '#22C55E' : mod.color,
                          width: `${progressPct}%`,
                        }} />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </AppShell>
  )
}
