'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { localToday } from '@/lib/dates'
import { getUserHousehold } from '@/lib/household'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { getEmoji } from '@/lib/categories-ui'
import { monthRange } from '@/lib/movimientos'
import {
  computeHome, headerDate, initials, pickHomeAlert, STATUS_META,
  type BarKind, type HomeAlert, type HomeSummary,
} from '@/lib/inicio'
import { buildSmartAlert } from '@/components/dashboard/SmartAlert'
import { AppShell } from '@/components/layout/AppShell'
import { openAddSheet } from '@/components/dashboard/BottomNav'
import { TRANSACTIONS_CHANGED_EVENT, type TxChangedDetail } from '@/components/add/AddSheet'
import { TxRow, txRowData } from '@/components/movimientos/SwipeRow'
import { useTxSheets } from '@/components/movimientos/useTxSheets'
import { CARD_BG, DIVIDER, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import type { BudgetCategory, SearchTransaction } from '@/types'

interface HomeData {
  householdId: string
  fullName: string
  firstName: string
  categories: BudgetCategory[]
  summary: HomeSummary
  alert: HomeAlert | null
}

const BAR_STYLE: Record<BarKind, { bar: string; text: string }> = {
  ok: { bar: '#2563EB', text: 'text-ink-700 dark:text-ink-200' },
  cuidado: { bar: '#F59E0B', text: 'text-warning-text dark:text-warning' },
  excedida: { bar: '#EF4444', text: 'text-danger-text dark:text-[var(--zafi-error-text)]' },
}

type LatestRow = SearchTransaction

export default function InicioPage() {
  const router = useRouter()
  const fmt = useFormatMoney()
  const supabase = useMemo(() => createClient(), [])
  const today = localToday()
  const month = today.slice(0, 7)

  const [data, setData] = useState<HomeData | null>(null)
  const [latest, setLatest] = useState<LatestRow[]>([])
  const [reloadGen, setReloadGen] = useState(0)
  const reload = useCallback(() => setReloadGen((g) => g + 1), [])

  const sheets = useTxSheets({
    rows: latest,
    setRows: setLatest,
    categories: data?.categories ?? [],
    fmt,
    today,
    onChanged: reload,
  })
  const { getPendingDeleteId, flash } = sheets

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const household = await getUserHousehold(supabase, user.id)
      if (!household) { router.push('/onboarding'); return }
      const hid = household.id as string
      const { from, to } = monthRange(month)

      const [profileRes, catsRes, monthRes, latestRes] = await Promise.all([
        supabase.from('users').select('full_name').eq('id', user.id).single(),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
        supabase.from('transactions').select('id, amount, type, category_id').eq('household_id', hid).gte('date', from).lte('date', to),
        supabase
          .from('transactions')
          .select('*, budget_categories(name, bucket, icon)')
          .eq('household_id', hid)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(4),
      ])
      if (cancelled) return

      const pendingId = getPendingDeleteId()
      const categories = (catsRes.data ?? []) as BudgetCategory[]
      const monthTx = ((monthRes.data ?? []) as { id: string; amount: number; type: 'expense' | 'income'; category_id: string | null }[])
        .filter((t) => t.id !== pendingId)
      const summary = computeHome(categories, monthTx, new Date())

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latestRows: LatestRow[] = ((latestRes.data ?? []) as any[])
        .filter((t) => t.id !== pendingId)
        .slice(0, 3)
        .map((t) => ({
          ...t,
          category_name: t.budget_categories?.name ?? 'Sin categoría',
          category_bucket: t.budget_categories?.bucket ?? 'needs',
          category_icon: t.budget_categories?.icon ?? null,
        }))

      const lastDate = latestRows[0]?.date ?? null
      const daysSinceLast = lastDate
        ? Math.max(0, Math.round((new Date(today + 'T12:00:00').getTime() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000))
        : null

      // Ahorro del mes: el mensaje sale de buildSmartAlert (categoría de ahorro con mayor meta).
      const savingsCat = categories
        .filter((c) => c.bucket === 'savings' && !c.archived_at && c.budgeted_amount > 0)
        .sort((a, b) => b.budgeted_amount - a.budgeted_amount)[0]
      const savingsAlert = savingsCat
        ? buildSmartAlert({
            spent: 0, budget: 0, daysLeft: summary.daysLeft, daysInMonth: summary.daysLeft,
            daysSinceLastTransaction: 0,
            savingsAlert: {
              name: savingsCat.name,
              saved: monthTx.filter((t) => t.category_id === savingsCat.id).reduce((s, t) => s + Number(t.amount), 0),
              goal: savingsCat.budgeted_amount,
            },
          })
        : null

      const fullName = ((profileRes.data?.full_name as string | undefined) ?? '').trim() || 'Usuario'
      setData({
        householdId: hid,
        fullName,
        firstName: fullName.split(/\s+/)[0],
        categories,
        summary,
        alert: pickHomeAlert({
          overCategory: summary.overCategory,
          daysSinceLastTransaction: daysSinceLast,
          savings: savingsAlert ? { title: savingsAlert.title, subtitle: savingsAlert.subtitle } : null,
        }),
      })
      setLatest(latestRows)
    })()
    return () => { cancelled = true }
  }, [supabase, router, month, today, reloadGen, getPendingDeleteId])

  // Movimientos agregados desde el botón +: recalcula el hero y resalta el nuevo.
  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<TxChangedDetail | undefined>).detail
      if (detail?.id) flash(detail.id)
      reload()
    }
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onChanged)
  }, [reload, flash])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--zafi-bg)' }}>
        <Loader2 className="w-8 h-8 text-electric animate-spin" aria-label="Cargando" />
      </div>
    )
  }

  const { summary: s, alert } = data
  const hasPlan = s.budget > 0
  const status = STATUS_META[s.status]

  const avatar = (
    <Link
      href="/cuenta"
      aria-label={`${initials(data.fullName)}, tu cuenta`}
      className="flex-none flex items-center justify-center w-[42px] h-[42px] rounded-full bg-navy dark:bg-electric text-white text-sm font-bold"
    >
      {initials(data.fullName)}
    </Link>
  )

  const greeting = (
    <div className="flex flex-col min-w-0">
      <span className={`text-sm ${TEXT_MUTED}`}>{headerDate(new Date())}</span>
      <h1 className={`font-serif text-[30px] leading-tight truncate ${TEXT_STRONG}`}>Hola, {data.firstName}</h1>
    </div>
  )

  return (
    <AppShell
      title="Inicio"
      currentPath="/dashboard"
      userName={data.firstName}
      mobileHeader={<>{greeting}{avatar}</>}
      headerRight={avatar}
    >
      <div className="max-w-2xl flex flex-col">
        {/* Hero */}
        <section
          aria-label={hasPlan ? 'Hoy puedes gastar' : 'Tu plan del mes'}
          className="mt-3.5 flex flex-col gap-1.5 rounded-[20px] text-white"
          style={{ background: 'var(--zafi-hero)', padding: '22px 22px 20px' }}
        >
          {hasPlan ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] text-[#CBD8E8]">Hoy puedes gastar</span>
                <span className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-[11px] py-[5px] text-[13px] font-semibold">
                  <span aria-hidden className="w-[7px] h-[7px] rounded-full" style={{ background: status.dot }} />
                  {status.label}
                </span>
              </div>
              <p className="font-outfit font-extrabold text-[58px] leading-none tracking-[-0.02em]">
                {fmt(s.perDay)}
              </p>
              <p className="text-sm text-[#9FB3CB] [text-wrap:pretty]">
                {s.perDay > 0
                  ? 'Si te mantienes en eso cada día, llegas a fin de mes con lo que planeaste.'
                  : 'Ya usaste todo lo planeado para este mes.'}
              </p>
              <div className="h-px bg-white/[0.08] mt-3 mb-2" />
              <div className="flex items-center justify-between text-[13.5px] text-[#9FB3CB]">
                <span>Te quedan <b className="font-outfit font-bold text-white">{fmt(Math.max(0, s.left))}</b></span>
                <span>de {fmt(s.budget)}</span>
              </div>
              <div
                className="h-2 rounded-[5px] bg-[#2A4A6E] overflow-hidden"
                role="progressbar"
                aria-label="Gastado del plan"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(100, s.pct * 100))}
              >
                <div className="h-full rounded-[5px]" style={{ width: `${Math.min(100, s.pct * 100)}%`, background: status.bar }} />
              </div>
            </>
          ) : (
            <>
              <p className="text-xl font-bold">Aún no tienes un plan para este mes</p>
              <p className="text-sm text-[#9FB3CB] [text-wrap:pretty]">
                Dinos cuánto quieres gastar en cada cosa y Zafi te dirá cuánto puedes gastar cada día.
              </p>
              <Link
                href="/presupuesto"
                className="mt-2.5 self-start flex items-center h-[46px] px-6 rounded-full bg-white text-navy font-semibold"
              >
                Hacer mi plan
              </Link>
            </>
          )}
        </section>

        {/* Alerta única */}
        {alert && <HomeAlertCard alert={alert} fmt={fmt} />}

        {/* ¿En qué se va? */}
        <section className="mt-[18px] flex flex-col gap-2">
          <h2 className={`text-[15px] font-bold ${TEXT_STRONG}`}>¿En qué se va?</h2>
          {hasPlan ? (
            s.catBars.length > 0 ? (
              <div className={`rounded-2xl px-4 py-0.5 ${CARD_BG}`}>
                {s.catBars.map((b, i) => {
                  const style = BAR_STYLE[b.kind]
                  return (
                    <Link
                      key={b.id}
                      href={`/resumen/categoria/${b.id}?mes=${month}`}
                      className={`flex flex-col gap-[7px] py-3 ${i < s.catBars.length - 1 ? `border-b ${DIVIDER}` : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="text-lg leading-none">{getEmoji(b)}</span>
                        <span className={`flex-1 min-w-0 truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{b.name}</span>
                        <span className={`text-[13px] font-semibold ${style.text}`}>
                          {b.ratio > 1 ? `${fmt(b.spent - b.budget)} de más` : `Quedan ${fmt(b.budget - b.spent)}`}
                        </span>
                      </span>
                      <span className="h-1.5 rounded bg-[var(--zafi-border-light)] overflow-hidden">
                        <span className="block h-full rounded" style={{ width: `${Math.min(100, b.ratio * 100)}%`, background: style.bar }} />
                      </span>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className={`text-sm ${TEXT_MUTED}`}>Todavía no hay gastos en las categorías de tu plan este mes.</p>
            )
          ) : s.spendByCategory.length > 0 ? (
            <div className={`rounded-2xl px-4 py-0.5 ${CARD_BG}`}>
              {s.spendByCategory.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/resumen/categoria/${c.id}?mes=${month}`}
                  className={`flex items-center gap-2 py-3 ${i < s.spendByCategory.length - 1 ? `border-b ${DIVIDER}` : ''}`}
                >
                  <span aria-hidden className="text-lg leading-none">{getEmoji(c)}</span>
                  <span className={`flex-1 min-w-0 truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{c.name}</span>
                  <span className={`text-[13px] font-semibold ${TEXT_STRONG}`}>{fmt(c.spent)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${TEXT_MUTED}`}>Aún no registras gastos este mes.</p>
          )}
        </section>

        {/* Lo último */}
        <section className="mt-[18px] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className={`text-[15px] font-bold ${TEXT_STRONG}`}>Lo último</h2>
            <Link href="/transacciones" className="text-sm font-semibold text-electric dark:text-electric-pale">Ver todo</Link>
          </div>
          {latest.length > 0 ? (
            <div className="flex flex-col gap-[5px]">
              {latest.map((tx) => (
                <TxRow
                  key={tx.id}
                  row={txRowData(tx, fmt)}
                  flash={sheets.flashId === tx.id}
                  onSelect={() => sheets.openDetail(tx.id)}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={openAddSheet}
              className={`rounded-2xl px-4 py-5 text-sm font-semibold text-electric ${CARD_BG}`}
            >
              Agrega tu primer movimiento
            </button>
          )}
        </section>
      </div>

      {sheets.element}
    </AppShell>
  )
}

function HomeAlertCard({ alert, fmt }: { alert: HomeAlert; fmt: (n: number) => string }) {
  const base = 'mt-3 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left w-full'
  if (alert.kind === 'excedida') {
    return (
      <Link href={`/transacciones?q=${encodeURIComponent(alert.name)}`} className={`${base} bg-warning-light`}>
        <span aria-hidden className="text-[22px] leading-none">{getEmoji(alert)}</span>
        <span className="flex-1 text-sm text-warning-text">
          <b>{alert.name}</b> va {fmt(alert.excess)} arriba de lo planeado.
        </span>
        <span className="text-sm font-semibold text-warning-text">Ver ›</span>
      </Link>
    )
  }
  if (alert.kind === 'sin-registrar') {
    return (
      <button type="button" onClick={openAddSheet} className={`${base} bg-electric-ghost`}>
        <span aria-hidden className="text-[22px] leading-none">✍️</span>
        <span className="flex-1 text-sm text-electric-dark">
          Hace <b>{alert.days} días</b> que no registras un movimiento.
        </span>
        <span className="text-sm font-semibold text-electric-dark">Agregar ›</span>
      </button>
    )
  }
  return (
    <Link href="/presupuesto" className={`${base} bg-success-light`}>
      <span aria-hidden className="text-[22px] leading-none">🐷</span>
      <span className="flex-1 text-sm text-success-text">
        <b>{alert.title}</b>
        {alert.subtitle && <span className="block">{alert.subtitle}</span>}
      </span>
      <span className="text-sm font-semibold text-success-text">Ver ›</span>
    </Link>
  )
}
