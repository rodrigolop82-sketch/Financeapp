'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBox, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, LINK_TEXT, ListCard, PageHeader, PillButton, ROW_DIVIDER } from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { DIVIDER, SOFT_BG, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { CARD } from '@/components/resumen/ctf-ui'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { PremiumBadge, upgradeHref } from '@/components/premium/PremiumTag'
import { NetWorthChart, SAMPLE_SERIES } from '@/components/networth/NetWorthChart'
import { AccountSheet, UpdateBalanceSheet } from '@/components/networth/SourceSheets'
import { useNetWorth } from '@/components/networth/useNetWorth'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { useMaskedFmt, usePrivacy } from '@/components/privacidad/PrivacyProvider'
import { AmortizacionDetalle } from '@/components/deudas/AmortizacionDetalle'
import { formatMonths } from '@/lib/deudas'
import { groupAssets, groupLiabilities, PURPOSE_LABEL, type Group } from '@/lib/networth/groups'
import type { HistoryPoint } from '@/lib/networth/compute'
import type { SourceView } from '@/lib/networth/data'

const BACK = { href: '/dashboard', label: 'Inicio' }

function updatedText(s: SourceView): string {
  if (s.fromDebts) return 'Desde Plan › Deudas'
  if (s.balance === null) return s.institution ? `${s.institution} · sin saldo` : 'Sin saldo'
  const d = s.daysSinceUpdate ?? 0
  const when = d <= 0 ? 'actualizado hoy' : d === 1 ? 'actualizado ayer' : `actualizado hace ${d} días`
  return s.institution ? `${s.institution} · ${when}` : when
}

function debtHelp(s: SourceView, fmt: (n: number) => string): string {
  const t = s.debtTerms
  if (!t) return updatedText(s)
  const parts: string[] = []
  if (t.debtType === 'loan' && t.purpose) parts.push(`${PURPOSE_LABEL[t.purpose].emoji} ${PURPOSE_LABEL[t.purpose].label}`)
  parts.push(t.interestRate ? `${t.interestRate}% anual` : 'sin interés')
  if (t.monthlyPayment) parts.push(`${fmt(t.monthlyPayment)}/mes`)
  if (t.debtType === 'loan' && t.monthsLeft) parts.push(`faltan ${formatMonths(t.monthsLeft)}`)
  return parts.join(' · ')
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className={`flex min-w-0 flex-col rounded-xl px-3 py-2 text-[12px] font-semibold ${SOFT_BG} ${TEXT_MUTED}`}>
      {label}
      <b className={`truncate font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{value}</b>
    </span>
  )
}

/** Deuda de Plan › Deudas: al abrirla muestra sus datos, avance y amortización. */
function DebtRow({ s, fmt }: { s: SourceView; fmt: (n: number) => string }) {
  const [open, setOpen] = useState(false)
  const t = s.debtTerms
  const balance = s.balance ?? 0
  const original = t?.originalAmount && t.originalAmount > 0 ? t.originalAmount : null
  const paid = original ? Math.max(0, original - balance) : 0
  const paidPct = original ? Math.min(100, Math.round((paid / original) * 100)) : 0
  return (
    <div className={`flex flex-col py-3 ${ROW_DIVIDER}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[44px] w-full items-center gap-3 text-left">
        <Initial name={s.name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{s.name}</span>
          <span className={`truncate text-[13px] ${TEXT_MUTED}`}>{debtHelp(s, fmt)}</span>
        </span>
        <span className={`flex-none font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>−{fmt(balance)}</span>
      </button>
      {open && t && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {original && (
            <div className="flex flex-col gap-1.5">
              <div className={`flex justify-between text-[13px] ${TEXT_MUTED}`}>
                <span>Pagado <b className={TEXT_STRONG}>{fmt(paid)}</b> ({paidPct}%)</span>
                <span>De {fmt(original)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--zafi-bg)]" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${paidPct}%`, background: '#60A5FA' }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Tasa anual" value={t.interestRate ? `${t.interestRate}%` : 'Sin interés'} />
            <Fact label="Pago mensual" value={t.monthlyPayment ? fmt(t.monthlyPayment) : '—'} />
            <Fact label="Deuda original" value={original ? fmt(original) : '—'} />
            <Fact label="Vence el día" value={t.dueDay ? String(t.dueDay) : '—'} />
          </div>
          <AmortizacionDetalle saldo={balance} tasaAnual={t.interestRate} cuota={t.monthlyPayment} fmt={fmt} />
          <div className="flex gap-4">
            <Link href="/plan/deudas/plan-de-pago" className={`flex h-9 items-center text-[13px] font-semibold ${LINK_TEXT}`}>Ver plan de pago ›</Link>
            <Link href="/plan?s=deudas" className={`flex h-9 items-center text-[13px] font-semibold ${LINK_TEXT}`}>Editar en Deudas ›</Link>
          </div>
        </div>
      )}
    </div>
  )
}

