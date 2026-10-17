'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { AppShell } from '@/components/layout/AppShell'
import {
  getMonthCloseChecklist, getPreviousYearMonth, setSinIngresos,
  type ChecklistItem, type MonthCloseChecklist,
} from '@/lib/month-close'
import { addMonths, longMonth, monthTitle } from '@/lib/como-te-fue'
import { localToday } from '@/lib/dates'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { MonthPill } from '@/components/resumen/MonthPill'
import { CARD } from '@/components/resumen/ctf-ui'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import {
  FieldLabel, INPUT_48, PageHeader, PILL_OUTLINE, PillButton,
} from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON } from '@/components/movimientos/ui'
import { useHealthScore } from '@/hooks/useHealthScore'
import { saveMonthScore } from '@/lib/health-data'
import { notifyScoreInputsChanged } from '@/lib/score-feedback'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { Note } from '@/components/plan/ui'
import { ProvisionalTag, ScoreHero } from '@/components/score/ScoreUI'
import { openAddSheet } from '@/components/dashboard/BottomNav'
import { TRANSACTIONS_CHANGED_EVENT } from '@/components/add/AddSheet'
import { lastDayOf } from '@/lib/cierre-ui'
import { mejorParte } from '@/lib/salud-resumen'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { PremiumSheet } from '@/components/premium/PremiumSheet'
import { fetchEffectivePlan } from '@/lib/plan-client'
import { freeHistoryStart } from '@/lib/plans'

const SOURCE_META: Record<string, { label: string; help: string; cta: string }> = {
  tarjeta_credito: { label: 'Estado de cuenta', help: 'Carga el movimiento del mes para que tus gastos queden completos.', cta: 'Cargar' },
  cuenta_bancaria: { label: 'Estado de cuenta', help: 'Carga el movimiento del mes para que tus gastos queden completos.', cta: 'Cargar' },
  efectivo: { label: 'Gastos en efectivo', help: 'Anota lo que pagaste en efectivo este mes.', cta: 'Anotar' },
}

