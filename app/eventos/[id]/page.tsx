'use client'

// Detalle de un evento: presupuesto contra lo gastado por concepto, los
// gastos asignados, "Ahorrar para esto" (meta) y terminar o eliminar.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import {
  BADGE_WARN, DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, INPUT_48, LINK_TEXT, ListCard,
  PageHeader, ROW_DIVIDER, RowBody, SheetHeader, Tile,
} from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui'
import { AddRow, Note, ProgressBar, RowAmount } from '@/components/plan/ui'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { PremiumSheet } from '@/components/premium/PremiumSheet'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { localToday } from '@/lib/dates'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { useViewOnly } from '@/lib/hooks/useEffectivePlan'
import { notifyScoreInputsChanged } from '@/lib/score-feedback'
import { MAX_CONCEPTOS, metaParaEvento, montoConcepto, plantillaDe, textoCuenta, textoFechas } from '@/lib/eventos'
import { loadEventos, type Evento } from '@/lib/eventos-data'
import { AvanceBar } from '@/components/eventos/AvanceBar'

const BACK = { label: 'Eventos', href: '/plan?s=eventos' }

interface TxRow { id: string; description: string | null; amount: number; date: string; evento_concepto_id: string }
interface GoalRow { id: string; name: string; target_amount: number; current_amount: number }

type Sheet =
  | { kind: 'concepto'; id: string | null; nombre: string; presupuesto: string }
  | { kind: 'evento' }
  | { kind: 'eliminar' }

