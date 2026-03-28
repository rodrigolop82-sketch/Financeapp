'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ModuleCard } from '@/components/education/ModuleCard'
import { ArrowLeft, Loader2 } from 'lucide-react'
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

export default function AprendePage() {
  const [modules, setModules] = useState<ModuleData[]>([])
  const [userPlan, setUserPlan] = useState<'free' | 'premium'>('free')
  const [loading, setLoading] = useState(true)

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

      // Count completed capsules per module
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
        setModules(modulesRes.data.map((m: any) => ({
          ...m,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          total_capsules: (m.capsules as any)?.[0]?.count ?? 0,
          completed: completedByModule[m.id] ?? 0,
        })))
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-medium text-foreground">Aprende</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cápsulas de 3–5 minutos conectadas a tu situación financiera real
        </p>
      </div>

      <div className="space-y-3">
        {modules.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              Los módulos de educación todavía no están disponibles.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ejecutá la migración de base de datos para cargar el contenido.
            </p>
          </div>
        )}
        {modules.map(mod => (
          <ModuleCard
            key={mod.id}
            slug={mod.slug}
            title={mod.title}
            description={mod.description}
            icon={mod.icon}
            color={mod.color}
            isPremium={mod.is_premium}
            isLocked={mod.is_premium && userPlan === 'free'}
            totalCapsules={mod.total_capsules}
            completed={mod.completed}
          />
        ))}
      </div>
    </div>
  )
}
