'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useDynamicChallenges, type Challenge } from '@/hooks/useDynamicChallenges'
import { SkeletonRows } from '@/components/motion/PageSkeleton'
import {
  BADGE, BADGE_INFO, BADGE_NEUTRAL, BADGE_OK, BADGE_WARN, ErrorBox, GroupTitle, ListCard, PageHeader, ROW_DIVIDER, Tile,
} from '@/components/layout/Pantalla'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { PlanHero, ProgressBar } from '@/components/plan/ui'
import { formatMoney } from '@/lib/format'

const BADGE_DANGER = `${BADGE} bg-danger-light text-danger-text dark:bg-[var(--zafi-error-bg)] dark:text-[var(--zafi-error-text)]`

const STATUS: Record<Challenge['status'], { label: string; badge: string; color: string }> = {
  on_track: { label: 'En camino', badge: BADGE_INFO, color: '#2563EB' },
  at_risk: { label: 'En riesgo', badge: BADGE_WARN, color: '#F59E0B' },
  completed: { label: '¡Logrado!', badge: BADGE_OK, color: '#22C55E' },
  failed: { label: 'Excedido', badge: BADGE_DANGER, color: '#EF4444' },
}

const CATEGORY_LABELS: Record<Challenge['category'], string> = {
  spending: 'Gasto',
  saving: 'Ahorro',
  habits: 'Hábitos',
}

function amount(c: Challenge, n: number): string {
  return c.unit === 'Q' ? formatMoney(n) : `${n} ${c.unit}`
}

export default function RetosPage() {
  const { challenges, loading, error } = useDynamicChallenges()
  const completed = challenges.filter((c) => c.status === 'completed').length
  const total = challenges.length

  return (
    <AppShell title="Retos del mes" currentPath="/plan/retos" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/plan', label: 'Plan' }} title="Retos del mes" />

        {loading && <SkeletonRows count={4} className="mt-3.5" />}
        {error && <div className="mt-3.5"><ErrorBox>{error}</ErrorBox></div>}

        {!loading && !error && (
          <div className="flex flex-col zafi-stagger">
            {total === 0 ? (
              <div className={`mt-3.5 flex items-start gap-3 rounded-2xl bg-[var(--zafi-card-alt)] px-4 py-3.5 text-sm leading-[1.45] ${TEXT_MUTED}`}>
                <span aria-hidden className="text-xl leading-none">🎯</span>
                <span><b className={TEXT_STRONG}>Sin datos suficientes.</b> Registra gastos por unos días para que se generen tus retos.</span>
              </div>
            ) : (
              <>
                <PlanHero
                  label="Retos completados"
                  amount={`${completed} de ${total}`}
                  sub="Salen de tus gastos reales y se actualizan solos."
                  pct={total > 0 ? completed / total : 0}
                />
                <section>
                  <GroupTitle>Este mes</GroupTitle>
                  <ListCard>
                    {challenges.map((c) => {
                      const st = STATUS[c.status]
                      const pct = c.target > 0 ? Math.round((c.current / c.target) * 100) : c.progress
                      return (
                        <div key={c.id} className={`flex flex-col gap-2 py-3 ${ROW_DIVIDER}`}>
                          <div className="flex items-center gap-3">
                            <Tile>{c.icon}</Tile>
                            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                              <span className={`text-[15px] font-semibold leading-[1.3] ${TEXT_STRONG}`}>{c.title}</span>
                              <span className="flex gap-1.5">
                                <span className={st.badge}>{st.label}</span>
                                <span className={BADGE_NEUTRAL}>{CATEGORY_LABELS[c.category]}</span>
                              </span>
                            </span>
                            <span className="flex-none font-outfit text-base font-bold" style={{ color: st.color }}>
                              {Math.min(pct, 999)}%
                            </span>
                          </div>
                          <ProgressBar ratio={Math.min(1, pct / 100)} color={st.color} />
                          <span className={`flex justify-between gap-2 text-[13px] ${TEXT_MUTED}`}>
                            <span className="[text-wrap:pretty]">{c.description}</span>
                            <span className="flex-none font-outfit font-semibold">{amount(c, c.current)} / {amount(c, c.target)}</span>
                          </span>
                        </div>
                      )
                    })}
                  </ListCard>
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
