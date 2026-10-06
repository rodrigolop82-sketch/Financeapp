'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { CountUp } from '@/components/motion/CountUp'
import { openAddSheet } from '@/components/dashboard/BottomNav'
import { TRANSACTIONS_CHANGED_EVENT, type TxChangedDetail } from '@/components/add/AddSheet'
import { TxRow, txRowData } from '@/components/movimientos/SwipeRow'
import { useTxSheets } from '@/components/movimientos/useTxSheets'
import { CARD_BG, DIVIDER, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { MonthStartNotice } from '@/components/inicio-de-mes/MonthStartNotice'
import { useMonthStart } from '@/components/inicio-de-mes/useMonthStart'
import { incomeCategoryIds, monthName, receivedByIncome } from '@/lib/plan-del-mes'
import { useGoals, type Goal } from '@/hooks/useGoals'
import { AddContributionSheet } from '@/components/goals/AddContributionSheet'
import { PillButton } from '@/components/layout/Pantalla'
import { CARD, GREEN_TEXT } from '@/components/resumen/ctf-ui'
import { ProgressBar } from '@/components/plan/ui'
import { useHealthScore } from '@/hooks/useHealthScore'
import { ScoreHeroLine } from '@/components/score/ScoreUI'
import { TrialHeroLine } from '@/components/premium/TrialHeroLine'
import type { BudgetCategory, BudgetSubItem, IncomeEntry, SearchTransaction } from '@/types'

interface HomeMonthTx {
  id: string
  amount: number
  type: 'expense' | 'income'
  category_id: string | null
  budget_sub_item_id?: string | null
}

interface HomeData {
  householdId: string
  fullName: string
  firstName: string
  categories: BudgetCategory[]
  subItems: BudgetSubItem[]
  incomes: IncomeEntry[]
  monthTx: HomeMonthTx[]
  daysSinceLast: number | null
  savings: { title: string; subtitle: string } | null
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

  // Tu meta principal: la activa más avanzada (sin contar las ya completas).
  const { goals, addContribution } = useGoals()
  const mainGoal = useMemo(() => pickMainGoal(goals), [goals])
  const [contributing, setContributing] = useState(false)
  const { score: health, recalculate: recalcHealth } = useHealthScore(data?.householdId ?? null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const household = await getUserHousehold(supabase, user.id)
      if (!household) { router.push('/onboarding'); return }
      const hid = household.id as string
      const { from, to } = monthRange(month)

      const monthQuery = (cols: string) =>
        supabase.from('transactions').select(cols).eq('household_id', hid).gte('date', from).lte('date', to)
      const [profileRes, catsRes, monthRes0, latestRes, subsRes, incomesRes] = await Promise.all([
        supabase.from('users').select('full_name').eq('id', user.id).single(),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
        monthQuery('id, amount, type, category_id, budget_sub_item_id'),
        supabase
          .from('transactions')
          .select('*, budget_categories(name, bucket, icon)')
          .eq('household_id', hid)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(4),
        supabase.from('budget_sub_items').select('*').eq('household_id', hid),
        supabase.from('income_entries').select('*').eq('household_id', hid).order('created_at', { ascending: true }),
      ])
      // Sin la migración del Plan del mes no existe budget_sub_item_id.
      const monthRes = monthRes0.error ? await monthQuery('id, amount, type, category_id') : monthRes0
      if (cancelled) return

      const pendingId = getPendingDeleteId()
      const categories = (catsRes.data ?? []) as BudgetCategory[]
      const monthTx = ((monthRes.data ?? []) as unknown as HomeMonthTx[]).filter((t) => t.id !== pendingId)
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
        subItems: (subsRes.data ?? []) as BudgetSubItem[],
        incomes: (incomesRes.data ?? []) as IncomeEntry[],
        monthTx,
        daysSinceLast,
        savings: savingsAlert ? { title: savingsAlert.title, subtitle: savingsAlert.subtitle } : null,
      })
      setLatest(latestRows)
    })()
    return () => { cancelled = true }
  }, [supabase, router, month, today, reloadGen, getPendingDeleteId])

  // Movimientos agregados desde el botón +: recalcula el hero y resalta el nuevo.
  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<TxChangedDetail | undefined>).detail
      if (detail?.id) flash(detail.id, true)
      reload()
      void recalcHealth()
    }
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onChanged)
  }, [reload, flash, recalcHealth])

  // ── Inicio de mes (Fase 6) ──────────────────────
  const plan = useMemo(() => {
    const categories = data?.categories ?? []
    const monthTx = data?.monthTx ?? []
    const sum = (type: 'expense' | 'income', key: (t: HomeMonthTx) => string | null | undefined) => {
      const out: Record<string, number> = {}
      for (const t of monthTx) {
        const k = key(t)
        if (t.type === type && k) out[k] = (out[k] ?? 0) + Number(t.amount)
      }
      return out
    }
    const incomeCats = categories.filter((c) => c.bucket === 'income')
    const incomeCategoryOf = incomeCategoryIds(data?.incomes ?? [], incomeCats)
    return {
      spentByCategory: sum('expense', (t) => t.category_id),
      spentBySub: sum('expense', (t) => t.budget_sub_item_id),
      incomeCategoryOf,
      received: receivedByIncome(data?.incomes ?? [], incomeCategoryOf, sum('income', (t) => t.category_id)),
    }
  }, [data])
  const baseSummary = useMemo(() => (data ? computeHome(data.categories, data.monthTx, new Date()) : null), [data])

  const [toast, setToast] = useState<StatusMessage | null>(null)
  const monthStart = useMonthStart({
    supabase,
    householdId: data?.householdId ?? '',
    month,
    categories: data?.categories ?? [],
    subItems: data?.subItems ?? [],
    incomes: data?.incomes ?? [],
    spentByCategory: plan.spentByCategory,
    spentBySub: plan.spentBySub,
    received: plan.received,
    incomeCategoryOf: plan.incomeCategoryOf,
    planSpend: baseSummary?.budget ?? 0,
    spent: baseSummary?.spent ?? 0,
    daysLeft: baseSummary?.daysLeft ?? 1,
    fmt,
    onSaved: (text) => { reload(); setToast({ text, tone: 'ok' }) },
    onError: (text) => setToast({ text, tone: 'error' }),
  })

  // ?inicio_mes=1 (recordatorio del día 1) abre la hoja.
  const openMonthStart = monthStart.open
  useEffect(() => {
    if (!monthStart.loaded) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('inicio_mes') !== '1') return
    url.searchParams.delete('inicio_mes')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    openMonthStart()
  }, [monthStart.loaded, openMonthStart])

  if (!data || !baseSummary) {
    return <PageSkeleton variant="home" />
  }

  const s: HomeSummary = computeHome(data.categories, data.monthTx, new Date(), monthStart.reserve.reserved)
  const alert: HomeAlert | null = pickHomeAlert({
    overCategory: s.overCategory,
    daysSinceLastTransaction: data.daysSinceLast,
    savings: data.savings,
  })
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
      <div className="max-w-2xl flex flex-col zafi-stagger">
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
                <CountUp value={s.perDay} format={fmt} />
              </p>
              <p className="text-sm text-[#9FB3CB] [text-wrap:pretty]">
                {s.left <= 0
                  ? 'Ya usaste todo lo planeado para este mes.'
                  : !monthStart.done
                    ? 'Ojo: tus gastos fijos sin pagar todavía cuentan aquí, así que este número puede estar inflado.'
                    : `Ya apartamos ${fmt(monthStart.reserve.reserved)} para pagos fijos que faltan. Si gastas eso cada día, llegas a fin de mes.`}
              </p>
              <div className="h-px bg-white/[0.08] mt-3 mb-2" />
              <div className="flex items-center justify-between text-[13.5px] text-[#9FB3CB]">
                <span>Te quedan <b className="font-outfit font-bold text-white"><CountUp value={Math.max(0, s.left)} format={fmt} /></b></span>
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
                <div className="h-full rounded-[5px] transition-[width,background-color] [transition-duration:600ms]" style={{ width: `${Math.min(100, s.pct * 100)}%`, background: status.bar }} />
              </div>
            </>
          ) : (
            <>
              <p className="text-xl font-bold">Aún no tienes un plan para este mes</p>
              <p className="text-sm text-[#9FB3CB] [text-wrap:pretty]">
                Dinos cuánto quieres gastar en cada cosa y Zafi te dirá cuánto puedes gastar cada día.
              </p>
              <Link
                href="/plan"
                className="mt-2.5 self-start flex items-center h-[46px] px-6 rounded-full bg-white text-navy font-semibold"
              >
                Hacer mi plan
              </Link>
            </>
          )}
          {health && health.components.length > 0 && <ScoreHeroLine score={health} href="/score?from=inicio" />}
          <TrialHeroLine />
        </section>

        {/* Inicio de mes pendiente */}
        {hasPlan && monthStart.loaded && !monthStart.done && (
          <MonthStartNotice variant="home" monthName={monthName(month)} done={false} onOpen={monthStart.open} />
        )}

        {/* Alerta única */}
        {alert && <HomeAlertCard alert={alert} fmt={fmt} />}

        {/* Tu meta principal */}
        {mainGoal && <MainGoalCard goal={mainGoal} fmt={fmt} onContribute={() => setContributing(true)} />}

        {/* ¿En qué se va? */}
        <section className="mt-[18px] flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2 className={`text-[15px] font-bold ${TEXT_STRONG}`}>¿En qué se va?</h2>
            <Link href="/plan" className="flex items-center min-h-[44px] text-sm font-semibold text-electric">
              Ver plan
            </Link>
          </div>
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
                        <span className="block h-full rounded transition-[width,background-color] [transition-duration:600ms]" style={{ width: `${Math.min(100, b.ratio * 100)}%`, background: style.bar }} />
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
                  flash={sheets.flashFor(tx.id)}
                  onSelect={() => sheets.openDetail(tx.id)}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAddSheet()}
              className={`rounded-2xl px-4 py-5 text-sm font-semibold text-electric ${CARD_BG}`}
            >
              Agrega tu primer movimiento
            </button>
          )}
        </section>
      </div>

      {sheets.element}
      {monthStart.element}
      {mainGoal && (
        <AddContributionSheet
          open={contributing}
          onClose={() => setContributing(false)}
          goalName={mainGoal.name}
          goalEmoji={mainGoal.emoji}
          currentAmount={mainGoal.currentAmount}
          targetAmount={mainGoal.targetAmount}
          monthlyContribution={mainGoal.monthlyContribution}
          onConfirm={async (amount, note) => {
            // Si falla, la hoja queda abierta con el error.
            await addContribution(mainGoal.id, amount, note)
            setToast({ text: `Aportaste ${fmt(amount)} a ${mainGoal.name}`, tone: 'ok' })
            void recalcHealth()
          }}
        />
      )}
      <StatusToast message={toast} onDone={() => setToast(null)} />
    </AppShell>
  )
}

