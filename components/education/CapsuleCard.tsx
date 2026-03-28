'use client'

import Link from 'next/link'
import { BookOpen, Check, Lock } from 'lucide-react'

interface CapsuleCardProps {
  moduleSlug: string
  slug: string
  title: string
  subtitle: string | null
  readTimeMinutes: number
  isPremium: boolean
  isLocked: boolean
  isRead: boolean
}

export function CapsuleCard({
  moduleSlug, slug, title, subtitle,
  readTimeMinutes, isPremium, isLocked, isRead,
}: CapsuleCardProps) {
  return (
    <Link
      href={isLocked ? '/cuenta?upgrade=true' : `/aprende/${moduleSlug}/${slug}`}
      className={`block p-4 border rounded-xl transition-colors hover:border-purple-300
        ${isRead ? 'bg-purple-50/50 border-purple-100' : 'bg-background'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
          ${isRead ? 'bg-purple-100' : 'bg-gray-100'}`}>
          {isLocked ? (
            <Lock className="w-4 h-4 text-amber-600" />
          ) : isRead ? (
            <Check className="w-4 h-4 text-purple-600" />
          ) : (
            <BookOpen className="w-4 h-4 text-gray-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${isRead ? 'text-purple-700' : 'text-foreground'}`}>
              {title}
            </p>
            {isPremium && isLocked && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Premium
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{subtitle}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{readTimeMinutes} min de lectura</p>
        </div>
        <svg className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    </Link>
  )
}
