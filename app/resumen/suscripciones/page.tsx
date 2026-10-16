'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { Chevron, ErrorBox, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, LINK_TEXT, ListCard, PageHeader, ROW_DIVIDER, PillButton } from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { CARD } from '@/components/resumen/ctf-ui'
import { MerchantAvatar, PriceUpBadge } from '@/components/recurring/ui'
import { postJson, useRecurring } from '@/components/recurring/useRecurring'
import { shortDate } from '@/lib/cuenta'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'

const BACK = { href: '/resumen', label: 'Cómo te fue' }
const PLAN_HREF = '/plan'
const detailHref = (merchantKey: string) => `/resumen/suscripciones/${encodeURIComponent(merchantKey)}`

export default function SuscripcionesPage() {
  const fmt = useFormatMoney()
  const { state, reload } = useRecurring()
  const [showCancelled, setShowCancelled] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const clearMessage = useCallback(() => setMessage(null), [])

  const data = state.status === 'ok' ? state.data : null
  const plan = data?.plan
  const byKey = useMemo(() => new Map((data?.charges ?? []).map((c) => [c.merchantKey, c])), [data])
  const inPlan = useMemo(() => new Set((plan?.lines ?? []).map((l) => l.merchantKey).filter(Boolean)), [plan])
  // Detectados que no están en el plan.
  const outside = (data?.charges ?? []).filter((c) => c.status === 'active' && !inPlan.has(c.merchantKey))
  const cancelled = (data?.charges ?? []).filter((c) => c.status === 'possibly_cancelled' && !inPlan.has(c.merchantKey))

  if (state.status === 'loading') return <PageSkeleton variant="list" />

  async function markCancelled(merchantKey: string, name: string) {
    const r = await postJson('/api/recurring/override', { merchantKey, status: 'cancelled_by_user' })
    setMessage(r.ok ? { text: `${name} marcada como cancelada`, tone: 'ok' } : { text: r.error ?? 'No se pudo guardar', tone: 'error' })
    if (r.ok) await reload()
  }

  const lines = plan?.lines ?? []
  const count = lines.length + outside.length
  const top2 = [
    ...lines.map((l) => ({ name: l.name, amount: l.monthly, href: l.merchantKey ? detailHref(l.merchantKey) : PLAN_HREF })),
    ...outside.map((c) => ({ name: c.displayName, amount: c.typicalAmount, href: detailHref(c.merchantKey) })),
  ].sort((a, b) => b.amount - a.amount).slice(0, 2)
  const priceIncrease = data?.totals.priceIncrease ?? 0

  return (
    <AppShell title="Suscripciones" currentPath="/resumen/suscripciones" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader
          back={BACK}
          title="Suscripciones"
          subtitle={count > 0
            ? [
                lines.length > 0 ? `${lines.length} en tu plan` : null,
                outside.length > 0 ? `${outside.length} ${outside.length === 1 ? 'cobro detectado' : 'cobros detectados'} fuera del plan` : null,
              ].filter(Boolean).join(' · ')
            : undefined}
        />

        {state.status === 'error' && (
          <div className="mt-3.5 flex flex-col gap-2">
            <ErrorBox>No pudimos calcular tus suscripciones.</ErrorBox>
            <PillButton onClick={() => void reload()}>Reintentar</PillButton>
          </div>
        )}

        {data && count === 0 && cancelled.length === 0 && (
          <div className={`mt-3.5 flex flex-col gap-1.5 p-5 ${CARD}`}>
            <span className={`text-[17px] font-bold ${TEXT_STRONG}`}>Aún no tienes suscripciones</span>
            <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
              Agrégalas como partes de tu categoría Suscripciones en el Plan del mes. Zafi también detecta cobros que se repiten cuando tienes 3 meses de gastos registrados.
            </span>
            <Link href={PLAN_HREF} className={`flex h-11 items-center self-start text-sm font-semibold ${LINK_TEXT}`}>Ir al Plan del mes ›</Link>
          </div>
        )}

        {data && count > 0 && (
          <>
            <section className={`mt-3.5 flex flex-col gap-1 border border-electric/30 p-5 ${HERO}`} style={HERO_STYLE}>
              <span className={`text-[13px] font-semibold ${HERO_MUTED}`}>Total mensual</span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-outfit text-[40px] font-extrabold leading-none">{fmt(data.monthlyTotal)}</span>
                <span className={`text-sm ${HERO_MUTED}`}>/ mes</span>
              </span>
              <span className={`text-sm ${HERO_MUTED}`}>{fmt(data.monthlyTotal * 12)} al año</span>
              {data.pctOfSpending !== null && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, data.pctOfSpending)}%`, background: '#60A5FA' }} />
                  </div>
                  <span className={`text-[13px] ${HERO_MUTED}`}>≈ {data.pctOfSpending}% de tu gasto mensual</span>
                </div>
              )}
              {priceIncrease > 0 && (
                <span className="mt-2 self-start rounded-full px-2.5 py-1 text-[12.5px] font-bold" style={{ background: 'rgba(245,158,11,0.18)', color: '#F59E0B' }}>
                  Sube {fmt(priceIncrease)} vs. mes anterior
                </span>
              )}
            </section>

            {lines.length > 0 && (
              <>
                <GroupTitle>En tu plan · {fmt(plan!.monthlyTotal)}/mes</GroupTitle>
                <ListCard>
                  {lines.map((l) => {
                    const c = l.merchantKey ? byKey.get(l.merchantKey) : undefined
                    const body = (
                      <>
                        <MerchantAvatar name={l.name} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{l.name}</span>
                            {c && <PriceUpBadge charge={c} fmt={fmt} />}
                          </span>
                          {c?.status === 'possibly_cancelled' ? (
                            <span className="truncate text-[13px] font-semibold text-warning-text dark:text-warning">
                              Sin cobros desde {shortDate(`${c.lastDate}T12:00:00`)}, ¿la cancelaste?
                            </span>
                          ) : (
                            <span className={`truncate text-[13px] ${TEXT_MUTED}`}>
                              {c
                                ? `Próximo cobro ${shortDate(`${c.nextExpectedDate}T12:00:00`)} · último ${fmt(c.lastAmount)}`
                                : `${l.expectedDay ? `Día ${l.expectedDay} · ` : ''}Sin cobros detectados aún`}
                            </span>
                          )}
                        </span>
                        <span className={`flex-none font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{fmt(l.monthly)}</span>
                      </>
                    )
                    return c ? (
                      <Link key={l.id} href={detailHref(c.merchantKey)} className={`flex min-h-[60px] items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                        {body}
                        <Chevron />
                      </Link>
                    ) : (
                      <div key={l.id} className={`flex min-h-[60px] items-center gap-3 py-3 ${ROW_DIVIDER}`}>{body}</div>
                    )
                  })}
                </ListCard>
                <Link href={PLAN_HREF} className={`mt-1 flex h-11 items-center self-start px-1 text-[13px] font-semibold ${LINK_TEXT}`}>Editar en el Plan del mes ›</Link>
              </>
            )}

            {outside.length > 0 && (
              <>
                <GroupTitle>Detectadas fuera de tu plan</GroupTitle>
                <ListCard>
                  {outside.map((c) => (
                    <Link
                      key={c.merchantKey}
                      href={detailHref(c.merchantKey)}
                      className={`flex min-h-[60px] items-center gap-3 py-3 ${ROW_DIVIDER}`}
                    >
                      <MerchantAvatar name={c.displayName} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{c.displayName}</span>
                          <PriceUpBadge charge={c} fmt={fmt} />
                        </span>
                        <span className={`truncate text-[13px] ${TEXT_MUTED}`}>
                          {shortDate(`${c.nextExpectedDate}T12:00:00`)}{c.categoryName ? ` · ${c.categoryName}` : ''}
                        </span>
                      </span>
                      <span className={`flex-none font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{fmt(c.typicalAmount)}</span>
                      <Chevron />
                    </Link>
                  ))}
                </ListCard>
                <p className={`mx-1 mt-2 text-[13px] leading-[1.45] ${TEXT_MUTED}`}>
                  Cobros que se repiten cada mes y no encontramos en tu plan. Si son tuyos,{' '}
                  <Link href={PLAN_HREF} className={`font-semibold ${LINK_TEXT}`}>agrégalos a tu categoría Suscripciones</Link>.
                </p>
              </>
            )}

            {top2.length === 2 && (
              <div className={`mt-3.5 flex flex-col gap-2 p-4 ${CARD}`}>
                <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Zafi sugiere</span>
                <span className={`text-[15px] leading-[1.45] ${TEXT_STRONG}`}>
                  Tus 2 suscripciones más altas ({top2[0].name} y {top2[1].name}) suman {fmt(top2[0].amount + top2[1].amount)} al mes.
                </span>
                <Link href={top2[0].href} className="flex h-11 items-center self-start rounded-full bg-electric px-4 text-sm font-semibold text-white">
                  Revisar
                </Link>
              </div>
            )}
          </>
        )}

        {cancelled.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowCancelled((v) => !v)}
              aria-expanded={showCancelled}
              className={`flex h-11 w-full items-center justify-between px-1 text-[15px] font-semibold ${TEXT_STRONG}`}
            >
              Posiblemente canceladas ({cancelled.length})
              <span aria-hidden className={TEXT_MUTED}>{showCancelled ? '▴' : '▾'}</span>
            </button>
            {showCancelled && (
              <ListCard>
                {cancelled.map((c) => (
                  <div key={c.merchantKey} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                    <MerchantAvatar name={c.displayName} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{c.displayName}</span>
                      <span className={`text-[13px] ${TEXT_MUTED}`}>Último cobro {shortDate(`${c.lastDate}T12:00:00`)} · {fmt(c.lastAmount)}</span>
                    </span>
                    {data?.canWrite && (
                      <PillButton onClick={() => void markCancelled(c.merchantKey, c.displayName)}>Ya la cancelé</PillButton>
                    )}
                  </div>
                ))}
              </ListCard>
            )}
          </div>
        )}
      </div>
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  )
}