export default function EventoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const params = useSearchParams()
  const fmt = useFormatMoney()
  const viewOnly = useViewOnly()
  const supabase = useMemo(() => createClient(), [])
  const today = localToday()

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined)
  const [txs, setTxs] = useState<TxRow[]>([])
  const [goal, setGoal] = useState<GoalRow | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [busy, setBusy] = useState(false)
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?next=/eventos/${id}`); return }
    const hh = await getUserHousehold(supabase, user.id)
    if (!hh) { router.push('/onboarding'); return }
    setHouseholdId(hh.id)
    const rows = await loadEventos(supabase, hh.id, { id })
    const ev = rows?.[0] ?? null
    setEvento(ev)
    if (!ev) return
    const cIds = ev.conceptos.map((c) => c.id)
    const [{ data: t }, { data: g }] = await Promise.all([
      cIds.length
        ? supabase.from('transactions').select('id, description, amount, date, evento_concepto_id').in('evento_concepto_id', cIds).neq('type', 'income').order('date', { ascending: false }).limit(200)
        : Promise.resolve({ data: [] }),
      ev.goalId
        ? supabase.from('financial_goals').select('id, name, target_amount, current_amount').eq('id', ev.goalId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    setTxs(((t ?? []) as TxRow[]).map((x) => ({ ...x, amount: Number(x.amount) })))
    setGoal(g ? { ...(g as GoalRow), target_amount: Number((g as GoalRow).target_amount), current_amount: Number((g as GoalRow).current_amount) } : null)
  }, [supabase, router, id])

  useEffect(() => { void load() }, [load])

  // Recién creado: un aviso de bienvenida.
  useEffect(() => {
    if (params.get('nuevo') !== '1') return
    setMessage({ text: 'Evento creado. Al agregar un gasto, asígnalo a este evento.', tone: 'ok' })
    router.replace(`/eventos/${id}`, { scroll: false })
  }, [params, router, id])

  if (evento === undefined) return <PageSkeleton variant="detail" />
  if (evento === null) {
    return (
      <AppShell title="Evento" currentPath="/plan" hideMobileBar>
        <PageHeader back={BACK} title="Evento" />
        <ErrorBox>No encontramos ese evento. Puede que ya lo hayan eliminado.</ErrorBox>
      </AppShell>
    )
  }

  const ev = evento
  const p = plantillaDe(ev.tipo)
  const r = ev.resumen
  const cuenta = ev.archivedAt ? 'Terminado' : textoCuenta(ev.fechaInicio, ev.fechaFin, today)
  const canWrite = !viewOnly
  const nombreConcepto = new Map(ev.conceptos.map((c) => [c.id, c.nombre]))
  const fail = (text = 'No se pudo guardar. Intenta de nuevo.') => setMessage({ text, tone: 'error' })

  async function guardarConcepto(s: Extract<Sheet, { kind: 'concepto' }>) {
    const nombre = s.nombre.replace(/\s+/g, ' ').trim()
    const presupuesto = montoConcepto(s.presupuesto)
    if (!nombre) { fail('Ponle nombre al concepto.'); return }
    if (presupuesto === null) { fail('Revisa el monto.'); return }
    setBusy(true)
    const { error } = s.id
      ? await supabase.from('evento_conceptos').update({ nombre, presupuesto }).eq('id', s.id)
      : await supabase.from('evento_conceptos').insert({ evento_id: ev.id, household_id: householdId, nombre, presupuesto, orden: ev.conceptos.length })
    setBusy(false)
    if (error) { fail(); return }
    setSheet(null)
    await load()
  }

  async function quitarConcepto(conceptoId: string) {
    setBusy(true)
    const { error } = await supabase.from('evento_conceptos').delete().eq('id', conceptoId)
    setBusy(false)
    if (error) { fail(); return }
    setSheet(null)
    setMessage({ text: 'Concepto quitado. Sus gastos siguen en Movimientos.', tone: 'ok' })
    await load()
  }

  async function guardarEvento(nombre: string, inicio: string, fin: string) {
    if (!nombre.trim()) { fail('Ponle nombre al evento.'); return }
    if (inicio && fin && fin < inicio) { fail('La fecha final es antes de la inicial.'); return }
    setBusy(true)
    const { error } = await supabase.from('eventos')
      .update({ nombre: nombre.replace(/\s+/g, ' ').trim(), fecha_inicio: inicio || null, fecha_fin: fin || null, updated_at: new Date().toISOString() })
      .eq('id', ev.id)
    setBusy(false)
    if (error) { fail(); return }
    setSheet(null)
    await load()
  }

  async function archivar(archivado: boolean) {
    setBusy(true)
    const res = await fetch(`/api/eventos/${ev.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archivado }),
    }).catch(() => null)
    setBusy(false)
    if (res?.status === 402) { setPremiumOpen(true); return }
    if (!res?.ok) { fail(); return }
    setMessage({ text: archivado ? 'Evento terminado' : 'Evento activo otra vez', tone: 'ok' })
    await load()
  }

  async function eliminar() {
    setBusy(true)
    const { error } = await supabase.from('eventos').delete().eq('id', ev.id)
    setBusy(false)
    if (error) { fail('No se pudo eliminar. Intenta de nuevo.'); return }
    router.push('/plan?s=eventos')
  }

  /** "Ahorrar para esto": crea la meta con el presupuesto y la fecha del evento. */
  async function ahorrar() {
    if (r.presupuesto <= 0) { fail('Primero anota cuánto piensas gastar.'); return }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const m = metaParaEvento({ tipo: ev.tipo, nombre: ev.nombre, fechaInicio: ev.fechaInicio }, r.presupuesto, today)
    const { data, error } = await supabase.from('financial_goals').insert({
      user_id: user?.id, household_id: householdId, name: m.name, emoji: m.emoji, target_amount: m.targetAmount,
      monthly_contribution: m.monthlyContribution, target_date: m.targetDate, goal_type: m.goalType, shared: true,
    }).select('id').single()
    if (error || !data) { setBusy(false); fail('No se pudo crear la meta.'); return }
    await supabase.from('eventos').update({ goal_id: (data as { id: string }).id }).eq('id', ev.id)
    setBusy(false)
    notifyScoreInputsChanged()
    setMessage({ text: `Meta creada: aparta ${fmt(m.monthlyContribution)} al mes`, tone: 'ok' })
    await load()
  }

  const subtitle = [textoFechas(ev.fechaInicio, ev.fechaFin, today), cuenta].filter(Boolean).join(' · ')

  return (
    <AppShell title={ev.nombre} currentPath="/plan" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col pb-10 lg:mx-0 zafi-stagger">
        <PageHeader back={BACK} title={`${p.emoji} ${ev.nombre}`} subtitle={subtitle} />

        <section className={`flex flex-col gap-2 p-5 ${HERO}`} style={HERO_STYLE}>
          <span className={`text-[13px] font-semibold ${HERO_MUTED}`}>Llevas gastado</span>
          <span className="font-outfit text-[34px] font-extrabold leading-none">{fmt(r.gastado)}</span>
          <div className="mt-1.5">
            <AvanceBar presupuesto={r.presupuesto} gastado={r.gastado} fmt={fmt} inverse />
          </div>
        </section>
        {r.pasados > 0 && (
          <Note tone="warn">{r.pasados === 1 ? 'Un concepto ya pasó' : `${r.pasados} conceptos ya pasaron`} su presupuesto.</Note>
        )}

        <GroupTitle>Conceptos</GroupTitle>
        <ListCard>
          {ev.conceptos.map((c) => {
            const pasado = c.presupuesto > 0 && c.gastado > c.presupuesto
            const body = (
              <>
                <span className="flex w-full items-center gap-3">
                  <RowBody
                    tile={<Tile>{p.emoji}</Tile>}
                    name={c.nombre}
                    badge={pasado ? <span className={BADGE_WARN}>Te pasaste</span> : null}
                    help={c.presupuesto > 0 ? 'Presupuesto' : 'Sin presupuesto'}
                  />
                  <RowAmount className={TEXT_STRONG}>{fmt(c.presupuesto)}</RowAmount>
                </span>
                {(c.presupuesto > 0 || c.gastado > 0) && (
                  <span className="block w-full pl-[52px]">
                    <AvanceBar presupuesto={c.presupuesto} gastado={c.gastado} fmt={fmt} />
                  </span>
                )}
              </>
            )
            return canWrite ? (
              <button
                key={c.id}
                type="button"
                onClick={() => setSheet({ kind: 'concepto', id: c.id, nombre: c.nombre, presupuesto: c.presupuesto ? String(c.presupuesto) : '' })}
                className={`flex w-full flex-col gap-2.5 py-3 text-left transition duration-150 active:scale-[0.98] ${ROW_DIVIDER}`}
              >
                {body}
              </button>
            ) : (
              <div key={c.id} className={`flex flex-col gap-2.5 py-3 ${ROW_DIVIDER}`}>{body}</div>
            )
          })}
          {ev.conceptos.length === 0 && <p className={`py-3 text-sm ${TEXT_MUTED}`}>Agrega lo que piensas gastar, concepto por concepto.</p>}
          {canWrite && ev.conceptos.length < MAX_CONCEPTOS && (
            <AddRow label="Agregar concepto" onClick={() => setSheet({ kind: 'concepto', id: null, nombre: '', presupuesto: '' })} />
          )}
        </ListCard>

        <GroupTitle>Ahorrar para esto</GroupTitle>
        <ListCard>
          {goal ? (
            <Link href={`/metas/${goal.id}?from=plan`} className="flex flex-col gap-2 py-3">
              <span className="flex items-center gap-3">
                <RowBody tile={<Tile>🎯</Tile>} name={goal.name} help={<>{fmt(goal.current_amount)} de {fmt(goal.target_amount)} ahorrado</>} />
                <span className={`text-[13px] font-semibold ${LINK_TEXT}`}>Ver meta ›</span>
              </span>
              <ProgressBar ratio={goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0} color="#22C55E" />
            </Link>
          ) : (
            <div className="flex flex-col gap-2 py-3">
              <p className={`text-[14px] leading-[1.45] ${TEXT_MUTED}`}>
                {r.presupuesto > 0
                  ? `Crea una meta de ${fmt(r.presupuesto)}${ev.fechaInicio && ev.fechaInicio > today ? ` para antes del evento: unos ${fmt(metaParaEvento({ tipo: ev.tipo, nombre: ev.nombre, fechaInicio: ev.fechaInicio }, r.presupuesto, today).monthlyContribution)} al mes` : ''}.`
                  : 'Cuando anotes el presupuesto, puedes crear una meta para juntarlo.'}
              </p>
              {canWrite && (
                <button type="button" onClick={() => void ahorrar()} disabled={busy || r.presupuesto <= 0} className={`${PRIMARY_BUTTON} disabled:opacity-60`}>
                  Ahorrar para esto
                </button>
              )}
            </div>
          )}
        </ListCard>

        <GroupTitle>Gastos del evento</GroupTitle>
        <ListCard>
          {txs.length === 0 ? (
            <p className={`py-3 text-sm leading-[1.45] ${TEXT_MUTED}`}>
              Aún no hay gastos. Al agregar un gasto, toca “Evento” y elige este evento y su concepto. También puedes asignarlo desde el detalle del movimiento.
            </p>
          ) : txs.map((t) => (
            <div key={t.id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
              <RowBody
                tile={<Tile>🧾</Tile>}
                name={t.description || 'Gasto'}
                help={`${nombreConcepto.get(t.evento_concepto_id) ?? ''} · ${textoFechas(t.date, null, today)}`}
              />
              <RowAmount>{fmt(t.amount)}</RowAmount>
            </div>
          ))}
        </ListCard>
        {r.sinPresupuesto > 0 && (
          <p className={`mx-1 mt-2 text-[13px] ${TEXT_MUTED}`}>{fmt(r.sinPresupuesto)} son de conceptos sin presupuesto.</p>
        )}

        {canWrite && (
          <div className="mt-6 flex flex-col gap-1">
            <button type="button" onClick={() => setSheet({ kind: 'evento' })} className={`h-11 text-[15px] font-semibold ${LINK_TEXT}`}>Editar nombre y fechas</button>
            <button type="button" onClick={() => void archivar(!ev.archivedAt)} disabled={busy} className={`h-11 text-[15px] font-semibold ${LINK_TEXT}`}>
              {ev.archivedAt ? 'Volver a activarlo' : 'Terminar evento'}
            </button>
            <button type="button" onClick={() => setSheet({ kind: 'eliminar' })} className={DANGER_TEXT_BUTTON}>Eliminar evento</button>
          </div>
        )}
      </div>

      <BottomSheet themed open={!!sheet} onClose={() => setSheet(null)} label={sheet?.kind === 'concepto' ? 'Concepto' : sheet?.kind === 'evento' ? 'Editar evento' : 'Eliminar evento'}>
        {sheet?.kind === 'concepto' && (
          <ConceptoForm key={sheet.id ?? 'nuevo'} sheet={sheet} busy={busy} emoji={p.emoji}
            onSave={(s) => void guardarConcepto(s)} onDelete={sheet.id ? () => void quitarConcepto(sheet.id!) : undefined} />
        )}
        {sheet?.kind === 'evento' && (
          <EventoForm ev={ev} busy={busy} emoji={p.emoji} onSave={(n, i, f) => void guardarEvento(n, i, f)} />
        )}
        {sheet?.kind === 'eliminar' && (
          <div className="flex flex-col gap-3 px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2">
            <SheetHeader emoji="🗑️" title={`¿Eliminar ${ev.nombre}?`} subtitle="Se borran el evento y sus conceptos. Los gastos siguen en Movimientos, sin evento." />
            <button type="button" onClick={() => void eliminar()} disabled={busy} className="h-[50px] rounded-full bg-danger text-[15px] font-bold text-white">Sí, eliminar</button>
            <button type="button" onClick={() => setSheet(null)} className={`h-11 text-[15px] font-semibold ${LINK_TEXT}`}>Cancelar</button>
          </div>
        )}
      </BottomSheet>
      <PremiumSheet reason="eventos" open={premiumOpen} onClose={() => setPremiumOpen(false)} />
      <StatusToast message={message} onDone={() => setMessage(null)} />
    </AppShell>
  )
}