function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-electric-ghost font-outfit text-lg font-extrabold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft"
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

/** Un grupo (Efectivo, Vehículos, Corto plazo…) que se puede contraer. */
function GroupCard({ group, side, share, fmt, children }: {
  group: Group<SourceView>
  side: 'asset' | 'liability'
  /** Parte del total del lado, 0–1. */
  share: number
  fmt: (n: number) => string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const n = group.items.length
  const sub = side === 'liability' && group.monthly > 0
    ? `${fmt(group.monthly)}/mes`
    : `${Math.round(share * 100)}%`
  return (
    <ListCard>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left">
        <span aria-hidden className={`flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-base ${SOFT_BG}`}>{group.emoji}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate text-[14.5px] font-bold ${TEXT_STRONG}`}>{group.label}</span>
          <span className={`truncate text-[12.5px] ${TEXT_MUTED}`}>{open ? group.hint : `${n} ${n === 1 ? 'elemento' : 'elementos'} · toca para ver`}</span>
        </span>
        <span className="flex flex-none flex-col items-end">
          <span className={`font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{side === 'liability' ? '−' : ''}{fmt(group.total)}</span>
          <span className={`text-[12px] font-semibold ${TEXT_MUTED}`}>{sub}</span>
        </span>
        <span aria-hidden className={`flex-none text-[13px] transition-transform duration-200 motion-reduce:transition-none ${TEXT_MUTED} ${open ? '' : '-rotate-90'}`}>▾</span>
      </button>
      {side === 'asset' && (
        <div className="mb-1 h-1 overflow-hidden rounded-full bg-[var(--zafi-bg)]" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: '#60A5FA' }} />
        </div>
      )}
      {open && <div className={`border-t ${DIVIDER}`}>{children}</div>}
    </ListCard>
  )
}

