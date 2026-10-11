'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { Chevron, ErrorBox, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, ListCard, PageHeader, ROW_DIVIDER, PillButton } from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { CARD } from '@/components/resumen/ctf-ui'
import { MerchantAvatar, PriceUpBadge } from '@/components/recurring/ui'
import { postJson, useRecurring } from '@/components/recurring/useRecurring'
import { shortDate } from '@/lib/cuenta'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'

const BACK = { href: '/resumen', label: 'Cómo te fue' }

export default function SuscripcionesPage() {
  const fmt = useFormatMoney()
  const { state, reload } = useRecurring()
  const [showCancelled, setShowCancelled] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const clearMessage = useCallback(() => setMessage(null), [])

  const active = useMemo(() => (state.status === 'ok' ? state.data.charges.filter((c) => c.status === 'active') : []), [state])
  const cancelled = useMemo(() => (state.status === 'ok' ? state.data.charges.filter((c) => c.status === 'possibly_cancelled') : []), [state])

  if (state.status === 'loading') return <PageSkeleton variant="list" />

  async function markCancelled(merchantKey: string, name: string) {
    const r = await postJson('/api/recurring/override', { merchantKey, status: 'cancelled_by_user' })
    setMessage(r.ok ? { text: `${name} marcada como cancelada`, tone: 'ok' } : { text: r.error ?? 'No se pudo guardar', tone: 'error' })
    if (r.ok) await reload()
  }

  const data = state.status === 'ok' ? state.data : null
  const t = data?.totals
  const top2 = [...active].sort((a, b) => b.typicalAmount - a.typicalAmount).slice(0, 2)
  const top2Total = top2.reduce((s, c) => s + c.typicalAmount, 0)

  return (
    <AppShell title="Suscripciones" currentPath="/resumen/suscripciones" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader
          back={BACK}
          title="Suscripciones"
          subtitle={active.length > 0 ? `Zafi detectó ${active.length} ${active.length === 1 ? 'cobro que se repite' : 'cobros que se repiten'} cada mes` : undefined}
        />

        {state.status === 'error' && (
          <div className="mt-3.5 flex flex-col gap-2">
            <ErrorBox>No pudimos calcular tus cobros recurrentes.</ErrorBox>
            <PillButton onClick={() => void reload()}>Reintentar</PillButton>
          </div>
        )}

        {data && active.length === 0 && cancelled.length === 0 && (
          <div className={`mt-3.5 flex flex-col gap-1.5 p-5 ${CARD}`}>
            <span className={`text-[17px] font-bold ${TEXT_STRONG}`}>Aún no detectamos cobros recurrentes</span>
            <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
              Zafi los encuentra cuando tienes 3 meses de gastos registrados.
            </span>
          </div>
        )}

        {data && t && active.length > 0 && (
          <>
            <section className={`mt-3.5 flex flex-col gap-1 border border-electric/30 p-5 ${HERO}`} style={HERO_STYLE}>
              <span className={`text-[13px] font-semibold ${HERO_MUTED}`}>Total mensual</span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-outfit text-[40px] font-extrabold leading-none">{fmt(t.monthlyTotal)}</span>
                <span className={`text-sm ${HERO_MUTED}`}>/ mes</span>
              </span>
              <span className={`text-sm ${HERO_MUTED}`}>{fmt(t.annualTotal)} al año</span>
              {data.pctOfSpending !== null && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-white/15" aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, data.pctOfSpending)}%`, background: '#60A5FA' }} />
                  </div>
                  <span className={`text-[13px] ${HERO_MUTED}`}>≈ {data.pctOfSpending}% de tu gasto mensual</span>
                </div>
              )}
              {t.priceIncrease > 0 && (
                <span className="mt-2 self-start rounded-full px-2.5 py-1 text-[12.5px] font-bold" style={{ background: 'rgba(245,158,11,0.18)', color: '#F59E0B' }}>
                  Sube {fmt(t.priceIncrease)} vs. mes anterior
                </span>
              )}
            </section>

            <GroupTitle>Próximos cobros</GroupTitle>
            <ListCard>
              {active.map((c) => (
                <Link
                  key={c.merchantKey}
                  href={`/resumen/suscripciones/${encodeURIComponent(c.merchantKey)}`}
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

            {top2.length === 2 && (
              <div className={`mt-3.5 flex flex-col gap-2 p-4 ${CARD}`}>
                <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Zafi sugiere</span>
                <span className={`text-[15px] leading-[1.45] ${TEXT_STRONG}`}>
                  Tus 2 cobros más altos ({top2[0].displayName} y {top2[1].displayName}) suman {fmt(top2Total)} al mes.
                </span>
                <Link
                  href={`/resumen/suscripciones/${encodeURIComponent(active[0].merchantKey)}`}
                  className="flex h-11 items-center self-start rounded-full bg-electric px-4 text-sm font-semibold text-white"
                >
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
