'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { BADGE_OK, BADGE_WARN, ErrorBox, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, ListCard, PageHeader, PillButton, ROW_DIVIDER } from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { CARD } from '@/components/resumen/ctf-ui'
import { PremiumAction } from '@/components/premium/PremiumTag'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import type { SnapshotView } from '@/lib/snapshot/data'
import { addDays, insightText, VERDICT_COPY, weekRangeLabel, type Verdict } from '@/lib/snapshot/weekly'

type Resp = (SnapshotView & { features: { aiCommentary: boolean } }) | { empty: true }
type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: Resp }

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_LABELS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const VERDICT_DOT: Record<Verdict, string> = { en_linea: '#10B981', en_riesgo: '#F59E0B', sobre_ritmo: '#EF4444' }
const BACK = { href: '/resumen', label: 'Cómo te fue' }

function SemanaContent() {
  const params = useSearchParams()
  const router = useRouter()
  const fmt = useFormatMoney()
  const w = params?.get('w') ?? ''
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const qs = new URLSearchParams({ visto: '1' })
      if (w) qs.set('w', w)
      const res = await fetch(`/api/snapshot?${qs}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setState({ status: 'ok', data: (await res.json()) as Resp })
    } catch {
      setState({ status: 'error' })
    }
  }, [w])
  useEffect(() => { void load() }, [load])

  if (state.status === 'loading') return <PageSkeleton variant="detail" />

  const data = state.status === 'ok' && !('empty' in state.data) ? state.data : null
  const s = data?.snapshot
  const go = (week: string) => router.replace(`/resumen/semana?w=${week}`)

  const header = (
    <PageHeader
      back={BACK}
      title="Tu semana"
      subtitle={s ? weekRangeLabel(s.weekStart) : undefined}
      right={data && s ? (
        <div className="flex gap-1">
          <button type="button" aria-label="Semana anterior" disabled={s.weekStart <= data.firstWeek} onClick={() => go(addDays(s.weekStart, -7))}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold disabled:opacity-30 ${TEXT_STRONG}`}>‹</button>
          <button type="button" aria-label="Semana siguiente" disabled={s.weekStart >= data.latestWeek} onClick={() => go(addDays(s.weekStart, 7))}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold disabled:opacity-30 ${TEXT_STRONG}`}>›</button>
        </div>
      ) : undefined}
    />
  )

  if (!s || !data) {
    return (
      <AppShell title="Tu semana" currentPath="/resumen/semana" hideMobileBar>
        <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
          {header}
          {state.status === 'error' ? (
            <div className="mt-3.5 flex flex-col gap-2">
              <ErrorBox>No pudimos calcular tu semana.</ErrorBox>
              <PillButton onClick={() => void load()}>Reintentar</PillButton>
            </div>
          ) : (
            <div className={`mt-3.5 flex flex-col gap-1.5 p-5 ${CARD}`}>
              <span className={`text-[17px] font-bold ${TEXT_STRONG}`}>Aún no tienes una semana completa</span>
              <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Tu primer resumen llega el lunes después de tu primera semana registrando gastos.</span>
            </div>
          )}
        </div>
      </AppShell>
    )
  }

  const maxDay = Math.max(...s.byDay.map((d) => d.amount), 0)
  const topIdx = maxDay > 0 ? s.byDay.findIndex((d) => d.amount === maxDay) : -1
  const deterministic = insightText(s, fmt)
  const showVerdict = s.verdict && !s.isSparse

  return (
    <AppShell title="Tu semana" currentPath="/resumen/semana" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        {header}

        <section className={`mt-3.5 flex flex-col gap-1.5 p-5 ${HERO}`} style={HERO_STYLE}>
          {showVerdict && s.verdict && (
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: VERDICT_DOT[s.verdict] }} />
              {VERDICT_COPY[s.verdict]}
            </span>
          )}
          <span className="flex items-baseline gap-2">
            <span className="font-outfit text-[40px] font-extrabold leading-none">{fmt(s.totalVariable)}</span>
            <span className={`text-sm ${HERO_MUTED}`}>gastados</span>
          </span>
          {showVerdict && s.expectedVariable !== null && s.deltaVsExpectedPct !== null && (
            <span className={`text-sm leading-[1.45] ${HERO_MUTED}`}>
              Esperabas llegar a {fmt(s.expectedVariable)}: vas {Math.abs(s.deltaVsExpectedPct)}% {s.deltaVsExpectedPct <= 0 ? 'por debajo' : 'por encima'} del ritmo.
            </span>
          )}
          {s.expectedVariable === null && data.avgPrevWeeks !== null && (
            <span className={`text-sm leading-[1.45] ${HERO_MUTED}`}>
              Tu promedio de las semanas anteriores es {fmt(data.avgPrevWeeks)}.
            </span>
          )}
          {s.fixedPaid > 0 && (
            <span className={`text-[13px] ${HERO_MUTED}`}>Además pagaste {fmt(s.fixedPaid)} en gastos fijos.</span>
          )}
        </section>

        {s.isSparse && (
          <p className={`mx-1 mt-3 text-[13.5px] leading-[1.45] ${TEXT_MUTED}`}>
            Registraste pocos gastos esta semana. Con más registros, tu resumen será más útil.
          </p>
        )}

        <GroupTitle>Gasto por día</GroupTitle>
        <div className={`p-4 ${CARD}`}>
          <div className="flex h-36 items-end gap-2" role="list" aria-label="Gasto por día">
            {s.byDay.map((d, i) => {
              const h = maxDay > 0 ? Math.max(4, Math.round((d.amount / maxDay) * 100)) : 4
              const top = i === topIdx
              return (
                <div key={d.date} role="listitem" aria-label={`${DAY_LABELS[i]}: ${fmt(d.amount)}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  {top && <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: '#B45309' }}>{fmt(d.amount)}</span>}
                  <div className="w-full rounded-t-md" style={{ height: `${h}%`, background: top ? '#F59E0B' : d.amount > 0 ? '#2563EB' : '#CBD5E1' }} />
                  <span className={`text-[12px] font-semibold ${TEXT_MUTED}`} aria-hidden>{DAY_LETTERS[i]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {s.topCategories.length > 0 && (
          <>
            <GroupTitle>Lo que más pesó</GroupTitle>
            <ListCard>
              {s.topCategories.map((c) => (
                <div key={c.categoryId || c.name} className={`flex min-h-[52px] items-center gap-2 py-3 ${ROW_DIVIDER}`}>
                  <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{c.name}</span>
                  {c.deltaVsPrevWeek !== null && (c.deltaVsPrevWeek > 0
                    ? <span className={BADGE_WARN}>+{fmt(c.deltaVsPrevWeek)}</span>
                    : <span className={BADGE_OK}>En línea</span>)}
                  <span className={`font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{fmt(c.amount)}</span>
                </div>
              ))}
            </ListCard>
          </>
        )}

        <GroupTitle>Lo que Zafi notó</GroupTitle>
        <div className={`flex flex-col gap-3 p-4 ${CARD}`}>
          <p className={`text-[15px] leading-[1.5] ${TEXT_STRONG}`}>
            {data.aiCommentary ?? deterministic ?? 'Tu gasto estuvo repartido durante la semana, sin un día ni una categoría que destaque.'}
          </p>
          {s.surplusVsExpected !== null && s.surplusVsExpected >= 1 && (
            data.suggestedSaving ? (
              <Link
                href={`/metas/${data.suggestedSaving.goalId}?aportar=${data.suggestedSaving.amount}`}
                className="flex h-11 items-center self-start rounded-full bg-electric px-4 text-sm font-semibold text-white"
              >
                Ahorrar {fmt(data.suggestedSaving.amount)} en {data.suggestedSaving.goalName}
              </Link>
            ) : !data.features.aiCommentary ? (
              <PremiumAction from="snapshot" className="self-start">
                <span className={`text-sm font-semibold ${TEXT_STRONG}`}>Ahorrar {fmt(Math.floor(s.surplusVsExpected))}</span>
              </PremiumAction>
            ) : null
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default function SemanaPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <SemanaContent />
    </Suspense>
  )
}
