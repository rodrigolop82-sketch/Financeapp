'use client'

import Link from 'next/link'

const ICON_MAP: Record<string, string> = {
  'credit-card': '💳',
  'trending-down': '📉',
  'pie-chart': '🥧',
  'trending-up': '📈',
  'home': '🏠',
}

interface ModuleCardProps {
  slug: string
  title: string
  description: string
  icon: string
  color: string
  isPremium: boolean
  isLocked: boolean
  totalCapsules: number
  completed: number
}

export function ModuleCard({
  slug, title, description, icon, color,
  isPremium, isLocked, totalCapsules, completed,
}: ModuleCardProps) {
  const progressPct = totalCapsules > 0
    ? Math.round(completed / totalCapsules * 100)
    : 0

  return (
    <Link
      href={isLocked ? '/cuenta?upgrade=true' : `/aprende/${slug}`}
      className="block p-4 bg-background border rounded-xl hover:border-electric-soft
                 transition-colors relative overflow-hidden"
    >
      {/* Barra de progreso sutil en el fondo */}
      {progressPct > 0 && (
        <div
          className="absolute inset-y-0 left-0 bg-surface-tint opacity-60 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      )}

      <div className="relative flex items-center gap-4">
        {/* Ícono del módulo */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '20' }}
        >
          <span className="text-xl" style={{ color }}>
            {ICON_MAP[icon] ?? '📚'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-foreground">{title}</p>
            {isPremium && isLocked && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full
                               bg-amber-100 text-amber-800">Premium</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {description}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {completed}/{totalCapsules} cápsulas
            {progressPct > 0 && ` · ${progressPct}% completado`}
          </p>
        </div>

        <svg className="w-4 h-4 text-muted-foreground flex-shrink-0"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    </Link>
  )
}
