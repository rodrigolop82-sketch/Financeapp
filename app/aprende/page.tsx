'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { isEffectivelyPremium } from '@/lib/plans'
import { AppShell } from '@/components/layout/AppShell'
import { ParaTi } from '@/components/education/ParaTi'
import Link from 'next/link'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { CARD } from '@/components/resumen/ctf-ui'
import { TEXT_FAINT, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import {
  BADGE_OK, BADGE_WARN, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, ListCard, PageHeader, ROW_DIVIDER, Tile,
} from '@/components/layout/Pantalla'

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

interface NextCapsule {
  title: string
  slug: string
}

const SUBTITLE = 'Lecciones de 3 a 5 minutos sobre tu dinero.'

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
  const [nextCapsule, setNextCapsule] = useState<NextCapsule | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [modulesRes, userRes, progressRes] = await Promise.all([
        supabase.from('capsule_modules').select('*, capsules(count)').order('order_index'),
        supabase.from('users').select('plan, trial_ends_at').eq('id', user.id).single(),
        supabase.from('user_capsule_progress').select('capsule_id, capsules!inner(module_id)').eq('user_id', user.id),
      ])

      setUserPlan(userRes.data && isEffectivelyPremium(userRes.data) ? 'premium' : 'free')

      const completedByModule: Record<string, number> = {}
      const doneIds = new Set<string>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progressRes.data?.forEach((p: any) => {
        doneIds.add(p.capsule_id)
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
        if (inProgress) {
          setContinueModule(inProgress)
          // La siguiente lección sin terminar del módulo.
          const { data: caps } = await supabase
            .from('capsules')
            .select('id, title, slug')
            .eq('module_id', inProgress.id)
            .order('order_index')
          const next = (caps ?? []).find((c: { id: string }) => !doneIds.has(c.id))
          if (next) setNextCapsule({ title: next.title, slug: next.slug })
        }
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <PageSkeleton variant="list" />
  }

  const cont = continueModule
  const contPct = cont && cont.total_capsules > 0 ? (cont.completed / cont.total_capsules) * 100 : 0

  return (
    <AppShell title="Aprende" currentPath="/aprende" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/mas', label: 'Más' }} title="Aprende" subtitle={SUBTITLE} />
        <p className={`hidden text-sm lg:block ${TEXT_MUTED}`}>{SUBTITLE}</p>

        {/* Sigue donde ibas */}
        {cont && (
          <Link
            href={nextCapsule ? `/aprende/${cont.slug}/${nextCapsule.slug}` : `/aprende/${cont.slug}`}
            className={`mt-3.5 flex flex-col gap-1.5 p-5 transition-transform duration-150 active:scale-[0.98] ${HERO}`}
            style={HERO_STYLE}
          >
            <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${HERO_MUTED}`}>Sigue donde ibas</span>
            <span className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-serif text-[22px] leading-[1.2]">{cont.title}</span>
                <span className={`text-sm ${HERO_MUTED}`}>
                  {cont.completed} de {cont.total_capsules} lecciones{nextCapsule ? ` · sigue: “${nextCapsule.title}”` : ''}
                </span>
              </span>
              <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-electric text-base">▶</span>
            </span>
            <span className="mt-1.5 h-1.5 overflow-hidden rounded bg-white/[0.14]">
              <span className="block h-full rounded bg-electric-pale" style={{ width: `${contPct}%` }} />
            </span>
          </Link>
        )}

        <ParaTi />

        {modules.length === 0 ? (
          <div className={`mt-3.5 p-5 text-sm ${CARD} ${TEXT_MUTED}`}>
            Las lecciones todavía no están disponibles. Vuelve pronto.
          </div>
        ) : (
          <>
            <GroupTitle>Todos los temas</GroupTitle>
            <ListCard>
              {modules.map(mod => {
                const isLocked = mod.is_premium && userPlan === 'free'
                const pct = mod.total_capsules > 0 ? Math.round((mod.completed / mod.total_capsules) * 100) : 0
                const done = mod.total_capsules > 0 && pct === 100
                return (
                  <Link
                    key={mod.id}
                    href={isLocked ? '/cuenta?upgrade=true' : `/aprende/${mod.slug}`}
                    className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}
                  >
                    <Tile>{ICON_MAP[mod.icon] ?? '📚'}</Tile>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{mod.title}</span>
                        {isLocked ? <span className={BADGE_WARN}>Premium</span> : done && <span className={BADGE_OK}>Listo</span>}
                      </span>
                      <span className={`text-[13px] leading-[1.35] ${TEXT_MUTED}`}>{mod.description}</span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded bg-[var(--zafi-border-light)]">
                          <span className={`block h-full rounded ${done ? 'bg-success-dark' : 'bg-electric'}`} style={{ width: `${pct}%` }} />
                        </span>
                        <span className={`font-outfit text-[12.5px] font-semibold ${TEXT_MUTED}`}>{mod.completed}/{mod.total_capsules}</span>
                      </span>
                    </span>
                    <span aria-hidden className={`flex-none font-bold ${TEXT_FAINT}`}>{isLocked ? '🔒' : '›'}</span>
                  </Link>
                )
              })}
            </ListCard>
          </>
        )}
      </div>
    </AppShell>
  )
}
