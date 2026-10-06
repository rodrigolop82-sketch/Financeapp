'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { isEffectivelyPremium } from '@/lib/plans'
import { CapsuleCard } from '@/components/education/CapsuleCard'
import { AppShell } from '@/components/layout/AppShell'
import { GroupTitle, ListCard, PageHeader } from '@/components/layout/Pantalla'
import { TEXT_MUTED } from '@/components/movimientos/ui'
import { ProgressBar } from '@/components/plan/ui'
import { PageSkeleton } from '@/components/motion/PageSkeleton'

interface CapsuleData {
  id: string
  slug: string
  title: string
  subtitle: string | null
  read_time_minutes: number
  is_premium: boolean
  order_index: number
}

export default function ModulePage() {
  const params = useParams()
  const moduleSlug = params.module as string
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')
  const [capsules, setCapsules] = useState<CapsuleData[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [userPlan, setUserPlan] = useState<'free' | 'premium'>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [moduleRes, capsulesRes, userRes, progressRes] = await Promise.all([
        supabase.from('capsule_modules').select('*').eq('slug', moduleSlug).single(),
        supabase.from('capsules')
          .select('id, slug, title, subtitle, read_time_minutes, is_premium, order_index')
          .eq('module_id', (await supabase.from('capsule_modules').select('id').eq('slug', moduleSlug).single()).data?.id)
          .order('order_index'),
        supabase.from('users').select('plan, trial_ends_at').eq('id', user.id).single(),
        supabase.from('user_capsule_progress').select('capsule_id').eq('user_id', user.id),
      ])

      if (moduleRes.data) {
        setModuleTitle(moduleRes.data.title)
        setModuleDescription(moduleRes.data.description)
      }
      setCapsules(capsulesRes.data ?? [])
      setUserPlan(userRes.data && isEffectivelyPremium(userRes.data) ? 'premium' : 'free')
      setReadIds(new Set(progressRes.data?.map(p => p.capsule_id) ?? []))
      setLoading(false)
    }
    load()
  }, [moduleSlug])

  if (loading) {
    return <PageSkeleton variant="list" />
  }

  const readCount = capsules.filter(c => readIds.has(c.id)).length
  const progressPct = capsules.length > 0 ? Math.round(readCount / capsules.length * 100) : 0

  return (
    <AppShell title={moduleTitle || 'Aprende'} currentPath="/aprende" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/aprende', label: 'Aprende' }} title={moduleTitle} subtitle={moduleDescription} />
        <div className="flex flex-col zafi-stagger">
          {readCount > 0 && (
            <div className="mt-3.5 flex flex-col gap-1.5">
              <span className={`flex justify-between px-1 text-[13px] ${TEXT_MUTED}`}>
                <span>{readCount} de {capsules.length} leídas</span>
                <span className="font-outfit font-semibold">{progressPct}%</span>
              </span>
              <ProgressBar ratio={progressPct / 100} />
            </div>
          )}
          <section>
            <GroupTitle>Lecciones</GroupTitle>
            <ListCard>
              {capsules.map(cap => (
                <CapsuleCard
                  key={cap.id}
                  moduleSlug={moduleSlug}
                  slug={cap.slug}
                  title={cap.title}
                  subtitle={cap.subtitle}
                  readTimeMinutes={cap.read_time_minutes}
                  isPremium={cap.is_premium}
                  isLocked={cap.is_premium && userPlan === 'free'}
                  isRead={readIds.has(cap.id)}
                />
              ))}
            </ListCard>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
