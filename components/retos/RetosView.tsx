'use client'

// Retos: vista dentro de Plan › Metas (selector Metas | Retos). El progreso
// lo calcula el servidor desde las transacciones; aquí solo se muestra.
// Nada de puntos del Health Score ni ahorros que no se puedan calcular.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import {
  ErrorBox, FieldLabel, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, INPUT_48, ListCard, PillButton, ROW_DIVIDER, SheetHeader,
} from '@/components/layout/Pantalla'
import { CARD } from '@/components/resumen/ctf-ui'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui'
import { SkeletonRows } from '@/components/motion/PageSkeleton'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { PremiumAction, PremiumBadge } from '@/components/premium/PremiumTag'
import { postJson } from '@/components/recurring/useRecurring'
import type { ChallengesData, ChallengeView, TemplateView } from '@/lib/challenges/data'
import { addDays } from '@/lib/challenges/progress'
import { challengeTitle } from '@/lib/challenges/rules'

type Resp = ChallengesData & { features: { multiple: boolean; customize: boolean }; canWrite: boolean }
type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: Resp }

const TEMPLATE_EMOJI: Record<string, string> = {
  spend_reduction: '📉',
  logging_streak: '✍️',
  no_spend_category: '🚫',
  review_subscriptions: '🔁',
}

export function useChallenges() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/challenges', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setState({ status: 'ok', data: (await res.json()) as Resp })
    } catch {
      setState({ status: 'error' })
    }
  }, [])
  useEffect(() => { void load() }, [load])
  return { state, reload: load }
}

/** Cuadrícula de días: cumplido azul, hoy con borde, pendiente oscuro. */
function DayGrid({ c }: { c: ChallengeView }) {
  const p = c.progress
  const todayIdx = p.completedDays.length - 1
  return (
    <ol className="grid grid-cols-10 gap-1.5" aria-label="Días del reto">
      {Array.from({ length: p.durationDays }, (_, i) => {
        const elapsed = i < p.completedDays.length
        const done = elapsed && p.completedDays[i]
        const isToday = i === todayIdx && c.status === 'active'
        const label = `Día ${i + 1}, ${done ? 'cumplido' : isToday ? 'hoy' : elapsed ? 'no cumplido' : 'pendiente'}`
        return (
          <li
            key={i}
            aria-label={label}
            title={label}
            className="aspect-square rounded-md"
            style={{
              background: done ? '#2563EB' : '#0B1A2E',
              opacity: elapsed || isToday ? 1 : 0.55,
              boxShadow: isToday ? 'inset 0 0 0 2px #60A5FA' : undefined,
            }}
          />
        )
      })}
    </ol>
  )
}

function ActiveCard({ c, fmt, canWrite, onAbandon, onReviewed }: {
  c: ChallengeView
  fmt: (n: number) => string
  canWrite: boolean
  onAbandon: () => void
  onReviewed: () => void
}) {
  const p = c.progress
  return (
    <section className={`mt-3.5 flex flex-col gap-3 p-5 ${HERO}`} style={HERO_STYLE} aria-label={c.title}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-[22px] leading-[1.2]">{c.title}</h3>
        {p.streak > 0 && (
          <span className="flex-none rounded-full px-2.5 py-1 text-[12.5px] font-bold" style={{ background: 'rgba(96,165,250,0.18)', color: '#60A5FA' }}>
            Racha de {p.streak} {p.streak === 1 ? 'día' : 'días'}
          </span>
        )}
      </div>
      <DayGrid c={c} />
      <div className="flex flex-col gap-1">
        <span className="text-[14px] font-semibold">Día {p.dayIndex} de {p.durationDays}</span>
        {p.estimatedSavings !== null && (
          <span className={`text-[14px] ${HERO_MUTED}`}>
            <span className="font-outfit font-extrabold text-white">{fmt(p.estimatedSavings)}</span>
            {c.targetAmount ? ` ahorrados de ${fmt(c.targetAmount)}` : ' ahorrados'} · ahorro estimado
          </span>
        )}
        {p.status === 'off_track' && <span className="text-[13.5px]" style={{ color: '#FBBF24' }}>Te desviaste, aún puedes retomar.</span>}
        {c.healthComponent && <span className={`text-[13px] ${HERO_MUTED}`}>Ayuda a mejorar: {c.healthComponent}</span>}
      </div>
      {c.type === 'review_subscriptions' && (
        <div className="flex flex-wrap gap-2">
          <Link href="/resumen/suscripciones" className="flex h-11 items-center rounded-full bg-electric px-4 text-sm font-semibold text-white">Ver mis suscripciones</Link>
          {canWrite && (
            <button type="button" onClick={onReviewed} className="flex h-11 items-center rounded-full border border-white/25 px-4 text-sm font-semibold">Ya los revisé</button>
          )}
        </div>
      )}
      {canWrite && (
        <button type="button" onClick={onAbandon} className={`self-start text-[13.5px] font-semibold ${HERO_MUTED} h-11`}>
          Dejar este reto
        </button>
      )}
    </section>
  )
}

