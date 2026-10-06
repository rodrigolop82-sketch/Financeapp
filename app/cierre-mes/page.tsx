'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { AppShell } from '@/components/layout/AppShell'
import {
  getMonthCloseChecklist, getPreviousYearMonth,
  type ChecklistItem, type MonthCloseChecklist,
} from '@/lib/month-close'
import { addMonths, longMonth, monthTitle } from '@/lib/como-te-fue'
import { localToday } from '@/lib/dates'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { MonthPill } from '@/components/resumen/MonthPill'
import { CARD } from '@/components/resumen/ctf-ui'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import {
  FieldLabel, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, INPUT_48, ListCard, PageHeader, PILL_OUTLINE, PillButton,
  ROW_DIVIDER, RowBody, Tile,
} from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON } from '@/components/movimientos/ui'
import { useHealthScore } from '@/hooks/useHealthScore'
import { saveMonthScore } from '@/lib/health-data'
import { notifyScoreInputsChanged } from '@/lib/score-feedback'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { Note } from '@/components/plan/ui'
import { ScoreHero } from '@/components/score/ScoreUI'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'

const SOURCE_META: Record<string, { emoji: string; label: string }> = {
  tarjeta_credito: { emoji: '💳', label: 'Tarjeta de crédito' },
  cuenta_bancaria: { emoji: '🏦', label: 'Cuenta bancaria' },
  efectivo: { emoji: '💵', label: 'Efectivo' },
}

