'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CapsuleCard } from '@/components/education/CapsuleCard'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

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
  const [moduleColor, setModuleColor] = useState('#7C3AED')
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
        supabase.from('users').select('plan').eq('id', user.id).single(),
        supabase.from('user_capsule_progress').select('capsule_id').eq('user_id', user.id),
      ])

      if (moduleRes.data) {
        setModuleTitle(moduleRes.data.title)
        setModuleDescription(moduleRes.data.description)
        setModuleColor(moduleRes.data.color)
      }
      setCapsules(capsulesRes.data ?? [])
      setUserPlan(userRes.data?.plan ?? 'free')
      setReadIds(new Set(progressRes.data?.map(p => p.capsule_id) ?? []))
      setLoading(false)
    }
    load()
  }, [moduleSlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  const readCount = capsules.filter(c => readIds.has(c.id)).length
  const progressPct = capsules.length > 0 ? Math.round(readCount / capsules.length * 100) : 0

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-2">
        <Link href="/aprende" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Aprende
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-medium text-foreground" style={{ color: moduleColor }}>
          {moduleTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{moduleDescription}</p>
        {readCount > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{readCount} de {capsules.length} completadas</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: moduleColor }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
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
      </div>
    </div>
  )
}