function SideTitle({ title, total, negative, fmt }: { title: string; total: number; negative?: boolean; fmt: (n: number) => string }) {
  return (
    <div className="mb-1.5 mt-[22px] flex items-baseline justify-between gap-2 pr-1">
      <GroupTitle className="">{title}</GroupTitle>
      {total > 0 && <span className={`font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{negative ? '−' : ''}{fmt(total)}</span>}
    </div>
  )
}

function SourceRow({ s, fmt, onUpdate, canWrite }: { s: SourceView; fmt: (n: number) => string; onUpdate: () => void; canWrite: boolean }) {
  const liability = s.side === 'liability'
  const content = (
    <>
      <Initial name={s.name} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{s.name}</span>
        {s.stale ? (
          <span className="text-[13px] font-semibold text-warning-text dark:text-warning">Sin actualizar hace {s.daysSinceUpdate} días</span>
        ) : (
          <span className={`truncate text-[13px] ${TEXT_MUTED}`}>{updatedText(s)}</span>
        )}
      </span>
      {s.balance === null
        ? <span className={`flex-none text-[13px] ${TEXT_MUTED}`}>—</span>
        : <span className={`flex-none font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{liability ? '−' : ''}{fmt(s.balance)}</span>}
    </>
  )
  if (s.fromDebts) {
    return (
      <Link href="/plan?s=deudas" className={`flex min-h-[60px] items-center gap-3 py-3 ${ROW_DIVIDER}`}>
        {content}
      </Link>
    )
  }
  return (
    <div className={`flex flex-col gap-2 py-3 ${ROW_DIVIDER} ${s.stale ? '-mx-2 rounded-xl border border-warning px-2' : ''}`}>
      <div className="flex min-h-[44px] items-center gap-3">{content}</div>
      {canWrite && (s.stale ? (
        <button type="button" onClick={onUpdate} className="flex h-11 items-center justify-center rounded-full bg-warning-light text-sm font-bold text-warning-text dark:bg-warning/15 dark:text-warning">
          Actualizar
        </button>
      ) : (
        <button type="button" onClick={onUpdate} className={`-mt-1 self-end text-[13px] font-semibold ${LINK_TEXT} h-9`}>{s.balance === null ? 'Agregar saldo' : 'Actualizar saldo'}</button>
      ))}
    </div>
  )
}

function Evolution({ premium, fmt }: { premium: boolean; fmt: (n: number) => string }) {
  const [series, setSeries] = useState<HistoryPoint[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!premium) return
    fetch('/api/networth/history', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { series: HistoryPoint[] }) => setSeries(d.series))
      .catch(() => setFailed(true))
  }, [premium])

  if (!premium) {
    return (
      <Link href={upgradeHref('networth')} className={`relative block overflow-hidden p-4 ${CARD}`} aria-label="Evolución de tu patrimonio: función Premium">
        <div aria-hidden className="pointer-events-none select-none blur-[5px]">
          <NetWorthChart series={SAMPLE_SERIES} fmt={fmt} interactive={false} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--zafi-card)]/40 p-4 text-center">
          <PremiumBadge />
          <span className={`text-[14.5px] font-semibold ${TEXT_STRONG}`}>Mira cómo cambia tu patrimonio mes a mes</span>
          <span className={`text-[12.5px] ${TEXT_MUTED}`}>Vista de ejemplo · tu historial ya se está guardando</span>
        </div>
      </Link>
    )
  }
  return (
    <div className={`p-4 ${CARD}`}>
      {failed ? (
        <p className={`text-sm ${TEXT_MUTED}`}>No pudimos cargar la evolución.</p>
      ) : series === null ? (
        <div className="h-[150px] animate-pulse rounded-xl bg-[var(--zafi-bg)]" />
      ) : series.length < 2 ? (
        <p className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Tu evolución aparece cuando tengas saldos de al menos dos cierres de mes. También puedes agregar meses anteriores.</p>
      ) : (
        <NetWorthChart series={series} fmt={fmt} />
      )}
      <Link href="/patrimonio/historial" className={`mt-2 flex h-9 items-center text-[13px] font-semibold ${LINK_TEXT}`}>Editar historial ›</Link>
    </div>
  )
}