export default function CierreMesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <CierreMesContent />
    </Suspense>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function CierreMesContent() {
  const [checklist, setChecklist] = useState<MonthCloseChecklist | null>(null)
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const [yearMonth, setYearMonth] = useState(() => {
    const fromUrl = searchParams.get('month')
    return fromUrl && /^\d{4}-\d{2}$/.test(fromUrl) ? fromUrl : getPreviousYearMonth()
  })
  const [marking, setMarking] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [outsideSavings, setOutsideSavings] = useState<number | null>(null)
  const { score, history, recalculate } = useHealthScore(householdId, { month: yearMonth, history: true })
  const router = useRouter()
  const supabase = createClient()
  const current = localToday().slice(0, 7)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Same household resolution as the rest of the app (see getUserHousehold).
    const household = await getUserHousehold(supabase, user.id)
    const householdId = household?.id
    if (!householdId) { setLoading(false); return }
    setHouseholdId(householdId)
    const { data: profile } = await supabase.from('financial_profiles').select('total_savings')
      .eq('household_id', householdId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    setOutsideSavings(profile ? Number(profile.total_savings) || 0 : null)

    const result = await getMonthCloseChecklist(user.id, householdId, yearMonth)
    setChecklist(result)
    setLoading(false)
  }, [supabase, router, yearMonth])

  useEffect(() => { load() }, [load])

  async function markSourceLoaded(sourceId: string) {
    setMarking(sourceId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('source_monthly_status').upsert(
      {
        user_source_id: sourceId,
        year_month: yearMonth,
        loaded: true,
        loaded_at: new Date().toISOString(),
      },
      { onConflict: 'user_source_id,year_month' },
    )

    setMarking(null)
    load()
  }

  if (loading) {
    return <PageSkeleton variant="detail" />
  }

  const monthName = longMonth(yearMonth)
  const pill = (
    <MonthPill
      label={monthTitle(yearMonth, current)}
      canPrev
      canNext={yearMonth < current}
      onPrev={() => setYearMonth(addMonths(yearMonth, -1))}
      onNext={() => setYearMonth(addMonths(yearMonth, 1))}
    />
  )

  const sources = checklist?.items.filter((i) => i.type === 'source') ?? []
  const plan = checklist?.items.filter((i) => i.type === 'income') ?? []

  const closed = history.some((h) => h.month === yearMonth)

  return (
    <AppShell title={`Cerrar ${monthName}`} currentPath="/cierre-mes" hideMobileBar headerRight={<div className="self-center">{pill}</div>}>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader
          back={{ href: '/mas', label: 'Más' }}
          title={`Cerrar ${monthName}`}
          subtitle="Repasa cómo te fue y guarda tu puntaje del mes"
          right={pill}
        />

        {householdId && score && score.components.length > 0 && (
          <MonthScore
            key={yearMonth}
            householdId={householdId}
            yearMonth={yearMonth}
            monthName={monthName}
            score={score}
            history={history}
            closed={closed}
            outsideSavings={outsideSavings}
            onSaved={(savings) => {
              if (savings !== null) setOutsideSavings(savings)
              void recalculate()
            }}
          />
        )}

        {!checklist || sources.length === 0 ? (
          <div className={`mt-3.5 flex flex-col gap-1.5 p-5 ${CARD}`}>
            <span className={`text-[17px] font-bold ${TEXT_STRONG}`}>Agrega tus bancos</span>
            <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
              Así Zafi sabe qué estados de cuenta te faltan para cerrar {monthName}.
            </span>
            <Link href="/mis-fuentes" className="mt-2 flex h-11 items-center self-start rounded-full bg-electric px-5 text-[15px] font-bold text-white transition-transform duration-150 active:scale-[0.97]">
              Agregar mis bancos
            </Link>
          </div>
        ) : (
          <div key={yearMonth} className="flex flex-col zafi-stagger">
            <Hero checklist={checklist} monthName={monthName} yearMonth={yearMonth} />

            <GroupTitle>Carga tus bancos</GroupTitle>
            <ListCard>
              {sources.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  busy={marking === item.sourceId}
                  onAct={() => item.sourceId && markSourceLoaded(item.sourceId)}
                />
              ))}
            </ListCard>

            <GroupTitle>Confirma tu plan</GroupTitle>
            <ListCard>
              {plan.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  monthName={monthName}
                  onAct={() => router.push(`/plan?confirmMonth=${yearMonth}`)}
                />
              ))}
            </ListCard>
            <p className={`mx-1 mt-3 text-[13px] leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>
              Cuando todo esté listo, guardamos tu plan de {monthName} y sus números pasan a Cómo te fue.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function itemName(item: ChecklistItem): string {
  return item.type === 'income' ? 'tus ingresos' : item.label
}

function Hero({ checklist, monthName, yearMonth }: { checklist: MonthCloseChecklist; monthName: string; yearMonth: string }) {
  const { completedCount: done, totalCount: total, isFullyClosed: all } = checklist
  const missing = checklist.items.filter((i) => !i.done).map(itemName)
  const pct = total > 0 ? (done / total) * 100 : 100
  return (
    <section aria-label="Avance del cierre" className={`mt-3.5 flex flex-col gap-1.5 p-[22px] ${HERO}`} style={HERO_STYLE}>
      <span className={`text-[15px] ${HERO_MUTED}`}>{all ? capitalize(monthName) : `Para cerrar ${monthName}`}</span>
      <span className="font-outfit text-[54px] font-extrabold leading-none tracking-[-0.02em]">
        {all ? 'Cerrado' : `${done} de ${total}`}
      </span>
      <span className={`text-sm leading-[1.45] [text-wrap:pretty] ${HERO_MUTED}`}>
        {all
          ? 'Tus números ya cuentan para Cómo te fue.'
          : `Te falta${missing.length > 1 ? 'n' : ''}: ${missing.join(', ')}.`}
      </span>
      <div
        className="mt-2 h-2 overflow-hidden rounded-[5px] bg-white/[0.14]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div
          className={`h-full rounded-[5px] transition-[width,background-color] duration-[400ms] ${all ? 'bg-[#4ADE80]' : 'bg-electric-pale'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {all && (
        <Link
          href={`/resumen?mes=${yearMonth}`}
          className="mt-2.5 flex h-[46px] items-center justify-center rounded-full bg-white text-[15px] font-bold text-navy transition-transform duration-150 active:scale-[0.97]"
        >
          Ver cómo te fue ›
        </Link>
      )}
    </section>
  )
}