function pickMainGoal(goals: Goal[]): Goal | null {
  const ratio = (g: Goal) => (g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0)
  return goals
    .filter((g) => g.status === 'active' && ratio(g) < 1)
    .sort((a, b) => ratio(b) - ratio(a))[0] ?? null
}

function MainGoalCard({ goal, fmt, onContribute }: { goal: Goal; fmt: (n: number) => string; onContribute: () => void }) {
  const ratio = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0
  return (
    <section className="mt-[18px] flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 className={`text-[15px] font-bold ${TEXT_STRONG}`}>Tu meta principal</h2>
        <Link href="/plan?s=metas" className="flex items-center min-h-[44px] text-sm font-semibold text-electric">
          Ver metas
        </Link>
      </div>
      <div className={`p-3.5 ${CARD}`}>
        <div className="flex items-center gap-3">
          <Link href={`/metas/${goal.id}?from=inicio`} className="flex min-w-0 flex-1 items-center gap-3">
            <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[var(--zafi-bg)] text-[22px]">{goal.emoji}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{goal.name}</span>
              <span className={`text-[13px] leading-[1.35] ${TEXT_MUTED}`}>
                <b className={`font-semibold ${GREEN_TEXT}`}>{fmt(goal.currentAmount)}</b> de {fmt(goal.targetAmount)} · {Math.round(ratio * 100)}%
              </span>
            </span>
          </Link>
          <PillButton onClick={onContribute}>Aportar</PillButton>
        </div>
        <ProgressBar ratio={ratio} className="mt-3" />
      </div>
    </section>
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
      <button type="button" onClick={() => openAddSheet()} className={`${base} bg-electric-ghost`}>
        <span aria-hidden className="text-[22px] leading-none">✍️</span>
        <span className="flex-1 text-sm text-electric-dark">
          Hace <b>{alert.days} días</b> que no registras un movimiento.
        </span>
        <span className="text-sm font-semibold text-electric-dark">Agregar ›</span>
      </button>
    )
  }
  return (
    <Link href="/plan" className={`${base} bg-success-light`}>
      <span aria-hidden className="text-[22px] leading-none">🐷</span>
      <span className="flex-1 text-sm text-success-text">
        <b>{alert.title}</b>
        {alert.subtitle && <span className="block">{alert.subtitle}</span>}
      </span>
      <span className="text-sm font-semibold text-success-text">Ver ›</span>
    </Link>
  )
}