export default function CierreMesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <CierreMesContent />
    </Suspense>
  )
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
  const fmt = useFormatMoney()
  const current = localToday().slice(0, 7)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  // Gratis: los meses antes de los últimos 3 no se abren (siguen guardados).
  const [firstMonth, setFirstMonth] = useState<string | null>(null)
  const [premiumOpen, setPremiumOpen] = useState(false)
  useEffect(() => {
    fetchEffectivePlan().then((p) => {
      if (p?.plan !== 'free') return
      const first = freeHistoryStart(localToday()).slice(0, 7)
      setFirstMonth(first)
      setYearMonth((m) => (m < first ? first : m))
    })
  }, [])

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

    const result = await getMonthCloseChecklist(householdId, yearMonth)
    setChecklist(result)
    setLoading(false)
  }, [supabase, router, yearMonth])

  useEffect(() => { load() }, [load])

  // Un ingreso o gasto nuevo (desde "Registrar ingreso") recalcula pasos y puntaje.
  useEffect(() => {
    function onChanged() { void load(); void recalculate() }
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onChanged)
  }, [load, recalculate])

  async function markSourceLoaded(sourceId: string) {
    setMarking(sourceId)
    await supabase.from('source_statement_status').upsert(
      { source_id: sourceId, year_month: yearMonth, loaded: true, loaded_at: new Date().toISOString() },
      { onConflict: 'source_id,year_month' },
    )
    setMarking(null)
    void load()
  }

  async function toggleSinIngresos(value: boolean) {
    if (!householdId) return
    setMarking('income')
    const { error } = await setSinIngresos(householdId, yearMonth, value)
    setMarking(null)
    if (error) { setMessage({ text: 'No se pudo guardar. Intenta de nuevo.', tone: 'error' }); return }
    void load()
    void recalculate()
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
      onPrev={() => {
        const prev = addMonths(yearMonth, -1)
        if (firstMonth && prev < firstMonth) { setPremiumOpen(true); return }
        setYearMonth(prev)
      }}
      onNext={() => setYearMonth(addMonths(yearMonth, 1))}
    />
  )

  const closed = history.some((h) => h.month === yearMonth)
  const back = { href: `/resumen?mes=${yearMonth}`, label: 'Cómo te fue' }

  return (
    <AppShell title={`Cerrar ${monthName}`} currentPath="/cierre-mes" hideMobileBar headerRight={<div className="self-center">{pill}</div>}>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={back} title={`Cerrar ${monthName}`} right={pill} />

        {closed ? (
          score && score.components.length > 0 && <ClosedMonth score={score} history={history} yearMonth={yearMonth} monthName={monthName} />
        ) : checklist && householdId && (
          <div key={yearMonth} className="flex flex-col zafi-stagger">
            <Progress checklist={checklist} />

            {checklist.items.map((item, i) => item.type === 'income' ? (
              <IncomeStep
                key={item.id}
                n={i + 1}
                item={item}
                checklist={checklist}
                monthName={monthName}
                busy={marking === 'income'}
                fmt={fmt}
                onRegister={() => openAddSheet({ type: 'income', date: yearMonth === current ? localToday() : lastDayOf(yearMonth) })}
                onSinIngresos={(v) => void toggleSinIngresos(v)}
              />
            ) : (
              <SourceStep
                key={item.id}
                n={i + 1}
                item={item}
                busy={marking === item.sourceId}
                onImport={() => router.push('/transacciones?importar=1')}
                onDone={() => item.sourceId && void markSourceLoaded(item.sourceId)}
              />
            ))}

            {checklist.items.every((i) => i.type !== 'source') && (
              <Step n={null} done={false} title="Tus bancos" optional>
                <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
                  Agrega tus cuentas y tarjetas en Mis cuentas para que Zafi te recuerde cargar sus estados de cuenta.
                </span>
                <Link href="/mis-fuentes" className="flex h-11 items-center self-start text-sm font-semibold text-electric">Agregar mis bancos ›</Link>
              </Step>
            )}

            <CloseBlock
              householdId={householdId}
              yearMonth={yearMonth}
              monthName={monthName}
              checklist={checklist}
              score={score}
              outsideSavings={outsideSavings}
              fmt={fmt}
              onClosed={(savings) => {
                if (savings !== null) setOutsideSavings(savings)
                void recalculate()
              }}
              onMessage={setMessage}
            />
          </div>
        )}
      </div>
      <StatusToast message={message} onDone={() => setMessage(null)} />
      <PremiumSheet reason="history" open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </AppShell>
  )
}

