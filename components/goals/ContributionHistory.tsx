'use client'
import { formatMoney } from '@/lib/format'
import type { Contribution } from '@/hooks/useGoals'
import { GroupTitle, ListCard, ROW_DIVIDER } from '@/components/layout/Pantalla'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { GREEN_TEXT } from '@/components/resumen/ctf-ui'
import { SkeletonRows } from '@/components/motion/PageSkeleton'

interface ContributionHistoryProps {
  contributions: Contribution[]
  isLoading: boolean
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "03 de octubre" (con año si no es el actual). */
export function contributionDate(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const base = `${String(d.getDate()).padStart(2, '0')} de ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`
}

/** "Aportes": encabezado con el conteo y lista estándar. */
export function ContributionHistory({ contributions, isLoading }: ContributionHistoryProps) {
  const n = contributions.length
  return (
    <section>
      <div className="flex items-baseline justify-between pr-1">
        <GroupTitle>Aportes</GroupTitle>
        {!isLoading && n > 0 && <span className={`text-[13px] ${TEXT_MUTED}`}>{n} {n === 1 ? 'aporte' : 'aportes'}</span>}
      </div>
      {isLoading ? (
        <SkeletonRows count={3} />
      ) : n === 0 ? (
        <p className={`px-1 py-4 text-sm ${TEXT_MUTED}`}>Aún no hay aportes. El primero es el más importante.</p>
      ) : (
        <ListCard>
          {contributions.map((c) => (
            <div key={c.id} className={`flex h-16 items-center gap-3 ${ROW_DIVIDER}`}>
              <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-success-light text-lg font-bold text-success-text dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]">
                ↑
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{c.note || 'Aporte'}</span>
                <span className={`text-[13px] ${TEXT_MUTED}`}>{contributionDate(c.createdAt)}</span>
              </span>
              <span className={`flex-none font-outfit text-base font-bold ${GREEN_TEXT}`}>+{formatMoney(c.amount)}</span>
            </div>
          ))}
        </ListCard>
      )}
    </section>
  )
}
