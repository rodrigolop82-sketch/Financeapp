'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { useGoals, type Goal } from '@/hooks/useGoals'
import {
  BADGE_NEUTRAL, BADGE_OK, BADGE_WARN, ErrorBox, GroupTitle, ListCard, ROW_DIVIDER, RowBody, Tile,
} from '@/components/layout/Pantalla'
import { CARD, GREEN_TEXT } from '@/components/resumen/ctf-ui'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { AddRow, PlanHero, ProgressBar, RowAmount } from '@/components/plan/ui'
import { GoalForm } from '@/components/goals/GoalForm'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { UndoToast } from '@/components/transactions/UndoToast'
import { SkeletonRows } from '@/components/motion/PageSkeleton'

type RowState = 'on_track' | 'behind' | 'completed' | 'paused'

const BAR_COLOR: Record<RowState, string> = {
  on_track: '#2563EB',
  behind: '#F59E0B',
  completed: '#22C55E',
  paused: '#94A3B8',
}

function rowState(g: Goal): RowState {
  if (g.status === 'completed' || g.projection.status === 'completed') return 'completed'
  if (g.status === 'paused') return 'paused'
  return g.projection.status === 'behind' ? 'behind' : 'on_track'
}

function rowNote(g: Goal, state: RowState): string {
  if (state === 'completed') return 'Ya juntaste todo lo que querías.'
  if (state === 'paused') return 'En pausa: no cuenta en el total.'
  const p = g.projection
  if (p.status === 'on_track' && p.estimatedDate) {
    return `A este ritmo: ${p.estimatedDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}`
  }
  return p.message
}

/**
 * Metas: cuerpo de la sección "Metas" en /plan. `addRequest` cambia cuando se
 * llega desde /metas/nueva para abrir la hoja. `deletedId` llega del detalle
 * de meta ("Sí, eliminar"): la meta sale de la lista y se borra cuando vence
 * el "Deshacer" (o al salir de la pantalla).
 */