/** "0 de 2 pasos obligatorios" con barra. */
function Progress({ checklist }: { checklist: MonthCloseChecklist }) {
  const { completedCount: done, totalCount: total } = checklist
  return (
    <section aria-label="Avance del cierre" className={`mt-3.5 flex flex-col gap-2.5 px-5 py-4 ${CARD}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>{done} de {total} {total === 1 ? 'paso obligatorio' : 'pasos obligatorios'}</span>
        <span className={`text-[13px] ${TEXT_MUTED}`}>
          {done === total ? 'Listo para cerrar' : total === 1 ? 'Cierra cuando lo completes' : total === 2 ? 'Cierra cuando completes ambos' : 'Cierra cuando completes todos'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-[5px] bg-[var(--zafi-border-light)]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-full rounded-[5px] bg-electric transition-[width] duration-[400ms]" style={{ width: `${Math.max(4, (done / Math.max(1, total)) * 100)}%` }} />
      </div>
    </section>
  )
}

/** Tarjeta de un paso: número (o ✓), título y contenido. */
function Step({ n, done, title, optional = false, children }: { n: number | null; done: boolean; title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <section className={`mt-3 flex gap-3.5 p-5 ${CARD}`}>
      {done ? (
        <span aria-label="Listo" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-success-light text-sm font-extrabold text-[#15803D] dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]">✓</span>
      ) : n === null ? (
        <span aria-hidden className={`flex h-9 w-9 flex-none items-center justify-center rounded-full border border-dashed border-[var(--zafi-border)] text-sm ${TEXT_MUTED}`}>+</span>
      ) : (
        <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-electric text-sm font-bold text-electric">{n}</span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className={`text-[17px] font-bold ${TEXT_STRONG}`}>
          {title}{optional && <span className={`text-[13px] font-normal ${TEXT_MUTED}`}> · opcional</span>}
        </h2>
        {children}
      </div>
    </section>
  )
}

function IncomeStep({ n, item, checklist, monthName, busy, fmt, onRegister, onSinIngresos }: {
  n: number
  item: ChecklistItem
  checklist: MonthCloseChecklist
  monthName: string
  busy: boolean
  fmt: (n: number) => string
  onRegister: () => void
  onSinIngresos: (value: boolean) => void
}) {
  const { registrados, sinIngresos } = checklist.ingresos
  return (
    <Step n={n} done={item.done} title={`Ingresos de ${monthName}`}>
      {registrados > 0 ? (
        <>
          <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Registraste {fmt(registrados)} en ingresos este mes.</span>
          <button type="button" onClick={onRegister} className="flex h-11 items-center self-start text-sm font-semibold text-electric">Registrar otro ingreso ›</button>
        </>
      ) : sinIngresos ? (
        <>
          <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Marcaste que no hubo ingresos en {monthName}. Tu ahorro del mes cuenta como 0 %.</span>
          <div className="flex flex-wrap gap-2">
            <PillButton onClick={onRegister}>Registrar ingreso</PillButton>
            <PillButton className={PILL_OUTLINE} onClick={() => onSinIngresos(false)} disabled={busy}>Deshacer</PillButton>
          </div>
        </>
      ) : (
        <>
          <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Aún no hay ingresos registrados este mes. Sin ellos no se calcula tu ahorro.</span>
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" onClick={onRegister} className="btn-primary" style={{ borderRadius: 14 }}>Registrar ingreso</button>
            <PillButton className={PILL_OUTLINE} onClick={() => onSinIngresos(true)} disabled={busy}>{busy ? '…' : 'No hubo ingresos'}</PillButton>
          </div>
        </>
      )}
    </Step>
  )
}

function SourceStep({ n, item, busy, onImport, onDone }: {
  n: number
  item: ChecklistItem
  busy: boolean
  onImport: () => void
  onDone: () => void
}) {
  const meta = SOURCE_META[item.sourceType ?? ''] ?? SOURCE_META.cuenta_bancaria
  const cash = item.sourceType === 'efectivo'
  return (
    <Step n={n} done={item.done} title={cash ? meta.label : `${meta.label} de ${item.label}`}>
      <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>{item.done ? 'Cargado.' : meta.help}</span>
      {!item.done && (
        <div className="mt-1 flex flex-wrap gap-2">
          {!cash && <button type="button" onClick={onImport} className="btn-primary" style={{ borderRadius: 14 }}>{meta.cta}</button>}
          <PillButton className={cash ? undefined : PILL_OUTLINE} onClick={onDone} disabled={busy}>{busy ? '…' : cash ? 'Ya está' : 'Ya lo cargué'}</PillButton>
        </div>
      )}
    </Step>
  )
}

/** Ahorros fuera de Zafi (opcional), botón Cerrar y "Así quedaría {mes}". */
function CloseBlock({ householdId, yearMonth, monthName, checklist, score, outsideSavings, fmt, onClosed, onMessage }: {
  householdId: string
  yearMonth: string
  monthName: string
  checklist: MonthCloseChecklist
  score: ReturnType<typeof useHealthScore>['score']
  outsideSavings: number | null
  fmt: (n: number) => string
  onClosed: (savings: number | null) => void
  onMessage: (m: StatusMessage) => void
}) {
  const [answer, setAnswer] = useState<'same' | 'changed' | null>(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const missing = checklist.totalCount - checklist.completedCount
  // Un mes cerrado no puede quedar provisional: el paso de ingresos lo evita.
  const canClose = checklist.canClose && !!score && score.components.length > 0 && !score.provisional

  async function close() {
    if (!score) return
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
    if (error) { onMessage({ text: 'No se pudo cerrar el mes. Intenta de nuevo.', tone: 'error' }); return }
    onMessage({ text: `Cerraste ${monthName}`, tone: 'ok' })
    if (savings !== null) notifyScoreInputsChanged()
    onClosed(savings)
  }

  return (
    <>
      {outsideSavings !== null && (
        <Step n={null} done={answer !== null} title="Ahorros fuera de Zafi" optional>
          <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
            Si guardaste dinero en otra cuenta o en efectivo, actualízalo aquí. Hoy tienes {fmt(outsideSavings)}.
          </span>
          <div className="flex gap-1.5">
            <PillButton className={answer === 'same' ? undefined : PILL_OUTLINE} onClick={() => setAnswer('same')}>Sigue igual</PillButton>
            <PillButton className={answer === 'changed' ? undefined : PILL_OUTLINE} onClick={() => setAnswer('changed')}>Cambió</PillButton>
          </div>
          {answer === 'changed' && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="ahorros-fuera">Ahorros fuera de Zafi</FieldLabel>
              <input id="ahorros-fuera" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Q 0.00" className={INPUT_48} />
            </div>
          )}
        </Step>
      )}

      <button type="button" onClick={() => void close()} disabled={!canClose || saving} className={`mt-4 ${PRIMARY_BUTTON}`}>
        {saving ? 'Guardando…' : `Cerrar ${monthName}`}
      </button>
      {!checklist.canClose && (
        <p className={`mt-2 text-[13px] leading-[1.4] ${TEXT_MUTED}`}>
          Se activa al completar {missing === 1 && checklist.totalCount > 1 ? 'el paso obligatorio que falta' : checklist.totalCount === 1 ? 'el paso obligatorio' : `los ${checklist.totalCount} pasos obligatorios`}.
        </p>
      )}

      {score && score.components.length > 0 && (
        <section className={`mt-4 flex items-center gap-4 px-5 py-4 ${CARD}`}>
          <span className={`font-outfit text-[40px] font-extrabold leading-none ${TEXT_STRONG}`}>{score.total}</span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className={`flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>
              Así quedaría {monthName}{score.provisional && <ProvisionalTag />}
            </span>
            <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
              {score.provisional
                ? 'Salud financiera provisional. Se confirma al cerrar el mes con tus ingresos reales.'
                : `Salud financiera de ${monthName} · ${score.label}. Queda guardada al cerrar.`}
            </span>
          </span>
        </section>
      )}
    </>
  )
}