export default function PatrimonioPage() {
  // Ocultar saldos (F9): todos los montos de Mi patrimonio pasan por aquí.
  const fmt = useMaskedFmt(useFormatMoney())
  const privacy = usePrivacy()
  const { state, reload } = useNetWorth()
  const [sheet, setSheet] = useState<{ kind: 'add' } | { kind: 'update'; source: SourceView } | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const clearMessage = useCallback(() => setMessage(null), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  if (state.status === 'loading' || !privacy.resolved) return <PageSkeleton variant="detail" />

  const data = state.status === 'ok' ? state.data : null
  const sm = data?.summary
  const canWrite = data?.canWrite ?? false
  const total = sm ? sm.assets + sm.liabilities : 0
  const delta = sm?.deltaVsPrevMonthEnd ?? null
  const assetGroups = data ? groupAssets(data.assets) : []
  const liabilityGroups = data ? groupLiabilities(data.liabilities) : []

  return (
    <AppShell title="Mi patrimonio" currentPath="/patrimonio" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={BACK} title="Mi patrimonio" subtitle="Lo que tienes menos lo que debes" right={
          <Link href="/mis-fuentes" className={`flex h-11 items-center text-sm font-semibold ${LINK_TEXT}`}>Administrar</Link>
        } />

        {state.status === 'error' && (
          <div className="mt-3.5 flex flex-col gap-2">
            <ErrorBox>No pudimos calcular tu patrimonio.</ErrorBox>
            <PillButton onClick={() => void reload()}>Reintentar</PillButton>
          </div>
        )}

        {data && sm && !data.hasSources && (
          <div className={`mt-3.5 flex flex-col gap-3 p-5 ${CARD}`}>
            <span aria-hidden className="text-3xl">📈</span>
            <span className={`text-[16px] leading-[1.45] ${TEXT_STRONG}`}>
              Agrega tus cuentas y deudas para ver tu patrimonio. Solo tú ves estos datos.
            </span>
            {canWrite && (
              <button type="button" onClick={() => setSheet({ kind: 'add' })} className="flex h-11 items-center self-start rounded-full bg-electric px-4 text-sm font-semibold text-white">
                Agregar cuenta
              </button>
            )}
          </div>
        )}

        {data && sm && data.hasSources && (
          <>
            <section className={`mt-3.5 flex flex-col gap-2 p-5 ${HERO}`} style={HERO_STYLE} aria-label="Patrimonio neto">
              <span className={`text-[13px] font-semibold ${HERO_MUTED}`}>Patrimonio neto</span>
              <span className="font-outfit text-[40px] font-extrabold leading-none">
                {sm.netWorth < 0 ? '−' : ''}{fmt(Math.abs(sm.netWorth))}
              </span>
              {sm.netWorth < 0 && <span className={`text-[13px] ${HERO_MUTED}`}>Hoy debes más de lo que tienes.</span>}
              {delta !== null && delta !== 0 && (
                <span
                  className="self-start rounded-full px-2.5 py-1 text-[12.5px] font-bold"
                  style={delta > 0 ? { background: 'rgba(16,185,129,0.18)', color: '#34D399' } : { background: 'rgba(245,158,11,0.18)', color: '#FBBF24' }}
                >
                  {delta > 0 ? '+' : '−'}{fmt(Math.abs(delta))} este mes{delta < 0 ? ' (bajó)' : ''}
                </span>
              )}
              {total > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
                    <div style={{ width: `${(sm.assets / total) * 100}%`, background: '#60A5FA' }} />
                    {sm.liabilities > 0 && <div style={{ width: `${(sm.liabilities / total) * 100}%`, background: '#F59E0B', marginLeft: 2 }} />}
                  </div>
                  <span className={`text-[13px] ${HERO_MUTED}`}>Activos {fmt(sm.assets)} · Pasivos {fmt(sm.liabilities)}</span>
                </div>
              )}
            </section>

            <SideTitle title="Lo que tienes" total={sm.assets} fmt={fmt} />
            {assetGroups.length === 0 ? (
              <ListCard><p className={`py-3 text-sm ${TEXT_MUTED}`}>Aún no agregas cuentas ni bienes.</p></ListCard>
            ) : (
              <div className="flex flex-col gap-2.5">
                {assetGroups.map((g) => (
                  <GroupCard key={g.id} group={g} side="asset" share={sm.assets > 0 ? g.total / sm.assets : 0} fmt={fmt}>
                    {g.items.map((s) => (
                      <SourceRow key={s.id} s={s} fmt={fmt} canWrite={canWrite} onUpdate={() => setSheet({ kind: 'update', source: s })} />
                    ))}
                  </GroupCard>
                ))}
              </div>
            )}

            <SideTitle title="Lo que debes" total={sm.liabilities} negative fmt={fmt} />
            {liabilityGroups.length === 0 ? (
              <ListCard><p className={`py-3 text-sm ${TEXT_MUTED}`}>Sin deudas registradas.</p></ListCard>
            ) : (
              <div className="flex flex-col gap-2.5">
                {liabilityGroups.map((g) => (
                  <GroupCard key={g.id} group={g} side="liability" share={sm.liabilities > 0 ? g.total / sm.liabilities : 0} fmt={fmt}>
                    {g.items.map((s) => (s.fromDebts
                      ? <DebtRow key={s.id} s={s} fmt={fmt} />
                      : <SourceRow key={s.id} s={s} fmt={fmt} canWrite={canWrite} onUpdate={() => setSheet({ kind: 'update', source: s })} />
                    ))}
                  </GroupCard>
                ))}
              </div>
            )}

            {canWrite && (
              <button
                type="button"
                onClick={() => setSheet({ kind: 'add' })}
                className="mt-3.5 flex h-[52px] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-electric-soft text-[15px] font-semibold text-electric-dark dark:text-electric-soft"
              >
                + Agregar cuenta
              </button>
            )}

            <GroupTitle>Evolución</GroupTitle>
            <Evolution premium={data.features.history} fmt={fmt} />
          </>
        )}
      </div>

      <BottomSheet themed open={!!sheet} onClose={closeSheet} label={sheet?.kind === 'add' ? 'Agregar cuenta' : 'Actualizar saldo'}>
        {sheet?.kind === 'add' && (
          <AccountSheet debts={data?.debts ?? []} onDone={(text) => { setSheet(null); setMessage({ text, tone: 'ok' }); void reload() }} />
        )}
        {sheet?.kind === 'update' && (
          <UpdateBalanceSheet source={sheet.source} onDone={() => { setSheet(null); setMessage({ text: 'Saldo actualizado', tone: 'ok' }); void reload() }} />
        )}
      </BottomSheet>
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  )
}
