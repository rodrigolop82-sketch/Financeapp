'use client'
import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { GoalDetailHero, type GoalDetailState } from '@/components/goals/GoalDetailHero'
import { ContributionHistory } from '@/components/goals/ContributionHistory'
import { AddContributionSheet } from '@/components/goals/AddContributionSheet'
import { GOAL_TEMPLATES } from '@/components/goals/GoalForm'
import { useGoals, type Goal, type Contribution } from '@/hooks/useGoals'
import { formatMoney } from '@/lib/format'
import {
  DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, INPUT_48, LINK_TEXT, PageHeader, PILL_OUTLINE, PillButton, SheetHeader, Tile,
} from '@/components/layout/Pantalla'
import { CARD } from '@/components/resumen/ctf-ui'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui'
import { Note } from '@/components/plan/ui'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { PageSkeleton } from '@/components/motion/PageSkeleton'

/** A dónde vuelve "‹" según desde dónde se abrió (?from=). */
const ORIGINS: Record<string, { label: string; href: string }> = {
  plan: { label: 'Metas', href: '/plan?s=metas' },
  inicio: { label: 'Inicio', href: '/dashboard' },
  score: { label: 'Salud financiera', href: '/score' },
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "marzo de 2027" de 'YYYY-MM-DD'. */
function monthYear(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} de ${date.slice(0, 4)}`
}

function goalState(g: Goal): GoalDetailState {
  if (g.status === 'completed' || g.projection.status === 'completed') return 'completed'
  if (g.status === 'paused') return 'paused'
  return g.projection.status === 'behind' ? 'behind' : 'on_track'
}

type SheetKind = 'contrib' | 'edit' | 'delete'

export default function GoalDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <GoalDetail />
    </Suspense>
  )
}

function GoalDetail() {
  const params = useParams()
  const search = useSearchParams()
  const router = useRouter()
  const goalId = params.id as string
  const back = ORIGINS[search.get('from') ?? ''] ?? ORIGINS.plan
  const { goals, addContribution, updateGoal, togglePause, getContributionHistory, isLoading } = useGoals()
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contribLoading, setContribLoading] = useState(true)
  const [sheet, setSheet] = useState<SheetKind | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [busy, setBusy] = useState(false)

  const goal: Goal | undefined = goals.find((g) => g.id === goalId)

  const loadContributions = useCallback(async () => {
    if (!goalId) return
    try {
      setContributions(await getContributionHistory(goalId))
    } catch {
      // Sin historial: la lista queda vacía.
    } finally {
      setContribLoading(false)
    }
  }, [goalId, getContributionHistory])

  useEffect(() => {
    if (!isLoading && goalId) void loadContributions()
  }, [isLoading, goalId, loadContributions])

  if (isLoading) return <PageSkeleton variant="detail" />

  if (!goal) {
    return (
      <AppShell title="Meta" currentPath="/plan" hideMobileBar>
        <PageHeader back={back} title="Meta" />
        <p className={`py-10 text-center text-sm ${TEXT_MUTED}`}>No encontramos esta meta.</p>
      </AppShell>
    )
  }

  const state = goalState(goal)
  const subtitle = goal.targetDate ? `Para ${monthYear(goal.targetDate)}` : undefined
  // Los toasts esperan a que se cierre la hoja.
  const say = (m: StatusMessage) => { setSheet(null); setMessage(m) }

  async function handleTogglePause() {
    if (!goal) return
    setBusy(true)
    try {
      await togglePause(goal.id)
      setMessage({ text: goal.status === 'paused' ? 'Meta reanudada' : 'Meta pausada', tone: 'ok' })
    } catch {
      setMessage({ text: 'No se pudo cambiar la meta. Intenta de nuevo.', tone: 'error' })
    }
    setBusy(false)
  }

  return (
    <AppShell title={goal.name} currentPath="/plan" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={back} title={goal.name} subtitle={subtitle} />
        <Link href={back.href} className={`hidden h-11 items-center text-[15px] font-semibold lg:flex ${LINK_TEXT}`}>‹ {back.label}</Link>

        <div className="flex flex-col zafi-stagger">
          <GoalDetailHero emoji={goal.emoji} state={state} currentAmount={goal.currentAmount} targetAmount={goal.targetAmount} />

          {state === 'paused' ? (
            <div className={`mt-3 rounded-2xl border border-navy/[0.08] bg-[var(--zafi-card-alt)] px-4 py-3.5 text-sm leading-[1.45] dark:border-white/[0.06] ${TEXT_MUTED}`}>
              <b className={TEXT_STRONG}>Meta en pausa.</b> No cuenta para tu proyección ni tu salud financiera hasta que la reanudes.
            </div>
          ) : state === 'completed' ? (
            <Note tone="ok">
              <b>¡La completaste! 🎉</b> Juntaste {formatMoney(goal.targetAmount)}. Puedes crear otra meta desde Plan › Metas.
            </Note>
          ) : (
            <Projection goal={goal} />
          )}

          {state !== 'completed' && (
            <div className="mt-3.5 flex flex-col gap-2.5">
              {state === 'paused' ? (
                <button type="button" onClick={() => void handleTogglePause()} disabled={busy} className="btn-outline h-[54px] w-full !rounded-[14px]">
                  Reanudar meta
                </button>
              ) : (
                <button type="button" onClick={() => setSheet('contrib')} className={PRIMARY_BUTTON}>Aportar</button>
              )}
              <div className="flex gap-1.5">
                <PillButton onClick={() => setSheet('edit')}>Editar</PillButton>
                {state !== 'paused' && (
                  <PillButton className={PILL_OUTLINE} onClick={() => void handleTogglePause()} disabled={busy}>Pausar</PillButton>
                )}
              </div>
            </div>
          )}

          <ContributionHistory contributions={contributions} isLoading={contribLoading} />

          <button type="button" onClick={() => setSheet('delete')} className={`mt-4 ${DANGER_TEXT_BUTTON}`}>
            Eliminar meta
          </button>
        </div>
      </div>

      <AddContributionSheet
        open={sheet === 'contrib'}
        onClose={() => setSheet(null)}
        goalName={goal.name}
        goalEmoji={goal.emoji}
        currentAmount={goal.currentAmount}
        targetAmount={goal.targetAmount}
        monthlyContribution={goal.monthlyContribution}
        onConfirm={async (amount, note) => {
          const done = goal.currentAmount + amount >= goal.targetAmount
          await addContribution(goal.id, amount, note)
          await loadContributions()
          say({ text: done ? '¡Meta completada! 🎉' : `Aporte guardado · +${formatMoney(amount)}`, tone: 'ok' })
        }}
      />

      <BottomSheet themed open={sheet === 'edit'} onClose={() => setSheet(null)} label="Editar meta">
        {sheet === 'edit' && (
          <EditGoalForm
            goal={goal}
            onSave={async (patch) => {
              await updateGoal(goal.id, patch)
              say({ text: 'Meta actualizada', tone: 'ok' })
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet themed open={sheet === 'delete'} onClose={() => setSheet(null)} label="Eliminar meta">
        {sheet === 'delete' && (
          <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
            <SheetHeader emoji="🗑️" title={`¿Eliminar ${goal.name}?`} subtitle="Se borra la meta y su historial de aportes." />
            <ErrorBox>
              Esto no se puede deshacer. Si solo quieres dejar de aportar por un tiempo, mejor <b>pausa</b> la meta.
            </ErrorBox>
            {/* El borrado se confirma en Plan › Metas, con "Deshacer" (9 s). */}
            <button
              type="button"
              onClick={() => router.push(`/plan?s=metas&eliminada=${goal.id}`)}
              className="h-[54px] w-full rounded-[14px] bg-danger text-base font-semibold text-white transition duration-150 active:scale-[0.96]"
            >
              Sí, eliminar
            </button>
            <button type="button" onClick={() => setSheet(null)} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>
              Cancelar
            </button>
          </div>
        )}
      </BottomSheet>

      <StatusToast message={sheet ? null : message} onDone={() => setMessage(null)} />
    </AppShell>
  )
}

/** Tarjeta "A este ritmo…" / "No llegas a tiempo". */
function Projection({ goal }: { goal: Goal }) {
  const p = goal.projection
  const monthly = goal.monthlyContribution
  let title: string
  let help: string
  let warn = false
  if (p.status === 'behind' && goal.targetDate) {
    title = 'No llegas a tiempo'
    help = `Para llegar en ${monthYear(goal.targetDate)} necesitas ${formatMoney(p.requiredMonthly ?? 0)} al mes${monthly ? ` (hoy aportas ${formatMoney(monthly)})` : ''}.`
    warn = true
  } else if (p.estimatedDate && p.monthsRemaining) {
    title = `A este ritmo: ${p.estimatedDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}`
    const months = `${p.monthsRemaining} ${p.monthsRemaining === 1 ? 'mes' : 'meses'}`
    help = monthly
      ? `Con tu aporte de ${formatMoney(monthly)} al mes llegas en ${months}.`
      : `Al ritmo de tu ahorro promedio llegas en ${months}.`
  } else {
    title = 'Define un aporte mensual'
    help = 'Así Zafi te dice cuándo llegas.'
  }
  return (
    <div className={`mt-3 flex items-center gap-3 p-3.5 ${CARD}`}>
      <Tile>📅</Tile>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{title}</span>
        <span className={`text-[13px] leading-[1.35] ${warn ? 'text-warning-text dark:text-warning' : TEXT_MUTED}`}>{help}</span>
      </span>
    </div>
  )
}

function num(v: string): number {
  return parseFloat(v.replace(/[^0-9.]/g, '')) || 0
}

/** Hoja "Editar meta": emoji, nombre, meta, aporte al mes y para cuándo. */
function EditGoalForm({ goal, onSave }: {
  goal: Goal
  onSave: (patch: { name: string; emoji: string; targetAmount: number; monthlyContribution: number | null; targetDate: string | null }) => Promise<void>
}) {
  const emojis = GOAL_TEMPLATES.map((t) => t.emoji)
  if (!emojis.includes(goal.emoji)) emojis.unshift(goal.emoji)
  const [emoji, setEmoji] = useState(goal.emoji)
  const [name, setName] = useState(goal.name)
  const [target, setTarget] = useState(String(goal.targetAmount))
  const [monthly, setMonthly] = useState(goal.monthlyContribution ? String(goal.monthlyContribution) : '')
  const [when, setWhen] = useState(goal.targetDate ? goal.targetDate.slice(0, 7) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim() || num(target) <= 0) { setError('Ponle nombre y cuánto quieres juntar.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        emoji,
        targetAmount: num(target),
        monthlyContribution: monthly ? num(monthly) : null,
        targetDate: when ? `${when}-01` : null,
      })
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
      <SheetHeader emoji={emoji} title="Editar meta" subtitle={goal.name} />
      <div role="radiogroup" aria-label="Emoji" className="flex flex-wrap gap-2">
        {emojis.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={e === emoji}
            onClick={() => setEmoji(e)}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 text-[22px] transition duration-150 active:scale-[0.96] ${
              e === emoji ? 'border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : `border-transparent ${TILE_BG}`
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="meta-editar-nombre">Nombre</FieldLabel>
        <input id="meta-editar-nombre" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_48} />
      </div>
      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="meta-editar-monto">Meta</FieldLabel>
          <input id="meta-editar-monto" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Q 0" className={INPUT_48} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="meta-editar-aporte">Aporte al mes</FieldLabel>
          <input id="meta-editar-aporte" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Opcional" className={INPUT_48} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="meta-editar-fecha">Para cuándo</FieldLabel>
        <input id="meta-editar-fecha" type="month" value={when} onChange={(e) => setWhen(e.target.value)} className={INPUT_48} />
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={saving} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}
