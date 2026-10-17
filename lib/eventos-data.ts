// Carga de eventos con sus conceptos y lo gastado (cliente con RLS).
import type { SupabaseClient } from '@supabase/supabase-js'
import { gastadoPorConcepto, plantillaDe, resumenEvento, type ConceptoResumen, type EventoTipo, type ResumenEvento } from './eventos'

export interface Evento {
  id: string
  tipo: EventoTipo
  nombre: string
  fechaInicio: string | null
  fechaFin: string | null
  goalId: string | null
  archivedAt: string | null
  conceptos: ConceptoResumen[]
  resumen: ResumenEvento
}

type EventoRow = {
  id: string; tipo: EventoTipo; nombre: string; fecha_inicio: string | null; fecha_fin: string | null
  goal_id: string | null; archived_at: string | null; created_at: string
}
type ConceptoRow = { id: string; evento_id: string; nombre: string; presupuesto: number | string; orden: number }

/** Eventos del hogar (activos primero, luego terminados), o null si falla. */
export async function loadEventos(supabase: SupabaseClient, householdId: string, opts: { id?: string } = {}): Promise<Evento[] | null> {
  let q = supabase.from('eventos').select('id, tipo, nombre, fecha_inicio, fecha_fin, goal_id, archived_at, created_at').eq('household_id', householdId)
  if (opts.id) q = q.eq('id', opts.id)
  const { data: evs, error } = await q
  if (error) return null
  const rows = (evs ?? []) as EventoRow[]
  if (rows.length === 0) return []
  const ids = rows.map((e) => e.id)
  const { data: cs, error: cErr } = await supabase.from('evento_conceptos').select('id, evento_id, nombre, presupuesto, orden').in('evento_id', ids).order('orden').order('created_at')
  if (cErr) return null
  const conceptos = (cs ?? []) as ConceptoRow[]
  const cIds = conceptos.map((c) => c.id)
  const { data: txs } = cIds.length
    ? await supabase.from('transactions').select('evento_concepto_id, amount, type').in('evento_concepto_id', cIds)
    : { data: [] }
  const gastado = gastadoPorConcepto((txs ?? []) as { evento_concepto_id: string | null; amount: number; type: string | null }[])

  return rows
    .map((e) => {
      const cc: ConceptoResumen[] = conceptos.filter((c) => c.evento_id === e.id)
        .map((c) => ({ id: c.id, nombre: c.nombre, presupuesto: Number(c.presupuesto) || 0, gastado: gastado.get(c.id) ?? 0 }))
      return {
        id: e.id, tipo: e.tipo, nombre: e.nombre, fechaInicio: e.fecha_inicio, fechaFin: e.fecha_fin,
        goalId: e.goal_id, archivedAt: e.archived_at, conceptos: cc, resumen: resumenEvento(cc),
        _created: e.created_at,
      }
    })
    .sort((a, b) => (a.archivedAt ? 1 : 0) - (b.archivedAt ? 1 : 0)
      || (a.fechaInicio ?? '9999').localeCompare(b.fechaInicio ?? '9999')
      || a._created.localeCompare(b._created))
    .map(({ _created, ...e }) => { void _created; return e })
}

/** Opciones para asignar un gasto: conceptos de los eventos activos. */
export interface OpcionConcepto {
  conceptoId: string
  eventoId: string
  evento: string
  concepto: string
  emoji: string
}

/**
 * Conceptos de los eventos activos, para "¿Es para un evento?" al agregar o
 * editar un gasto. [] si no hay eventos (o falta la migración).
 */
export async function loadOpcionesEventos(supabase: SupabaseClient, householdId?: string): Promise<OpcionConcepto[]> {
  // Sin hogar, RLS ya limita a los hogares de la persona.
  let q = supabase
    .from('eventos')
    .select('id, tipo, nombre, fecha_inicio, evento_conceptos(id, nombre, orden)')
    .is('archived_at', null)
  if (householdId) q = q.eq('household_id', householdId)
  const { data, error } = await q
    .order('fecha_inicio', { ascending: true, nullsFirst: false })
  if (error || !data) return []
  type Row = { id: string; tipo: EventoTipo; nombre: string; evento_conceptos: { id: string; nombre: string; orden: number }[] | null }
  return (data as Row[]).flatMap((e) =>
    [...(e.evento_conceptos ?? [])].sort((a, b) => a.orden - b.orden).map((c) => ({
      conceptoId: c.id, eventoId: e.id, evento: e.nombre, concepto: c.nombre, emoji: plantillaDe(e.tipo).emoji,
    })))
}

/** "🎂 Cumpleaños de Sofía › Pastel". */
export function etiquetaConcepto(o: OpcionConcepto): string {
  return `${o.emoji} ${o.evento} › ${o.concepto}`
}