function ConceptoForm({ sheet, busy, emoji, onSave, onDelete }: {
  sheet: Extract<Sheet, { kind: 'concepto' }>
  busy: boolean
  emoji: string
  onSave: (s: Extract<Sheet, { kind: 'concepto' }>) => void
  onDelete?: () => void
}) {
  const [nombre, setNombre] = useState(sheet.nombre)
  const [presupuesto, setPresupuesto] = useState(sheet.presupuesto)
  return (
    <div className="flex flex-col gap-4 px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2">
      <SheetHeader emoji={emoji} title={sheet.id ? 'Editar concepto' : 'Nuevo concepto'} />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="concepto-nombre">Concepto</FieldLabel>
        <input id="concepto-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Piñata, Gasolina" className={INPUT_48} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="concepto-monto">Presupuesto</FieldLabel>
        <input id="concepto-monto" inputMode="decimal" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} placeholder="Q 0.00" className={INPUT_48} />
      </div>
      <button type="button" onClick={() => onSave({ ...sheet, nombre, presupuesto })} disabled={busy} className={PRIMARY_BUTTON}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
      {onDelete && <button type="button" onClick={onDelete} disabled={busy} className={DANGER_TEXT_BUTTON}>Quitar concepto</button>}
    </div>
  )
}

function EventoForm({ ev, busy, emoji, onSave }: {
  ev: Evento
  busy: boolean
  emoji: string
  onSave: (nombre: string, inicio: string, fin: string) => void
}) {
  const [nombre, setNombre] = useState(ev.nombre)
  const [inicio, setInicio] = useState(ev.fechaInicio ?? '')
  const [fin, setFin] = useState(ev.fechaFin ?? '')
  return (
    <div className="flex flex-col gap-4 px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2">
      <SheetHeader emoji={emoji} title="Editar evento" />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="ev-nombre">Nombre</FieldLabel>
        <input id="ev-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={INPUT_48} />
      </div>
      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="ev-inicio">Fecha</FieldLabel>
          <input id="ev-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${INPUT_48} ${TILE_BG}`} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="ev-fin">Hasta</FieldLabel>
          <input id="ev-fin" type="date" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} className={`${INPUT_48} ${TILE_BG}`} />
        </div>
      </div>
      <button type="button" onClick={() => onSave(nombre, inicio, fin)} disabled={busy} className={PRIMARY_BUTTON}>
        {busy ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}
