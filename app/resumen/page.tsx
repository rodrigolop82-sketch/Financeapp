'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/format'
import { AppShell } from '@/components/layout/AppShell'
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react'
import {
  computeCategoryPace,
  summarizeMonth,
  type CategoryBudgetInput,
  type MonthContext,
  type CategoryPace,
  type MonthSummary,
} from '@/lib/resumen/pace'
import {
  computeClosedMonth,
  type ClosedMonthResult,
  type ClosedCategoryInput,
} from '@/lib/resumen/closed-month'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { MonthNavigator } from '@/components/resumen/MonthNavigator'
import { MonthPickerSheet } from '@/components/resumen/MonthPickerSheet'

type Tab = 'mes' | 'insights' | 'tendencias'

interface CategorySpend {
  name: string
  bucket: string
  amount: number
  prevAmount: number
}

interface BudgetCatRow {
  id: string
  name: string
  bucket: string
  budgeted_amount: number
  pace_mode: 'linear' | 'fixed'
  expected_day: number | null
}

interface PrevDayData {
  total: number
  byCat: Record<string, number>
}

interface MonthlyBucketTotals {
  month: string
  label: string
  needs: number
  wants: number
  savings: number
  total: number
  isPartial: boolean
}

interface ResumenData {
  userName: string
  householdName: string
  budget: number
  spentMonth: number
  daysLeft: number
  categories: CategorySpend[]
  spentPrevMonth: number
  spentPrevSameDay: PrevDayData
  monthlyAvg: number
  paceItems: CategoryPace[]
  monthSummary: MonthSummary
  monthCtx: MonthContext
  budgetCats: BudgetCatRow[]
  txMonth: Array<{ category_id: string; amount: number; description: string | null }>
  currentMonthLabel: string
  prevMonthLabel: string
  totalIncome: number
  monthlyHistory: MonthlyBucketTotals[]
  closedResult: ClosedMonthResult | null
  isBackfilled: boolean
}

const STATUS_COLORS: Record<string, { dot: string; pill: string; pillBg: string; label: string }> = {
  sobregiro: { dot: '#EF4444', pill: '#991B1B', pillBg: '#FEE2E2', label: 'Sobregiro' },
  riesgo:    { dot: '#F59E0B', pill: '#92400E', pillBg: '#FEF3C7', label: 'En riesgo' },
  en_linea:  { dot: '#22C55E', pill: '#065F46', pillBg: '#D1FAE5', label: 'En línea' },
  sin_gasto: { dot: '#64748B', pill: '#64748B', pillBg: '#F1F5F9', label: 'Sin gasto' },
}

const CLOSED_STATUS_COLORS: Record<string, { dot: string; pill: string; pillBg: string; label: string }> = {
  sobregiro: { dot: '#EF4444', pill: '#991B1B', pillBg: '#FEE2E2', label: 'Sobregiro' },
  en_linea:  { dot: '#22C55E', pill: '#065F46', pillBg: '#D1FAE5', label: 'En línea' },
  sin_gasto: { dot: '#64748B', pill: '#64748B', pillBg: '#F1F5F9', label: 'Sin gasto' },
}

export default function ResumenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3F5F9' }}>
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    }>
      <ResumenContent />
    </Suspense>
  )
}