export function MetasView({ addRequest = 0, deletedId = null, onDeletedHandled }: {
  addRequest?: number
  deletedId?: string | null
  onDeletedHandled?: () => void
}) {
  const fmt = useFormatMoney()
  const { goals: allGoals, isLoading, error, createGoal, deleteGoal, avgMonthlyExpenses } = useGoals()
  const [removed, setRemoved] = useState<Goal | null>(null)
  const removedRef = useRef<Goal | null>(null)
  const goals = removed ? allGoals.filter((g) => g.id !== removed.id) : allGoals

  const commitDelete = useCallback(async () => {
    const g = removedRef.current
    if (!g) return
    removedRef.current = null
    setRemoved(null)
    try { await deleteGoal(g.id) } catch { setMessage({ text: 'No se pudo eliminar la meta. Intenta de nuevo.', tone: 'error' }) }
  }, [deleteGoal])

  useEffect(() => {
    if (!deletedId || isLoading) return
    const g = allGoals.find((x) => x.id === deletedId)
    if (g) {
      removedRef.current = g
      setRemoved(g)
    }
    onDeletedHandled?.()
  }, [deletedId, isLoading, allGoals, onDeletedHandled])

  // Si se sale de la pantalla con el "Deshacer" abierto, el borrado se confirma.
  const commitRef = useRef(commitDelete)
  commitRef.current = commitDelete
  useEffect(() => () => { void commitRef.current() }, [])
  const [sheetKey, setSheetKey] = useState<number | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)

  const openNew = useCallback(() => setSheetKey(Date.now()), [])
  // Solo los toques nuevos abren la hoja (no el valor con el que se monta).
  const seenRequest = useRef(addRequest)
  useEffect(() => {
    if (addRequest === seenRequest.current) return
    seenRequest.current = addRequest
    openNew()
  }, [addRequest, openNew])

  if (isLoading) return <SkeletonRows count={4} className="mt-3.5" />

  const active = goals.filter((g) => g.status === 'active' && rowState(g) !== 'completed')
  const completed = goals.filter((g) => rowState(g) === 'completed')
  const paused = goals.filter((g) => g.status === 'paused' && rowState(g) !== 'completed')
  const saved = active.reduce((s, g) => s + g.currentAmount, 0)
  const target = active.reduce((s, g) => s + g.targetAmount, 0)

  const list = (title: string, rows: Goal[], withAdd = false) =>
    (rows.length > 0 || withAdd) && (
      <section>
        <GroupTitle>{title}</GroupTitle>
        <ListCard>
          {rows.map((g) => {
            const state = rowState(g)
            const ratio = g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0
            const badge =
              state === 'completed' ? <span className={BADGE_OK}>Completada</span>
              : state === 'behind' ? <span className={BADGE_WARN}>Atrasada</span>
              : state === 'paused' ? <span className={BADGE_NEUTRAL}>En pausa</span>
              : null
            return (
              <Link
                key={g.id}
                href={`/metas/${g.id}?from=plan`}
                className={`flex flex-col gap-2.5 py-3 transition duration-150 active:scale-[0.98] ${ROW_DIVIDER}`}
              >
                <span className="flex items-center gap-3">
                  <RowBody
                    tile={<Tile>{g.emoji}</Tile>}
                    name={g.name}
                    badge={badge}
                    help={<><b className={`font-semibold ${GREEN_TEXT}`}>{fmt(g.currentAmount)}</b> de {fmt(g.targetAmount)}</>}
                  />
                  <RowAmount className={state === 'completed' ? GREEN_TEXT : TEXT_STRONG}>
                    {Math.min(100, Math.round(ratio * 100))}%
                  </RowAmount>
                </span>
                <ProgressBar ratio={ratio} color={BAR_COLOR[state]} />
                <span className={`text-[13px] ${state === 'behind' ? 'text-warning-text dark:text-warning' : TEXT_MUTED}`}>
                  {rowNote(g, state)}
                </span>
              </Link>
            )
          })}
          {withAdd && <AddRow label="Crear una meta" onClick={openNew} />}
        </ListCard>
      </section>
    )

  return (
    <>
      <div className="flex max-w-2xl flex-col zafi-stagger">
        {error && <div className="mt-3.5"><ErrorBox>{error}</ErrorBox></div>}

        {goals.length === 0 ? (
          <div className={`mt-3.5 flex flex-col items-center gap-3 px-5 py-8 text-center ${CARD}`}>
            <span aria-hidden className="text-[40px] leading-none">🎯</span>
            <p className={`text-[17px] font-bold ${TEXT_STRONG}`}>Aún no tienes metas</p>
            <p className={`text-sm leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>
              Un viaje, un fondo para emergencias, un carro: ponle nombre y Zafi te dice cuándo llegas.
            </p>
            <button type="button" onClick={openNew} className={`mt-1 ${PRIMARY_BUTTON}`}>Crear mi primera meta</button>
          </div>
        ) : (
          <>
            <PlanHero
              label="Ahorrado en metas"
              amount={fmt(saved)}
              sub={`de ${fmt(target)} · ${active.length} ${active.length === 1 ? 'meta' : 'metas'} en curso`}
              pct={target > 0 ? saved / target : 0}
            />
            {list('En curso', active, true)}
            {list('En pausa', paused)}
            {list('Completadas', completed)}
          </>
        )}
      </div>

      <BottomSheet themed open={sheetKey !== null} onClose={() => setSheetKey(null)} label="Nueva meta">
        {sheetKey !== null && (
          <GoalForm
            key={sheetKey}
            avgMonthlyExpenses={avgMonthlyExpenses}
            onSubmit={async (input) => {
              await createGoal(input)
              setSheetKey(null)
              setMessage({ text: `Creamos ${input.name}`, tone: 'ok' })
            }}
          />
        )}
      </BottomSheet>
      <UndoToast
        key={removed?.id}
        visible={!!removed}
        title="Meta eliminada"
        subtitle={removed?.name}
        onUndo={() => { removedRef.current = null; setRemoved(null) }}
        onDismiss={() => void commitDelete()}
      />
      <StatusToast message={message} onDone={() => setMessage(null)} />
    </>
  )
}