function Row({ item, busy, monthName, onAct }: {
  item: ChecklistItem
  busy?: boolean
  monthName?: string
  onAct: () => void
}) {
  const isSource = item.type === 'source'
  const meta = SOURCE_META[item.sourceType ?? ''] ?? SOURCE_META.tarjeta_credito
  const isCash = item.sourceType === 'efectivo'

  let emoji: string, name: string, help: string, cta: string
  if (isSource) {
    emoji = meta.emoji
    name = item.label
    help = item.done
      ? `Cargado · ${meta.label.toLowerCase()}`
      : isCash ? 'Anota lo que pagaste en efectivo' : meta.label
    cta = isCash ? 'Ya está' : 'Cargar'
  } else {
    emoji = '💰'
    name = `Tus ingresos de ${monthName}`
    help = item.done ? 'Confirmados' : item.needsSetup ? 'Agrega tus ingresos en tu plan' : 'Confirma lo que recibiste'
    cta = item.needsSetup ? 'Configurar' : 'Revisar'
  }

  return (
    <div className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
      <RowBody tile={<Tile>{emoji}</Tile>} name={name} help={help} />
      {item.done ? (
        <span
          aria-label="Listo"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-success-light text-sm font-extrabold text-[#15803D] dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]"
        >
          ✓
        </span>
      ) : (
        <PillButton onClick={onAct} disabled={busy}>{busy ? '…' : cta}</PillButton>
      )}
    </div>
  )
}

function MonthScore({ householdId, yearMonth, monthName, score, history, closed, outsideSavings, onSaved }: {
  householdId: string
  yearMonth: string
  monthName: string
  score: NonNullable<ReturnType<typeof useHealthScore>['score']>
  history: ReturnType<typeof useHealthScore>['history']
  closed: boolean
  outsideSavings: number | null
  onSaved: (savings: number | null) => void
}) {
  const fmt = useFormatMoney()
  const [answer, setAnswer] = useState<'same' | 'changed' | null>(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)

  const prev = [...history].reverse().find((h) => h.month < yearMonth) ?? null
  const d = prev ? score.total - prev.score : 0
  const sub = !prev
    ? `Así terminas ${monthName}.`
    : d > 0 ? `Subiste ${d} ${d === 1 ? 'punto' : 'puntos'} este mes 🎉`
    : d < 0 ? `Bajaste ${-d} ${d === -1 ? 'punto' : 'puntos'} este mes.`
    : 'Te mantuviste igual.'
  const best = [...score.components].sort((a, b) => b.score / b.max - a.score / a.max)[0]

  async function close() {
    setSaving(true)
    const supabase = createClient()
    let savings: number | null = null
    if (answer === 'changed') {
      const n = parseFloat(value.replace(/[^0-9.]/g, ''))
      if (Number.isFinite(n) && n >= 0) {
        savings = n
        await supabase.from('financial_profiles').update({ total_savings: n }).eq('household_id', householdId)
      }
    }
    const { error } = await saveMonthScore(supabase, householdId, yearMonth, score.total)
    setSaving(false)
    if (error) { setMessage({ text: 'No se pudo cerrar el mes. Intenta de nuevo.', tone: 'error' }); return }
    setMessage({ text: `Guardamos tu puntaje de ${monthName}`, tone: 'ok' })
    if (savings !== null) notifyScoreInputsChanged()
    onSaved(savings)
  }

  return (
    <div className="flex flex-col zafi-stagger">
      <ScoreHero score={score} label={`Tu salud financiera en ${monthName}`} sub={sub} />
      {best && (
        <Note tone="ok">
          Lo que más te ayudó: <b>{best.emoji} {best.label}</b> ({best.score}/{best.max}).
        </Note>
      )}

      {outsideSavings !== null && !closed && (
        <section>
          <GroupTitle>Confirma un dato</GroupTitle>
          <div className={`flex flex-col gap-3 px-3.5 py-4 ${CARD}`}>
            <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>
              ¿Tus ahorros fuera de Zafi siguen en {fmt(outsideSavings)}?
            </span>
            <span className={`text-[13px] ${TEXT_MUTED}`}>Cuentas o efectivo que no registras aquí. Es opcional.</span>
            <div className="flex gap-1.5">
              <PillButton className={answer === 'same' ? undefined : PILL_OUTLINE} onClick={() => setAnswer('same')}>Sí, igual</PillButton>
              <PillButton className={answer === 'changed' ? undefined : PILL_OUTLINE} onClick={() => setAnswer('changed')}>Cambió</PillButton>
            </div>
            {answer === 'changed' && (
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="ahorros-fuera">Ahorros fuera de Zafi</FieldLabel>
                <input id="ahorros-fuera" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Q 0.00" className={INPUT_48} />
              </div>
            )}
          </div>
        </section>
      )}

      <button type="button" onClick={() => void close()} disabled={closed || saving} className={`mt-3.5 ${PRIMARY_BUTTON}`}>
        {closed ? 'Mes cerrado ✓' : saving ? 'Guardando…' : `Cerrar ${monthName}`}
      </button>
      <StatusToast message={message} onDone={() => setMessage(null)} />
    </div>
  )
}