function ResumenContent() {
  const [data, setData] = useState<ResumenData | null>(null)
  const [tab, setTab] = useState<Tab>('mes')
  const [loading, setLoading] = useState(true)
  const [showNoSpend, setShowNoSpend] = useState(false)
  const [insightsMode, setInsightsMode] = useState<'same_day' | 'full'>('same_day')
  const [userPlan, setUserPlan] = useState<'free' | 'premium'>('free')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [monthResults, setMonthResults] = useState<Array<{ key: string; hasData: boolean; result: 'ok' | 'warn' | 'bad' | 'live' | null }>>([])
  const router = useRouter()

  const selectedMonth = useSelectedMonth(availableMonths)


  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userProfile } = await supabase
        .from('users').select('full_name').eq('id', user.id).single()

      const { data: household } = await supabase
        .from('households').select('*').eq('owner_id', user.id).limit(1).single()

      if (!household) { router.push('/onboarding'); return }
      const hid = household.id as string

      const { data: userRow } = await supabase.from('users').select('plan').eq('id', user.id).single()
      const plan = (userRow?.plan ?? 'free') as 'free' | 'premium'
      setUserPlan(plan)

      // Determine month to display
      const selMonth = selectedMonth.month
      const [selY, selM] = selMonth.split('-').map(Number)
      const now = new Date()
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const isCurrentMonth = selMonth === currentMonthKey

      const monthStart = `${selMonth}-01`
      const monthEndDate = new Date(selY, selM, 0)
      const monthEnd = `${selY}-${String(selM).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`

      const prevMonthDate = new Date(selY, selM - 2, 1)
      const prevMonthStart = prevMonthDate.toISOString().slice(0, 10)
      const prevMonthEndDate = new Date(selY, selM - 1, 0)
      const prevMonthEnd = prevMonthEndDate.toISOString().slice(0, 10)

      const daysInMonth = monthEndDate.getDate()
      const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth
      const daysLeft = isCurrentMonth ? daysInMonth - dayOfMonth : 0

      // Fetch available months for navigation
      const { data: allTxDates } = await supabase
        .from('transactions')
        .select('date')
        .eq('household_id', hid)
        .eq('type', 'expense')
      const txMonthSet = new Set<string>()
      for (const t of allTxDates ?? []) {
        txMonthSet.add((t.date as string).slice(0, 7))
      }
      txMonthSet.add(currentMonthKey)
      const sortedAvailable = Array.from(txMonthSet).sort()
      setAvailableMonths(sortedAvailable)

      const [txMonthRes, categoriesRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('household_id', hid).eq('type', 'expense').gte('date', monthStart).lte('date', monthEnd),
        supabase.from('budget_categories').select('*').eq('household_id', hid),
      ])

      const txPrevRes = plan === 'premium'
        ? await supabase.from('transactions').select('*').eq('household_id', hid).eq('type', 'expense').gte('date', prevMonthStart).lte('date', prevMonthEnd)
        : { data: null }

      const txMonth = txMonthRes.data ?? []
      const txPrev = txPrevRes.data ?? []
      const cats = (categoriesRes.data ?? []) as BudgetCatRow[]

      const catMap: Record<string, BudgetCatRow> = {}
      cats.forEach((c) => { catMap[c.id] = c })

      const spentByCat: Record<string, number> = {}
      const bucketByCat: Record<string, string> = {}
      txMonth.forEach((t: { category_id: string; amount: number }) => {
        const info = catMap[t.category_id]
        const name = info?.name ?? 'Otros'
        spentByCat[name] = (spentByCat[name] ?? 0) + Number(t.amount)
        if (info) bucketByCat[name] = info.bucket
      })

      const prevByCat: Record<string, number> = {}
      txPrev.forEach((t: { category_id: string; amount: number }) => {
        const info = catMap[t.category_id]
        const name = info?.name ?? 'Otros'
        prevByCat[name] = (prevByCat[name] ?? 0) + Number(t.amount)
        if (info) bucketByCat[name] = info.bucket
      })

      const allCatNames = Array.from(new Set([...Object.keys(spentByCat), ...Object.keys(prevByCat)]))
      const categories: CategorySpend[] = allCatNames.map(name => ({
        name,
        bucket: bucketByCat[name] ?? '',
        amount: spentByCat[name] ?? 0,
        prevAmount: prevByCat[name] ?? 0,
      })).sort((a, b) => b.amount - a.amount)

      const spentMonth = txMonth.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
      const spentPrevMonth = txPrev.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)

      // Same-day comparison: prev month up to the same day
      const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
      const sameDayCutoff = Math.min(dayOfMonth, prevMonthDays)
      const sameDayCutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, sameDayCutoff).toISOString().slice(0, 10)
      const txPrevSameDay = txPrev.filter((t: { date: string }) => t.date <= sameDayCutoffDate)
      const spentPrevSameDayTotal = txPrevSameDay.reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
      const prevSameDayByCat: Record<string, number> = {}
      txPrevSameDay.forEach((t: { category_id: string; amount: number }) => {
        const info = catMap[t.category_id]
        const name = info?.name ?? 'Otros'
        prevSameDayByCat[name] = (prevSameDayByCat[name] ?? 0) + Number(t.amount)
      })

      const selDate = new Date(selY, selM - 1)
      const currentMonthLabel = selDate.toLocaleDateString('es-GT', { month: 'long' })
      const prevLabelDate = new Date(selY, selM - 2)
      const prevMonthLabel = prevLabelDate.toLocaleDateString('es-GT', { month: 'long' })

      const totalBudget = cats.reduce((s, c) => s + Number(c.budgeted_amount), 0)

      // Fetch financial profile for income
      const { data: fp } = await supabase
        .from('financial_profiles').select('total_income').eq('household_id', hid).single()
      const totalIncome = Number(fp?.total_income ?? 0)

      // Fetch last 6 complete months of transactions for trends (premium only)
      let txHistory: Array<{ category_id: string; amount: number; date: string }> | null = null
      if (plan === 'premium') {
        const sixMonthsAgo = new Date(selY, selM - 7, 1).toISOString().slice(0, 10)
        const trendEnd = isCurrentMonth ? undefined : `${selY}-${String(selM).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`
        let q = supabase
          .from('transactions').select('category_id, amount, date')
          .eq('household_id', hid).eq('type', 'expense').gte('date', sixMonthsAgo)
        if (trendEnd) q = q.lte('date', trendEnd)
        const { data } = await q
        txHistory = data
      }

      const catBucketMap: Record<string, string> = {}
      cats.forEach(c => { catBucketMap[c.id] = c.bucket })

      const monthlyBuckets: Record<string, { needs: number; wants: number; savings: number; total: number }> = {}
      ;(txHistory ?? []).forEach((t: { category_id: string; amount: number; date: string }) => {
        const d = new Date(t.date + 'T12:00:00')
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyBuckets[key]) monthlyBuckets[key] = { needs: 0, wants: 0, savings: 0, total: 0 }
        const amt = Number(t.amount)
        const bucket = catBucketMap[t.category_id] ?? 'needs'
        monthlyBuckets[key].total += amt
        if (bucket === 'needs') monthlyBuckets[key].needs += amt
        else if (bucket === 'wants') monthlyBuckets[key].wants += amt
        else monthlyBuckets[key].savings += amt
      })

      const monthlyHistory: MonthlyBucketTotals[] = Object.entries(monthlyBuckets)
        .map(([key, v]) => {
          const [y, m] = key.split('-').map(Number)
          const mDate = new Date(y, m - 1)
          return {
            month: key,
            label: mDate.toLocaleDateString('es-GT', { month: 'short' }),
            ...v,
            isPartial: key === currentMonthKey,
          }
        })
        .sort((a, b) => a.month.localeCompare(b.month))

      // Build pace items for each budget category
      const spentByCatId: Record<string, number> = {}
      txMonth.forEach((t: { category_id: string; amount: number }) => {
        spentByCatId[t.category_id] = (spentByCatId[t.category_id] ?? 0) + Number(t.amount)
      })

      const monthDate = isCurrentMonth ? now : new Date(selY, selM - 1, dayOfMonth)
      const monthCtx: MonthContext = { today: monthDate, daysInMonth, dayOfMonth }

      let paceItems: CategoryPace[]
      let monthSummary: MonthSummary
      let closedResult: ClosedMonthResult | null = null
      let isBackfilledFlag = false

      if (!isCurrentMonth) {
        // Closed month: fetch budget snapshots
        const { data: snapshots } = await supabase
          .from('budget_snapshots')
          .select('*')
          .eq('household_id', hid)
          .eq('month', monthStart)

        const snapMap = new Map<string, { amount: number; pace_mode: string; expected_day: number | null; is_backfilled: boolean }>()
        for (const s of snapshots ?? []) {
          snapMap.set(s.category_id, {
            amount: Number(s.amount),
            pace_mode: s.pace_mode,
            expected_day: s.expected_day,
            is_backfilled: s.is_backfilled,
          })
        }
        isBackfilledFlag = Array.from(snapMap.values()).some(s => s.is_backfilled)

        const closedCatInputs: ClosedCategoryInput[] = cats.map(c => {
          const snap = snapMap.get(c.id)
          return {
            categoryId: c.id,
            name: c.name,
            budget: snap ? snap.amount : Number(c.budgeted_amount),
            spent: spentByCatId[c.id] ?? 0,
          }
        })

        // Fetch up to 3 previous closed months for average
        const prevKeys: string[] = []
        for (let i = 1; i <= 3; i++) {
          const pd = new Date(selY, selM - 1 - i, 1)
          const pk = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`
          if (pk < currentMonthKey) prevKeys.push(pk)
        }
        const prevMonthsSpent = prevKeys.map(pk => monthlyBuckets[pk]?.total ?? 0)

        closedResult = computeClosedMonth({ categories: closedCatInputs, prevMonthsSpent })

        // Still compute pace items for compatibility with other tabs
        const paceInputs: CategoryBudgetInput[] = cats.map(c => {
          const snap = snapMap.get(c.id)
          return {
            categoryId: c.id,
            name: c.name,
            budget: snap ? snap.amount : Number(c.budgeted_amount),
            spent: spentByCatId[c.id] ?? 0,
            paceMode: (snap?.pace_mode ?? c.pace_mode ?? 'linear') as 'linear' | 'fixed',
            expectedDay: snap?.expected_day ?? c.expected_day,
          }
        })
        paceItems = paceInputs.map(input => computeCategoryPace(input, monthCtx))
        monthSummary = summarizeMonth(paceItems, monthCtx)
      } else {
        const paceInputs: CategoryBudgetInput[] = cats.map(c => ({
          categoryId: c.id,
          name: c.name,
          budget: Number(c.budgeted_amount),
          spent: spentByCatId[c.id] ?? 0,
          paceMode: c.pace_mode || 'linear',
          expectedDay: c.expected_day,
        }))

        paceItems = paceInputs.map(input => computeCategoryPace(input, monthCtx))
        monthSummary = summarizeMonth(paceItems, monthCtx)
      }

      const fullName = (userProfile?.full_name || 'Usuario') as string
      const firstName = fullName.split(' ')[0]

      // Compute per-month results for picker
      const pickerMonths = sortedAvailable.map(mk => {
        const mkSpent = (allTxDates ?? [])
          .filter(t => (t.date as string).slice(0, 7) === mk)
          .length
        const hasData = mkSpent > 0 || mk === currentMonthKey
        let result: 'ok' | 'warn' | 'bad' | 'live' | null = null
        if (mk === currentMonthKey) {
          result = 'live'
        } else if (hasData) {
          // Simple heuristic: compare total spent vs total budget for closed months
          const mkTotalSpent = monthlyBuckets[mk]?.total ?? 0
          if (mkTotalSpent > totalBudget) result = 'bad'
          else if (mkTotalSpent > totalBudget * 0.95) result = 'warn'
          else result = 'ok'
        }
        return { key: mk, hasData, result }
      })
      setMonthResults(pickerMonths)

      setData({
        userName: firstName,
        householdName: household.name ?? '',
        budget: totalBudget,
        spentMonth,
        daysLeft,
        categories,
        spentPrevMonth,
        spentPrevSameDay: { total: spentPrevSameDayTotal, byCat: prevSameDayByCat },
        currentMonthLabel,
        prevMonthLabel,
        monthlyAvg: Math.round((spentMonth + spentPrevMonth) / 2),
        paceItems,
        monthSummary,
        monthCtx,
        budgetCats: cats,
        txMonth: txMonth.map((t: { category_id: string; amount: number; description: string | null }) => ({
          category_id: t.category_id,
          amount: Number(t.amount),
          description: t.description,
        })),
        totalIncome,
        monthlyHistory,
        closedResult,
        isBackfilled: isBackfilledFlag,
      })
      setLoading(false)
    }
    load()
  }, [router, selectedMonth.month]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F3F5F9' }}>
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    )
  }

  const tabStyle = (t: Tab) => ({
    padding: '10px 22px', borderRadius: 10,
    fontWeight: 600 as const, fontSize: '14.5px', cursor: 'pointer' as const,
    background: tab === t ? '#fff' : 'transparent',
    color: tab === t ? '#1E3A5F' : '#7E93AE',
    boxShadow: tab === t ? '0 1px 3px rgba(30,58,95,0.15)' : 'none',
    border: 'none', fontFamily: 'inherit',
  })

  const { monthSummary: ms, paceItems, monthCtx } = data
  const pctBar = ms.totalBudget > 0 ? Math.min(1, ms.totalSpent / ms.totalBudget) : 0
  const expectedMark = ms.totalBudget > 0 ? Math.min(1, ms.totalExpected / ms.totalBudget) : 0

  // Sort pace items: sobregiro → riesgo → en_linea → sin_gasto
  const statusOrder: Record<string, number> = { sobregiro: 0, riesgo: 1, en_linea: 2, sin_gasto: 3 }
  const sortedPace = [...paceItems].sort((a, b) => {
    const orderDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    if (orderDiff !== 0) return orderDiff
    if (a.status === 'sobregiro') return b.overrun - a.overrun
    return b.spent - a.spent
  })

  const withSpend = sortedPace.filter(p => {
    if (p.status !== 'sin_gasto') return true
    const catRow = data.budgetCats.find(c => c.id === p.categoryId)
    return catRow?.pace_mode === 'fixed' && monthCtx.dayOfMonth < (catRow?.expected_day ?? 1)
  })
  const noSpend = sortedPace.filter(p => {
    if (p.status !== 'sin_gasto') return false
    const catRow = data.budgetCats.find(c => c.id === p.categoryId)
    return !(catRow?.pace_mode === 'fixed' && monthCtx.dayOfMonth < (catRow?.expected_day ?? 1))
  })
  const noSpendBudgetSum = noSpend.reduce((s, p) => s + p.budget, 0)

  // Find largest transaction per category for semaphore copy
  function largestTxForCategory(catId: string): { amount: number; description: string } | null {
    const catTxs = data!.txMonth.filter(t => t.category_id === catId)
    if (catTxs.length === 0) return null
    const sorted = [...catTxs].sort((a, b) => b.amount - a.amount)
    return { amount: sorted[0].amount, description: sorted[0].description ?? '' }
  }

  const barColor = ms.totalSpent > ms.totalBudget ? '#EF4444' : '#2563EB'

  return (
    <AppShell title="Resumen" currentPath="/resumen" userName={data.userName} householdName={data.householdName}>
      {/* Month navigator */}
      <MonthNavigator
        label={selectedMonth.label}
        isCurrent={selectedMonth.isCurrent}
        dayOfMonth={data.monthCtx.dayOfMonth}
        daysInMonth={data.monthCtx.daysInMonth}
        canGoPrev={availableMonths.length > 0 && selectedMonth.month > availableMonths[0]}
        canGoNext={!selectedMonth.isCurrent}
        onPrev={selectedMonth.goPrev}
        onNext={selectedMonth.goNext}
        onTap={() => setPickerOpen(true)}
      />

      <MonthPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={selectedMonth.month}
        currentMonth={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
        availableMonths={monthResults}
        onSelect={selectedMonth.setMonth}
      />

      {/* Tabs */}
      <div style={{
        display: 'flex', background: '#E7EBF2', borderRadius: 13,
        padding: 4, marginBottom: 24, width: 'fit-content',
      }}>
        <button style={tabStyle('mes')} onClick={() => setTab('mes')}>Mes</button>
        <button style={tabStyle('insights')} onClick={() => setTab('insights')}>Insights</button>
        <button style={tabStyle('tendencias')} onClick={() => setTab('tendencias')}>Tendencias</button>
      </div>

      {/* === MES === */}
      {tab === 'mes' && selectedMonth.isClosed && data.closedResult && (() => {
        const cr = data.closedResult
        const closedBarPct = cr.totalBudget > 0 ? Math.min(1, cr.totalSpent / cr.totalBudget) : (cr.totalSpent > 0 ? 1 : 0)
        const closedBarColor = cr.totalSpent > cr.totalBudget ? '#EF4444' : '#2563EB'

        const closedWithSpend = cr.categories.filter(c => c.status !== 'sin_gasto')
          .sort((a, b) => {
            if (a.status === 'sobregiro' && b.status !== 'sobregiro') return -1
            if (a.status !== 'sobregiro' && b.status === 'sobregiro') return 1
            if (a.status === 'sobregiro' && b.status === 'sobregiro') return a.diff - b.diff
            return b.spent - a.spent
          })
        const closedNoSpend = cr.noSpendCategories
        const closedNoSpendBudget = closedNoSpend.reduce((s, c) => s + c.budget, 0)

        return (
        <>
          {/* Backfill warning */}
          {data.isBackfilled && (
            <div style={{
              background: '#FEF3C7', borderRadius: 12, padding: '12px 16px',
              marginBottom: 16, fontSize: 13, color: '#92400E', lineHeight: 1.5,
            }}>
              Los montos presupuestados de este mes se calcularon con base en tu presupuesto actual. Si cambiaste montos después, podrían no coincidir con lo que tenías en ese momento.
            </div>
          )}

          {/* Hero */}
          <div style={{
            background: '#1E3A5F', borderRadius: 20,
            padding: '32px 36px', color: '#fff', marginBottom: 20,
          }}>
            <div style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 22, lineHeight: 1.3, marginBottom: 4,
            }}>
              {cr.tone === 'bad' ? (
                <>
                  Cerraste con <span style={{ color: '#EF4444', fontFamily: "'Outfit', sans-serif", fontWeight: 800 }}>{formatMoney(cr.overrun)}</span> de sobregiro
                </>
              ) : (
                cr.headline
              )}
            </div>
            <div style={{ fontSize: 14, color: '#9FB3CB', marginBottom: 20 }}>
              {cr.sub}
            </div>

            {/* Final bar (no expected marker) */}
            <div style={{ position: 'relative', height: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 7, marginBottom: 12 }}>
              <div style={{
                width: `${closedBarPct * 100}%`, height: '100%', borderRadius: 7,
                background: closedBarColor, transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 13, color: '#9FB3CB' }}>
              {formatMoney(cr.totalSpent)} gastados de {formatMoney(cr.totalBudget)}
            </div>

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9FB3CB', textTransform: 'uppercase' }}>Gastado</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4 }}>{formatMoney(cr.totalSpent)}</div>
              </div>
              {cr.overrun > 0 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#FCA5A5', textTransform: 'uppercase' }}>Sobregiro</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4, color: '#FCA5A5' }}>
                    {formatMoney(cr.overrun)}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#4ADE80', textTransform: 'uppercase' }}>Sobrante</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4, color: '#4ADE80' }}>
                    {formatMoney(cr.available)}
                  </div>
                </div>
              )}
              {cr.avgPrevMonths !== null && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9FB3CB', textTransform: 'uppercase' }}>vs promedio</div>
                  <div style={{
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4,
                    color: (cr.diffVsAvg ?? 0) <= 0 ? '#4ADE80' : '#FCA5A5',
                  }}>
                    {(cr.diffVsAvg ?? 0) <= 0 ? '' : '+'}{cr.diffVsAvgPct}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sobregiro summary cards */}
          {cr.overCategories.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16 }}>
                Se excedieron
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cr.overCategories.map(cat => (
                  <div key={cat.categoryId} style={{
                    background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12,
                    padding: '14px 18px', fontSize: 14, color: '#991B1B',
                  }}>
                    <strong>{cat.name}</strong> cerró {formatMoney(Math.abs(cat.diff))} arriba del presupuesto de {formatMoney(cat.budget)}.
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* En línea summary */}
          {cr.okCategories.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16 }}>
                Dentro del presupuesto
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cr.okCategories.slice(0, 3).map(cat => (
                  <div key={cat.categoryId} style={{
                    background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 12,
                    padding: '14px 18px', fontSize: 14, color: '#065F46',
                  }}>
                    <strong>{cat.name}</strong> cerró en {formatMoney(cat.spent)} de {formatMoney(cat.budget)} ({Math.round(cat.pctOfBudget * 100)}%).
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories list */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px' }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 4,
            }}>
              Resultado por categoría
            </div>
            <div style={{ fontSize: 13, color: '#8B9AAE', marginBottom: 20 }}>
              Toca una categoría para ver sus transacciones
            </div>

            {closedWithSpend.map(cat => {
              const sc = CLOSED_STATUS_COLORS[cat.status] ?? CLOSED_STATUS_COLORS.en_linea
              const barPct = cat.budget > 0 ? Math.min(1, cat.spent / cat.budget) : (cat.spent > 0 ? 1 : 0)

              return (
                <div
                  key={cat.categoryId}
                  onClick={() => router.push(`/resumen/categoria/${cat.categoryId}?mes=${selectedMonth.month}`)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '16px 0', borderTop: '1px solid #EEF1F6', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F', flex: 1 }}>{cat.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                      background: sc.pillBg, color: sc.pill,
                    }}>
                      {sc.label}
                    </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E3A5F', minWidth: 80, textAlign: 'right' }}>
                      {formatMoney(cat.spent)}
                    </span>
                    <ChevronRight style={{ width: 16, height: 16, color: '#64748B', flexShrink: 0 }} />
                  </div>

                  {/* Bar (no expected marker for closed months) */}
                  <div style={{ marginLeft: 18, position: 'relative', height: 8, background: '#F3F5F9', borderRadius: 4 }}>
                    <div style={{
                      width: `${barPct * 100}%`, height: '100%', borderRadius: 4,
                      background: cat.status === 'sobregiro' ? '#EF4444' : '#2563EB',
                    }} />
                  </div>

                  {/* Bottom line */}
                  <div style={{ marginLeft: 18, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8B9AAE' }}>
                    <span>de {formatMoney(cat.budget)} · {Math.round(cat.pctOfBudget * 100)}%</span>
                    {cat.status === 'sobregiro' ? (
                      <span style={{ color: '#EF4444', fontWeight: 600 }}>+{formatMoney(Math.abs(cat.diff))}</span>
                    ) : (
                      <span>sobraron {formatMoney(cat.diff)}</span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Collapsible no-spend categories */}
            {closedNoSpend.length > 0 && (
              <>
                <button
                  onClick={() => setShowNoSpend(!showNoSpend)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '14px 0', borderTop: '1px solid #EEF1F6',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#64748B', fontWeight: 600,
                    fontFamily: 'inherit',
                  }}
                >
                  <ChevronDown style={{
                    width: 16, height: 16,
                    transform: showNoSpend ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }} />
                  {closedNoSpend.length} categorías sin movimiento ({formatMoney(closedNoSpendBudget)} presupuestados)
                </button>
                {showNoSpend && closedNoSpend.map(cat => (
                  <div
                    key={cat.categoryId}
                    onClick={() => router.push(`/resumen/categoria/${cat.categoryId}?mes=${selectedMonth.month}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 0', borderTop: '1px solid #EEF1F6', cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748B', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: '#64748B', flex: 1 }}>{cat.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                      background: '#F1F5F9', color: '#64748B',
                    }}>
                      Sin gasto
                    </span>
                    <span style={{ fontSize: 13, color: '#64748B' }}>{formatMoney(cat.budget)}</span>
                    <ChevronRight style={{ width: 16, height: 16, color: '#64748B', flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}
          </div>
        </>
        )
      })()}

      {/* === ESTE MES (current) === */}
      {tab === 'mes' && !selectedMonth.isClosed && (
        <>
          {/* 3.1 Estado del mes (hero) */}
          <div style={{
            background: '#1E3A5F', borderRadius: 20,
            padding: '32px 36px', color: '#fff', marginBottom: 20,
          }}>
            <div style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 22, lineHeight: 1.3, marginBottom: 4,
            }}>
              {ms.verdict.tone === 'danger' ? (
                <>
                  Vas <span style={{ color: '#EF4444', fontFamily: "'Outfit', sans-serif", fontWeight: 800 }}>{formatMoney(ms.totalOverrun)}</span> arriba del presupuesto en {ms.overCategories.length} categoría{ms.overCategories.length !== 1 ? 's' : ''}
                </>
              ) : (
                ms.verdict.headline
              )}
            </div>
            <div style={{ fontSize: 14, color: '#9FB3CB', marginBottom: 20 }}>
              {ms.verdict.sub}
            </div>

            {/* Pace bar */}
            <div style={{ position: 'relative', height: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 7, marginBottom: 12 }}>
              <div style={{
                width: `${pctBar * 100}%`, height: '100%', borderRadius: 7,
                background: barColor, transition: 'width 0.3s',
              }} />
              <div style={{
                position: 'absolute', top: -4, left: `${expectedMark * 100}%`,
                width: 2, height: 22, background: '#fff', borderRadius: 1, opacity: 0.7,
              }} />
            </div>
            <div style={{ fontSize: 13, color: '#9FB3CB' }}>
              {formatMoney(ms.totalSpent)} gastados de {formatMoney(ms.totalBudget)} · esperado a hoy: {formatMoney(ms.totalExpected)}
            </div>

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#9FB3CB', textTransform: 'uppercase' }}>Gastado</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4 }}>{formatMoney(ms.totalSpent)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#FCA5A5', textTransform: 'uppercase' }}>Sobregiro</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4, color: ms.totalOverrun > 0 ? '#FCA5A5' : '#fff' }}>
                  {formatMoney(ms.totalOverrun)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#4ADE80', textTransform: 'uppercase' }}>Disponible</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 24, marginTop: 4, color: '#4ADE80' }}>
                  {formatMoney(ms.available)}
                </div>
              </div>
            </div>
          </div>

          {/* 3.2 Semáforo */}
          {(ms.overCategories.length > 0 || ms.riskCategories.length > 0) && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16 }}>
                Necesita atención
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ms.overCategories.map(cat => {
                  const largest = largestTxForCategory(cat.categoryId)
                  const bigExplains = largest && cat.overrun > 0 && largest.amount >= 0.6 * cat.overrun
                  return (
                    <div key={cat.categoryId} style={{
                      background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12,
                      padding: '14px 18px', fontSize: 14, color: '#991B1B',
                    }}>
                      <strong>{cat.name}</strong> ya superó el presupuesto por {formatMoney(cat.overrun)}.{bigExplains ? ' Una compra explica casi todo.' : ''}
                    </div>
                  )
                })}
                {ms.riskCategories.map(cat => (
                  <div key={cat.categoryId} style={{
                    background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12,
                    padding: '14px 18px', fontSize: 14, color: '#92400E',
                  }}>
                    <strong>{cat.name}</strong> va al {Math.round(cat.pctOfBudget * 100)}% con {Math.round(cat.pctOfMonthElapsed * 100)}% del mes transcurrido. A este ritmo cerrarías en {formatMoney(cat.projection)}.
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Va bien */}
          {ms.okCategories.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16 }}>
                Va bien
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ms.okCategories.slice(0, 3).map(cat => {
                  const catRow = data.budgetCats.find(c => c.id === cat.categoryId)
                  const isPaidFixed = catRow?.pace_mode === 'fixed' && cat.spent > 0 && monthCtx.dayOfMonth >= (catRow?.expected_day ?? 1)
                  return (
                    <div key={cat.categoryId} style={{
                      background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 12,
                      padding: '14px 18px', fontSize: 14, color: '#065F46',
                    }}>
                      {isPaidFixed
                        ? <><strong>{cat.name}</strong> pagado según lo previsto.</>
                        : <><strong>{cat.name}</strong> va al {Math.round(cat.pctOfBudget * 100)}% con {Math.round(cat.pctOfMonthElapsed * 100)}% del mes transcurrido.</>
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3.3 Presupuesto por categoría */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px' }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 4,
            }}>
              Presupuesto por categoría
            </div>
            <div style={{ fontSize: 13, color: '#8B9AAE', marginBottom: 20 }}>
              Toca una categoría para ver sus transacciones
            </div>

            {withSpend.map(cat => {
              const catRow = data.budgetCats.find(c => c.id === cat.categoryId)
              const sc = STATUS_COLORS[cat.status] ?? STATUS_COLORS.en_linea
              const barPct = cat.budget > 0 ? Math.min(1, cat.spent / cat.budget) : (cat.spent > 0 ? 1 : 0)
              const expectedPct = cat.budget > 0 ? Math.min(1, cat.expected / cat.budget) : 0
              const isPendingFixed = catRow?.pace_mode === 'fixed' && cat.spent === 0 && monthCtx.dayOfMonth < (catRow?.expected_day ?? 1)

              return (
                <div
                  key={cat.categoryId}
                  onClick={() => router.push(`/resumen/categoria/${cat.categoryId}?mes=${selectedMonth.month}`)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '16px 0', borderTop: '1px solid #EEF1F6', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F', flex: 1 }}>{cat.name}</span>
                    {isPendingFixed ? (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                        background: '#F1F5F9', color: '#64748B',
                      }}>
                        Pendiente · día {catRow?.expected_day}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                        background: sc.pillBg, color: sc.pill,
                      }}>
                        {sc.label}
                      </span>
                    )}
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E3A5F', minWidth: 80, textAlign: 'right' }}>
                      {formatMoney(cat.spent)}
                    </span>
                    <ChevronRight style={{ width: 16, height: 16, color: '#64748B', flexShrink: 0 }} />
                  </div>

                  {/* Bar */}
                  <div style={{ marginLeft: 18, position: 'relative', height: 8, background: '#F3F5F9', borderRadius: 4 }}>
                    <div style={{
                      width: `${barPct * 100}%`, height: '100%', borderRadius: 4,
                      background: cat.status === 'sobregiro' ? '#EF4444' : cat.status === 'riesgo' ? '#F59E0B' : '#2563EB',
                    }} />
                    {cat.budget > 0 && (
                      <div style={{
                        position: 'absolute', top: -2, left: `${expectedPct * 100}%`,
                        width: 2, height: 12, background: '#1E3A5F', borderRadius: 1, opacity: 0.4,
                      }} />
                    )}
                  </div>

                  {/* Bottom line */}
                  <div style={{ marginLeft: 18, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8B9AAE' }}>
                    <span>de {formatMoney(cat.budget)} · {Math.round(cat.pctOfBudget * 100)}%</span>
                    {cat.status === 'sobregiro' ? (
                      <span style={{ color: '#EF4444', fontWeight: 600 }}>+{formatMoney(cat.overrun)}</span>
                    ) : (
                      <span>quedan {formatMoney(cat.remaining)}</span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Collapsible no-spend categories */}
            {noSpend.length > 0 && (
              <>
                <button
                  onClick={() => setShowNoSpend(!showNoSpend)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '14px 0', borderTop: '1px solid #EEF1F6',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#64748B', fontWeight: 600,
                    fontFamily: 'inherit',
                  }}
                >
                  <ChevronDown style={{
                    width: 16, height: 16,
                    transform: showNoSpend ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }} />
                  Ver {noSpend.length} categorías sin movimiento ({formatMoney(noSpendBudgetSum)} presupuestados)
                </button>
                {showNoSpend && noSpend.map(cat => (
                  <div
                    key={cat.categoryId}
                    onClick={() => router.push(`/resumen/categoria/${cat.categoryId}?mes=${selectedMonth.month}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 0', borderTop: '1px solid #EEF1F6', cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748B', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: '#64748B', flex: 1 }}>{cat.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                      background: '#F1F5F9', color: '#64748B',
                    }}>
                      Sin gasto
                    </span>
                    <span style={{ fontSize: 13, color: '#64748B' }}>{formatMoney(cat.budget)}</span>
                    <ChevronRight style={{ width: 16, height: 16, color: '#64748B', flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* === INSIGHTS === */}
      {tab === 'insights' && userPlan === 'free' && (
        <div style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          minHeight: 320, marginBottom: 20,
        }}>
          <div style={{
            filter: 'blur(8px)', opacity: 0.5, pointerEvents: 'none',
            padding: '32px 36px', background: '#1E3A5F', borderRadius: 20,
            color: '#fff', minHeight: 200,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9FB3CB', textTransform: 'uppercase', marginBottom: 16 }}>
              Comparado con el mes anterior
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 44 }}>Q 0,000.00</div>
            <div style={{ marginTop: 24, display: 'flex', gap: 40 }}>
              <div>
                <div style={{ fontSize: 13, color: '#9FB3CB' }}>Este mes</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 4 }}>Q 0,000.00</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#9FB3CB' }}>Mes anterior</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 4 }}>Q 0,000.00</div>
              </div>
            </div>
          </div>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
              borderRadius: 20, padding: '32px 28px', color: '#fff', maxWidth: 340, width: '100%',
              boxShadow: '0 8px 32px rgba(37,99,235,0.3)',
            }}>
              <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                Insights detallados
              </p>
              <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5, marginBottom: 20 }}>
                Compara tu gasto con el mes anterior, detecta categorías que suben y recibe alertas inteligentes.
              </p>
              <button
                onClick={async () => {
                  const res = await fetch('/api/stripe/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan: 'monthly' }),
                  })
                  const { url } = await res.json()
                  if (url) window.location.href = url
                }}
                style={{
                  background: '#fff', color: '#1E3A5F',
                  border: 'none', borderRadius: 10, padding: '12px 24px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%',
                }}
              >
                Desbloquear con Premium
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === 'insights' && userPlan === 'premium' && (() => {
        const d = monthCtx.dayOfMonth
        const isClosed = selectedMonth.isClosed
        const isSameDay = isClosed ? false : insightsMode === 'same_day'
        const prevAmount = isSameDay ? data.spentPrevSameDay.total : data.spentPrevMonth
        const insDiff = data.spentMonth - prevAmount
        const insDiffPct = prevAmount > 0 ? Math.round(Math.abs(insDiff) / prevAmount * 100) : 0
        const isNeutral = Math.abs(insDiffPct) < 3

        // Fixed categories context line (only for current month with same_day mode)
        const fixedPaidPrevNotNow = isClosed ? [] : data.budgetCats.filter(c => {
          if (c.pace_mode !== 'fixed') return false
          const eid = c.expected_day ?? 1
          const prevByCatName = isSameDay ? data.spentPrevSameDay.byCat : {}
          const prevSpent = prevByCatName[c.name] ?? 0
          const currSpent = data.paceItems.find(p => p.categoryId === c.id)?.spent ?? 0
          return prevSpent > 0 && currSpent === 0 && d < eid
        })
        const fixedPaidSum = fixedPaidPrevNotNow.reduce((s, c) => {
          const prev = isSameDay ? (data.spentPrevSameDay.byCat[c.name] ?? 0) : (data.categories.find(cat => cat.name === c.name)?.prevAmount ?? 0)
          return s + prev
        }, 0)
        const adjustedDiff = insDiff + fixedPaidSum
        const adjustedDiffPct = (prevAmount - fixedPaidSum) > 0 ? Math.round(Math.abs(adjustedDiff) / (prevAmount - fixedPaidSum) * 100) : 0

        // Insights
        const insights: Array<{ text: string; tone: 'warn' | 'ok' | 'info' }> = []

        // Unique category going up while rest goes down
        const catsUp = data.categories.filter(c => {
          const prev = isSameDay ? (data.spentPrevSameDay.byCat[c.name] ?? 0) : c.prevAmount
          return c.amount > prev && prev > 0
        })
        const catsDown = data.categories.filter(c => {
          const prev = isSameDay ? (data.spentPrevSameDay.byCat[c.name] ?? 0) : c.prevAmount
          return c.amount <= prev && prev > 0
        })
        if (catsUp.length === 1 && catsDown.length >= 2) {
          const cat = catsUp[0]
          const prev = isSameDay ? (data.spentPrevSameDay.byCat[cat.name] ?? 0) : cat.prevAmount
          const pctVsPrev = prev > 0 ? Math.round((cat.amount / prev) * 100) : 0
          insights.push({
            text: isClosed
              ? `${cat.name} fue la única categoría que subió: ${formatMoney(cat.amount)} vs ${formatMoney(prev)} en ${data.prevMonthLabel}.`
              : `${cat.name} es la única categoría subiendo, y ya va a ${pctVsPrev}% de ${data.prevMonthLabel} (${formatMoney(prev)}).`,
            tone: 'warn',
          })
        }

        // Pending fixed payments (only for current month)
        if (!isClosed) {
          const pendingFixed = data.budgetCats.filter(c => {
            if (c.pace_mode !== 'fixed') return false
            const eid = c.expected_day ?? 1
            const spent = data.paceItems.find(p => p.categoryId === c.id)?.spent ?? 0
            return spent === 0 && d < eid
          })
          if (pendingFixed.length > 0) {
            const pendingSum = pendingFixed.reduce((s, c) => s + Number(c.budgeted_amount), 0)
            const names = pendingFixed.map(c => c.name).join(', ')
            insights.push({
              text: `Aún no aparece el pago de ${names} este mes. Si son ${formatMoney(pendingSum)}, tu disponible real es ${formatMoney(Math.max(0, ms.available - pendingSum))}.`,
              tone: 'info',
            })
          }
        }

        return (
        <>
          {/* Toggle (only for current month) */}
          {!isClosed && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            <button
              onClick={() => setInsightsMode('same_day')}
              style={{
                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                background: insightsMode === 'same_day' ? '#2563EB' : '#E7EBF2',
                color: insightsMode === 'same_day' ? '#fff' : '#64748B',
              }}
            >
              Al día {d} de cada mes
            </button>
            <button
              onClick={() => setInsightsMode('full')}
              style={{
                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                background: insightsMode === 'full' ? '#2563EB' : '#E7EBF2',
                color: insightsMode === 'full' ? '#fff' : '#64748B',
              }}
            >
              Mes completo
            </button>
          </div>
          )}

          <div style={{
            background: '#1E3A5F', borderRadius: 20,
            padding: '32px 36px', color: '#fff', marginBottom: 20,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#9FB3CB', textTransform: 'uppercase', marginBottom: 16,
            }}>
              {isClosed
                ? `${data.currentMonthLabel} vs ${data.prevMonthLabel} completo`
                : isSameDay ? `Comparado al día ${d} del mes anterior` : 'Comparado con el mes anterior completo'
              }
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 44 }}>
                {formatMoney(data.spentMonth)}
              </div>
              <div style={{
                background: isNeutral ? 'rgba(148,163,184,0.2)' : insDiff <= 0 ? 'rgba(22,101,52,0.2)' : 'rgba(239,68,68,0.2)',
                color: isNeutral ? '#64748B' : insDiff <= 0 ? '#4ADE80' : '#FCA5A5',
                fontWeight: 700, fontSize: 14,
                padding: '8px 16px', borderRadius: 20,
              }}>
                {isNeutral ? '≈' : insDiff <= 0 ? '↓' : '↑'} {insDiffPct}% vs mes anterior
              </div>
            </div>
            <div style={{ display: 'flex', gap: 40, marginTop: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: '#9FB3CB' }}>
                  {isClosed ? data.currentMonthLabel : `${data.currentMonthLabel}, día ${d}`}
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 4 }}>
                  {formatMoney(data.spentMonth)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#9FB3CB' }}>
                  {isClosed ? data.prevMonthLabel : `${data.prevMonthLabel}, ${isSameDay ? `día ${d}` : 'completo'}`}
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 4 }}>
                  {formatMoney(prevAmount)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#9FB3CB' }}>Diferencia</div>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 19, marginTop: 4,
                  color: isNeutral ? '#64748B' : insDiff <= 0 ? '#4ADE80' : '#FCA5A5',
                }}>
                  {insDiff <= 0 ? '-' : '+'}{formatMoney(Math.abs(insDiff))}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed categories context */}
          {isSameDay && fixedPaidPrevNotNow.length > 0 && (
            <div style={{
              background: '#FEF3C7', borderRadius: 16, padding: '16px 20px',
              marginBottom: 20, fontSize: 14, color: '#92400E', lineHeight: 1.5,
            }}>
              En {data.prevMonthLabel} a esta altura ya habías pagado {fixedPaidPrevNotNow.map(c => c.name).join(', ')} ({formatMoney(fixedPaidSum)}). Sin esos rubros, la diferencia real es {adjustedDiff <= 0 ? '-' : '+'}{adjustedDiffPct}%.
            </div>
          )}

          {/* Category breakdown */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', marginBottom: 20 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Cambios por categoría
            </div>
            {data.categories.map((cat) => {
              const prev = isSameDay ? (data.spentPrevSameDay.byCat[cat.name] ?? 0) : cat.prevAmount
              const catDiff = cat.amount - prev
              const catPct = prev > 0 ? Math.round(Math.abs(catDiff) / prev * 100) : 0
              const isSavings = cat.bucket === 'savings'
              const isPositive = isSavings ? catDiff >= 0 : catDiff <= 0
              const noBothMonths = cat.amount === 0 && prev === 0
              return (
                <div key={cat.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 0', borderTop: '1px solid #EEF1F6',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>{cat.name}</div>
                      {!noBothMonths && prev > 0 && (
                        <div style={{
                          fontSize: '12px', fontWeight: 700,
                          color: noBothMonths ? '#64748B' : isPositive ? '#16A34A' : '#DC2626',
                          background: noBothMonths ? '#F1F5F9' : isPositive ? '#EAFBF1' : '#FEE2E2',
                          padding: '3px 9px', borderRadius: 12,
                        }}>
                          {catDiff <= 0 ? '↓' : '↑'} {catPct}%
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: '#1E3A5F' }}>
                        {formatMoney(cat.amount)}
                      </div>
                      {prev > 0 && (
                        <div style={{ fontSize: 12, color: '#8B9AAE' }}>
                          ant: {formatMoney(prev)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Lo que zafi nota */}
          {insights.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px' }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16,
              }}>
                Lo que zafi nota
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.map((ins, i) => (
                  <div key={i} style={{
                    background: ins.tone === 'warn' ? '#FEF3C7' : ins.tone === 'ok' ? '#D1FAE5' : '#DBEAFE',
                    border: `1px solid ${ins.tone === 'warn' ? '#FDE68A' : ins.tone === 'ok' ? '#A7F3D0' : '#93C5FD'}`,
                    borderRadius: 12, padding: '14px 18px',
                    fontSize: 14, color: ins.tone === 'warn' ? '#92400E' : ins.tone === 'ok' ? '#065F46' : '#1E40AF',
                    lineHeight: 1.5,
                  }}>
                    {ins.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
        )
      })()}

      {/* === TENDENCIAS === */}
      {tab === 'tendencias' && userPlan === 'free' && (
        <div style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          minHeight: 320, marginBottom: 20,
        }}>
          <div style={{
            filter: 'blur(8px)', opacity: 0.5, pointerEvents: 'none',
            padding: '32px 36px', background: '#1E3A5F', borderRadius: 20,
            color: '#fff', minHeight: 200,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9FB3CB', textTransform: 'uppercase', marginBottom: 4 }}>
              Promedio mensual
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 44 }}>Q 0,000.00</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24 }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#9FB3CB' }}>Necesidades</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 28, marginTop: 4 }}>50%</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#9FB3CB' }}>Deseos</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 28, marginTop: 4 }}>30%</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#9FB3CB' }}>Ahorro</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 28, marginTop: 4 }}>20%</div>
              </div>
            </div>
          </div>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
              borderRadius: 20, padding: '32px 28px', color: '#fff', maxWidth: 340, width: '100%',
              boxShadow: '0 8px 32px rgba(37,99,235,0.3)',
            }}>
              <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                Tendencias de gasto
              </p>
              <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5, marginBottom: 20 }}>
                Ve tu evolución mensual, distribución 50/30/20, y alertas sobre patrones de gasto en los últimos 6 meses.
              </p>
              <button
                onClick={async () => {
                  const res = await fetch('/api/stripe/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan: 'monthly' }),
                  })
                  const { url } = await res.json()
                  if (url) window.location.href = url
                }}
                style={{
                  background: '#fff', color: '#1E3A5F',
                  border: 'none', borderRadius: 10, padding: '12px 24px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%',
                }}
              >
                Desbloquear con Premium
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === 'tendencias' && userPlan === 'premium' && (() => {
        const history = data.monthlyHistory
        const complete = history.filter(m => !m.isPartial)

        // Average from complete months only
        const avgTotal = complete.length > 0 ? Math.round(complete.reduce((s, m) => s + m.total, 0) / complete.length) : 0

        const firstLabel = complete.length > 0 ? complete[0].label : ''
        const lastLabel = complete.length > 0 ? complete[complete.length - 1].label : ''
        const currentMonthName = data.currentMonthLabel

        // 50/30/20 from complete months
        const avgNeeds = complete.length > 0 ? complete.reduce((s, m) => s + m.needs, 0) / complete.length : 0
        const avgWants = complete.length > 0 ? complete.reduce((s, m) => s + m.wants, 0) / complete.length : 0
        const avgSavings = complete.length > 0 ? complete.reduce((s, m) => s + m.savings, 0) / complete.length : 0
        const avgSum = avgNeeds + avgWants + avgSavings || 1
        const pctNeeds = Math.round(avgNeeds / avgSum * 100)
        const pctWants = Math.round(avgWants / avgSum * 100)
        const pctSavings = Math.round(avgSavings / avgSum * 100)

        // Alerts from complete months only
        const alerts: Array<{ text: string; tone: 'warn' | 'success' }> = []

        // Deseos trend: 3+ consecutive months rising or falling
        if (complete.length >= 3) {
          const wants = complete.map(m => m.wants)
          let rising = 0
          let falling = 0
          for (let i = 1; i < wants.length; i++) {
            if (wants[i] > wants[i - 1]) { rising++; falling = 0 }
            else if (wants[i] < wants[i - 1]) { falling++; rising = 0 }
            else { rising = 0; falling = 0 }
          }
          if (rising >= 2) {
            const last3 = wants.slice(-3)
            alerts.push({
              text: `Deseos crecen ${rising + 1} meses seguidos: ${last3.map(v => formatMoney(v)).join(' → ')}.`,
              tone: 'warn',
            })
          } else if (falling >= 2) {
            const last3 = wants.slice(-3)
            alerts.push({
              text: `Deseos bajan ${falling + 1} meses seguidos: ${last3.map(v => formatMoney(v)).join(' → ')}.`,
              tone: 'success',
            })
          }
        }

        // Ahorro variability
        if (complete.length >= 2) {
          const savingsVals = complete.map(m => m.savings)
          const savAvg = savingsVals.reduce((s, v) => s + v, 0) / savingsVals.length
          const savStd = Math.sqrt(savingsVals.reduce((s, v) => s + (v - savAvg) ** 2, 0) / savingsVals.length)
          const savMin = Math.min(...savingsVals)
          const savMax = Math.max(...savingsVals)
          const savRate = data.totalIncome > 0 ? Math.round(savAvg / data.totalIncome * 100) : 0
          const cv = savAvg > 0 ? savStd / savAvg : 0
          if (cv < 0.15) {
            alerts.push({
              text: `Ahorro estable en ${formatMoney(savMin)}–${formatMoney(savMax)} cada mes. Tasa promedio ${savRate}%.`,
              tone: 'success',
            })
          } else {
            alerts.push({
              text: `Ahorro irregular: de ${formatMoney(savMin)} a ${formatMoney(savMax)}. Tasa promedio ${savRate}%.`,
              tone: 'warn',
            })
          }
        }

        // Necesidades variability
        if (complete.length >= 2) {
          const needsVals = complete.map(m => m.needs)
          const nMin = Math.min(...needsVals)
          const nMax = Math.max(...needsVals)
          if (nMin > 0 && nMax / nMin > 2) {
            const maxMonth = complete.find(m => m.needs === nMax)
            alerts.push({
              text: `Necesidades muy variables (${formatMoney(nMin)} a ${formatMoney(nMax)}). Revisa si ${maxMonth?.label ?? ''} tuvo un pago anual.`,
              tone: 'warn',
            })
          }
        }

        // Evolution chart data
        const chartMonths = history
        const chartMax = Math.max(...chartMonths.map(m => m.total), 1)
        const chartH = 200
        const chartPadY = 20
        const usableH = chartH - 2 * chartPadY
        const toY = (v: number) => chartPadY + usableH - (v / chartMax) * usableH
        const spacing = chartMonths.length > 1 ? 360 / (chartMonths.length - 1) : 180
        const toX = (i: number) => 10 + i * spacing

        const totalPath = chartMonths.map((m, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(m.total)}`).join(' ')

        const wantsPath = chartMonths.map((m, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(m.wants)}`).join(' ')
        const savingsPath = chartMonths.map((m, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(m.savings)}`).join(' ')

        // Split paths for partial month dashed segment
        const lastIdx = chartMonths.length - 1
        const hasPartial = chartMonths.length > 0 && chartMonths[lastIdx].isPartial
        const solidEnd = hasPartial ? lastIdx - 1 : lastIdx

        function splitPath(fullPath: string, pts: Array<{ x: number; y: number }>) {
          if (!hasPartial || pts.length < 2) return { solid: fullPath, dashed: '' }
          const solidPts = pts.slice(0, solidEnd + 1)
          const dashPts = pts.slice(solidEnd)
          const solid = solidPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
          const dashed = dashPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
          return { solid, dashed }
        }

        const totalPts = chartMonths.map((m, i) => ({ x: toX(i), y: toY(m.total) }))

        const wantsPts = chartMonths.map((m, i) => ({ x: toX(i), y: toY(m.wants) }))
        const savingsPts = chartMonths.map((m, i) => ({ x: toX(i), y: toY(m.savings) }))

        const totalSplit = splitPath(totalPath, totalPts)

        const wantsSplit = splitPath(wantsPath, wantsPts)
        const savingsSplit = splitPath(savingsPath, savingsPts)

        // 50/30/20 delta helpers
        const metaNeeds = 50, metaWants = 30, metaSavings = 20
        const deltaNeedsVal = pctNeeds - metaNeeds
        const deltaWantsVal = pctWants - metaWants
        const deltaSavingsVal = pctSavings - metaSavings
        const needsFavorable = deltaNeedsVal <= 0
        const wantsFavorable = deltaWantsVal <= 0
        const savingsFavorable = deltaSavingsVal >= 0
        const fmtDelta = (d: number) => (d > 0 ? `+${d}` : `${d}`)

        return (
        <>
          {/* Promedio mensual */}
          <div style={{
            background: '#1E3A5F', borderRadius: 20,
            padding: '32px 36px', color: '#fff', marginBottom: 20,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              color: '#9FB3CB', textTransform: 'uppercase', marginBottom: 4,
            }}>
              {complete.length >= 2 ? `Promedio mensual · ${firstLabel}–${lastLabel}` : 'Promedio mensual'}
            </div>
            <div style={{ fontSize: 13, color: '#7E93AE', marginBottom: 16 }}>
              {complete.length > 0
                ? `Gasto + ahorro de meses cerrados.${history.some(m => m.isPartial) ? ` ${currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)} se excluye por estar en curso.` : ''}`
                : 'Gasto + ahorro.'}
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 44 }}>
              {formatMoney(avgTotal)}
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
                {alerts.map((a, i) => (
                  <div key={i} style={{
                    background: a.tone === 'success' ? 'rgba(22,163,74,0.15)' : 'rgba(245,158,11,0.15)',
                    borderRadius: 12, padding: '12px 16px',
                    fontSize: 14, color: a.tone === 'success' ? '#4ADE80' : '#FDE68A',
                    lineHeight: 1.5,
                  }}>
                    {a.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 50/30/20 Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Necesidades', pct: pctNeeds, meta: metaNeeds, delta: deltaNeedsVal, favorable: needsFavorable, color: '#2563EB' },
              { label: 'Deseos', pct: pctWants, meta: metaWants, delta: deltaWantsVal, favorable: wantsFavorable, color: '#F59E0B' },
              { label: 'Ahorro', pct: pctSavings, meta: metaSavings, delta: deltaSavingsVal, favorable: savingsFavorable, color: '#10B981' },
            ].map(b => (
              <div key={b.label} style={{
                background: '#fff', borderRadius: 16, padding: '24px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 8 }}>
                  {b.label}
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 36, color: '#1E3A5F' }}>
                  {b.pct}%
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 600, marginTop: 6,
                  color: b.favorable ? '#16A34A' : '#F59E0B',
                }}>
                  meta {b.meta}% · {fmtDelta(b.delta)}
                </div>
              </div>
            ))}
          </div>

          {/* Evolution chart */}
          {chartMonths.length >= 2 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', marginBottom: 20 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 20,
              }}>
                Evolución mensual
              </div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                  <span style={{ width: 14, height: 2, background: '#2563EB', display: 'inline-block' }} />Total
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                  <span style={{ width: 14, height: 2, background: '#10B981', display: 'inline-block' }} />Ahorro
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1E3A5F' }}>
                  <span style={{ width: 14, height: 2, background: '#F59E0B', display: 'inline-block' }} />Deseos
                </div>
              </div>
              <svg width="100%" height="200" viewBox={`0 0 ${toX(lastIdx) + 10} 200`} preserveAspectRatio="none">
                <line x1="0" y1={toY(chartMax * 0.25)} x2={toX(lastIdx) + 10} y2={toY(chartMax * 0.25)} stroke="#EEF1F6" strokeWidth="1" />
                <line x1="0" y1={toY(chartMax * 0.5)} x2={toX(lastIdx) + 10} y2={toY(chartMax * 0.5)} stroke="#EEF1F6" strokeWidth="1" />
                <line x1="0" y1={toY(chartMax * 0.75)} x2={toX(lastIdx) + 10} y2={toY(chartMax * 0.75)} stroke="#EEF1F6" strokeWidth="1" />
                {/* Total */}
                <path d={totalSplit.solid} fill="none" stroke="#2563EB" strokeWidth="2.5" />
                {totalSplit.dashed && <path d={totalSplit.dashed} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.5" />}
                {/* Savings */}
                <path d={savingsSplit.solid} fill="none" stroke="#10B981" strokeWidth="2" />
                {savingsSplit.dashed && <path d={savingsSplit.dashed} fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />}
                {/* Wants */}
                <path d={wantsSplit.solid} fill="none" stroke="#F59E0B" strokeWidth="2" />
                {wantsSplit.dashed && <path d={wantsSplit.dashed} fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />}
                {/* Dots — selected month gets a highlight ring */}
                {totalPts.map((p, i) => {
                  const isSelected = chartMonths[i].month === selectedMonth.month
                  return (
                    <g key={`t${i}`}>
                      {isSelected && (
                        <circle cx={p.x} cy={p.y} r="7" fill="none" stroke="#2563EB" strokeWidth="2" opacity="0.4" />
                      )}
                      <circle cx={p.x} cy={p.y} r={isSelected ? 5 : 3} fill="#2563EB" opacity={chartMonths[i].isPartial ? 0.5 : 1} />
                    </g>
                  )
                })}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                {chartMonths.map((m, i) => {
                  const isSelected = m.month === selectedMonth.month
                  return (
                    <span key={i} style={{
                      color: isSelected ? '#2563EB' : m.isPartial ? '#B0BEC5' : '#8B9AAE',
                      fontWeight: isSelected ? 700 : 400,
                    }}>
                      {m.isPartial ? `${m.label} · en curso` : m.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Distribución mensual */}
          {chartMonths.length >= 1 && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px' }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                color: '#8B9AAE', textTransform: 'uppercase', marginBottom: 16,
              }}>
                Distribución mensual
              </div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 20, fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1E3A5F' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                  Necesidades
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1E3A5F' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                  Deseos
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1E3A5F' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  Ahorro
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {chartMonths.map(m => {
                  const mTotal = m.total || 1
                  const nPct = Math.round(m.needs / mTotal * 100)
                  const wPct = Math.round(m.wants / mTotal * 100)
                  const sPct = 100 - nPct - wPct
                  const isSelected = m.month === selectedMonth.month
                  return (
                    <div key={m.month} style={{
                      opacity: m.isPartial ? 0.55 : 1,
                      background: isSelected ? '#EFF6FF' : 'transparent',
                      borderRadius: isSelected ? 10 : 0,
                      padding: isSelected ? '10px 12px' : 0,
                      border: isSelected ? '1.5px solid #BFDBFE' : 'none',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#1E3A5F', marginBottom: 6 }}>
                        <span style={{ fontWeight: isSelected ? 700 : 600 }}>
                          {m.isPartial ? `${m.label} · en curso` : m.label}
                        </span>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>{formatMoney(m.total)}</span>
                      </div>
                      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden' }}>
                        <div style={{ width: `${nPct}%`, background: '#2563EB' }} />
                        <div style={{ width: `${wPct}%`, background: '#F59E0B' }} />
                        <div style={{ width: `${sPct}%`, background: '#10B981' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
        )
      })()}

      <div className="h-6" />
    </AppShell>
  )
}
