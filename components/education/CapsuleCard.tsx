'use client'

import Link from 'next/link'
import { BADGE_OK, BADGE_WARN, Chevron, ROW_DIVIDER, RowBody, Tile } from '@/components/layout/Pantalla'

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

/** Fila de lección (va dentro de un ListCard). */
export function CapsuleCard({
  moduleSlug, slug, title, subtitle,
  readTimeMinutes, isPremium, isLocked, isRead,
}: CapsuleCardProps) {
  const badge = isLocked && isPremium
    ? <span className={BADGE_WARN}>Premium</span>
    : isRead ? <span className={BADGE_OK}>Leída</span> : undefined
  return (
    <Link
      href={isLocked ? '/cuenta?upgrade=true' : `/aprende/${moduleSlug}/${slug}`}
      className={`flex min-h-16 items-center gap-3 py-2.5 transition duration-150 active:scale-[0.98] ${ROW_DIVIDER}`}
    >
      <RowBody
        tile={<Tile>{isLocked ? '🔒' : isRead ? '✅' : '📖'}</Tile>}
        name={title}
        badge={badge}
        help={[subtitle, `${readTimeMinutes} min`].filter(Boolean).join(' · ')}
      />
      <Chevron />
    </Link>
  )
}