/** Mes ya cerrado: el puntaje guardado y lo que más ayudó. */
function ClosedMonth({ score, history, yearMonth, monthName }: {
  score: NonNullable<ReturnType<typeof useHealthScore>['score']>
  history: ReturnType<typeof useHealthScore>['history']
  yearMonth: string
  monthName: string
}) {
  const saved = history.find((h) => h.month === yearMonth)
  const shown = saved ? { ...score, total: saved.score } : score
  const prev = [...history].reverse().find((h) => h.month < yearMonth) ?? null
  const d = prev ? shown.total - prev.score : 0
  const sub = !prev
    ? `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} está cerrado.`
    : d > 0 ? `Subiste ${d} ${d === 1 ? 'punto' : 'puntos'} este mes 🎉`
    : d < 0 ? `Bajaste ${-d} ${d === -1 ? 'punto' : 'puntos'} este mes.`
    : 'Te mantuviste igual.'
  const best = mejorParte(score.components)
  return (
    <div className="flex flex-col zafi-stagger">
      <ScoreHero score={{ ...shown, provisional: false }} label={`Tu salud financiera en ${monthName}`} sub={sub} />
      {best && (
        <Note tone="ok">
          Lo que más te ayudó: <b>{best.emoji} {best.label}</b> ({best.score}/{best.max}).
        </Note>
      )}
      <Link href={`/resumen?mes=${yearMonth}`} className={`mt-3.5 ${PRIMARY_BUTTON} flex items-center justify-center`}>Ver cómo te fue ›</Link>
    </div>
  )
}