function DoneCard({ c, fmt }: { c: ChallengeView; fmt: (n: number) => string }) {
  return (
    <div className={`mt-3.5 flex flex-col gap-1.5 p-5 ${CARD}`}>
      <span aria-hidden className="text-2xl">🎉</span>
      <span className={`font-serif text-[22px] ${TEXT_STRONG}`}>¡Lo lograste!</span>
      <span className={`text-[14.5px] leading-[1.45] ${TEXT_MUTED}`}>
        Terminaste “{c.title}”: cumpliste {c.progress.daysMet} de {c.progress.durationDays} días
        {c.progress.estimatedSavings ? ` y llevas ${fmt(c.progress.estimatedSavings)} de ahorro estimado` : ''}.
      </span>
    </div>
  )
}

function StartSheet({ template, data, onClose, onStarted }: {
  template: TemplateView
  data: Resp
  onClose: () => void
  onStarted: (title: string) => void
}) {
  const [categoryId, setCategoryId] = useState<string>(template.suggestedCategoryId ?? '')
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const catName = data.categories.find((c) => c.id === categoryId)?.name ?? null
  const showsSavings = template.type === 'spend_reduction' || template.type === 'no_spend_category'

  async function start() {
    setSaving(true)
    setError('')
    const r = await postJson('/api/challenges', {
      templateId: template.id,
      categoryId: template.requiresCategory ? categoryId || null : null,
      targetAmount: data.features.customize && target ? Number(target) : null,
    })
    setSaving(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo empezar el reto'); return }
    onStarted(challengeTitle(template.title, catName))
  }

  return (
    <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-2.5">
      <SheetHeader emoji={TEMPLATE_EMOJI[template.type] ?? '🏁'} title={challengeTitle(template.title, catName)} subtitle={`${template.durationDays} días`} />
      <p className={`text-[14.5px] leading-[1.45] ${TEXT_MUTED}`}>{challengeTitle(template.description, catName)}</p>
      {template.requiresCategory && (
        <div className="flex flex-col gap-1.5">
          <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Categoría</span>
          <div className="flex flex-wrap gap-2">
            {data.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className={`h-11 rounded-full border px-3.5 text-sm font-semibold transition-transform duration-150 active:scale-[0.96] ${
                  categoryId === c.id ? 'border-electric bg-electric text-white' : `border-[var(--zafi-border)] bg-[var(--zafi-card)] ${TEXT_STRONG}`
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {showsSavings && (
        data.features.customize ? (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="reto-meta">Meta de ahorro (opcional)</FieldLabel>
            <input id="reto-meta" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Ej. 500" className={INPUT_48} />
          </div>
        ) : (
          <PremiumAction from="challenges" className={`px-4 py-2 ${CARD}`}>
            <span className={`flex-1 text-[15px] font-semibold ${TEXT_STRONG}`}>Ponerle una meta de ahorro</span>
          </PremiumAction>
        )
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void start()} disabled={saving || (template.requiresCategory && !categoryId)} className={PRIMARY_BUTTON}>
        {saving ? 'Empezando…' : 'Empezar'}
      </button>
      <button type="button" onClick={onClose} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>Cancelar</button>
    </div>
  )
}

export function RetosView() {
  const fmt = useFormatMoney()
  const { state, reload } = useChallenges()
  const [starting, setStarting] = useState<TemplateView | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const clearMessage = useCallback(() => setMessage(null), [])
  const closeSheet = useCallback(() => setStarting(null), [])

  const data = state.status === 'ok' ? state.data : null
  const today = new Date().toISOString().slice(0, 10)
  // Terminados en los últimos 3 días: pantalla de cierre.
  const justDone = useMemo(
    () => (data?.history ?? []).filter((c) => c.status === 'completed' && c.endsAt >= addDays(today, -3)),
    [data, today],
  )
  const done = (data?.history ?? []).filter((c) => c.status === 'completed')

  async function act(c: ChallengeView, action: 'abandon' | 'reviewed') {
    const r = await postJson(`/api/challenges/${c.id}`, { action })
    setMessage(r.ok ? { text: action === 'abandon' ? 'Dejaste el reto' : '¡Bien! Reto revisado', tone: 'ok' } : { text: r.error ?? 'No se pudo guardar', tone: 'error' })
    if (r.ok) await reload()
  }

  return (
    <div className="flex max-w-2xl flex-col">
      <div className="mt-4 flex flex-col gap-0.5 px-1">
        <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Metas</span>
        <h2 className={`font-serif text-[26px] leading-[1.15] ${TEXT_STRONG}`}>Retos</h2>
        <p className={`text-sm ${TEXT_MUTED}`}>Pequeños pasos para mejorar tus hábitos</p>
      </div>

      {state.status === 'loading' && <SkeletonRows count={4} className="mt-3.5" />}
      {state.status === 'error' && (
        <div className="mt-3.5 flex flex-col gap-2">
          <ErrorBox>No pudimos cargar tus retos.</ErrorBox>
          <PillButton onClick={() => void reload()}>Reintentar</PillButton>
        </div>
      )}

      {data && (
        <>
          {justDone.map((c) => <DoneCard key={c.id} c={c} fmt={fmt} />)}

          {data.active.length === 0 && justDone.length === 0 && (
            <div className={`mt-3.5 flex flex-col gap-1 p-5 ${CARD}`}>
              <span className={`text-[17px] font-bold ${TEXT_STRONG}`}>No tienes retos activos</span>
              <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Elige uno de abajo. Zafi lleva la cuenta con tus movimientos.</span>
            </div>
          )}
          {data.active.map((c) => (
            <ActiveCard
              key={c.id}
              c={c}
              fmt={fmt}
              canWrite={data.canWrite}
              onAbandon={() => void act(c, 'abandon')}
              onReviewed={() => void act(c, 'reviewed')}
            />
          ))}

          <GroupTitle>Retos nuevos</GroupTitle>
          <ListCard>
            {data.templates.map((t) => {
              const blocked = data.active.length > 0 && !data.features.multiple
              return (
                <div key={t.id} className={`flex min-h-[64px] items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <span aria-hidden className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-xl ${TILE_BG}`}>{TEMPLATE_EMOJI[t.type] ?? '🏁'}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[15px] font-semibold leading-[1.3] ${TEXT_STRONG}`}>{challengeTitle(t.title, t.requiresCategory ? 'una categoría' : null)}</span>
                    <span className={`text-[13px] ${TEXT_MUTED}`}>{t.durationDays} días{t.healthComponent ? ` · Ayuda a mejorar: ${t.healthComponent}` : ''}</span>
                  </span>
                  {!data.canWrite ? null : blocked ? (
                    <PremiumAction from="challenges" className="flex-none">
                      <span className="text-[13.5px] font-bold text-electric-dark dark:text-electric-soft">Empezar</span>
                    </PremiumAction>
                  ) : (
                    <PillButton onClick={() => setStarting(t)}>Empezar</PillButton>
                  )}
                </div>
              )
            })}
          </ListCard>
          {data.active.length > 0 && !data.features.multiple && (
            <p className={`mx-1 mt-2 flex flex-wrap items-center gap-1.5 text-[13px] ${TEXT_MUTED}`}>
              Con el plan Gratis tienes 1 reto a la vez. <PremiumBadge />
            </p>
          )}

          {done.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                aria-expanded={showHistory}
                onClick={() => setShowHistory((v) => !v)}
                className={`flex h-11 w-full items-center justify-between px-1 text-[15px] font-semibold ${TEXT_STRONG}`}
              >
                Retos completados ({done.length})
                <span aria-hidden className={TEXT_MUTED}>{showHistory ? '▴' : '▾'}</span>
              </button>
              {showHistory && (
                <ListCard>
                  {done.map((c) => (
                    <div key={c.id} className={`flex min-h-[52px] items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{c.title}</span>
                        <span className={`text-[13px] ${TEXT_MUTED}`}>
                          {c.progress.daysMet} de {c.progress.durationDays} días
                          {c.progress.estimatedSavings ? ` · ${fmt(c.progress.estimatedSavings)} de ahorro estimado` : ''}
                        </span>
                      </span>
                    </div>
                  ))}
                </ListCard>
              )}
            </div>
          )}
        </>
      )}

      <BottomSheet themed open={!!starting} onClose={closeSheet} label="Empezar reto">
        {starting && data && (
          <StartSheet
            template={starting}
            data={data}
            onClose={closeSheet}
            onStarted={(title) => { setStarting(null); setMessage({ text: `Empezaste: ${title}`, tone: 'ok' }); void reload() }}
          />
        )}
      </BottomSheet>
      <StatusToast message={message} onDone={clearMessage} />
    </div>
  )
}
