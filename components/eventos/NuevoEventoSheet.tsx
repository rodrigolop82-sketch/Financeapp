'use client'

// Hoja "Nuevo evento": primero la plantilla (cumpleaños, graduación,
// vacación, boda o en blanco) y luego nombre, fechas y conceptos con su
// valor. Los conceptos sugeridos se pueden cambiar, quitar o agregar.

import { useState } from 'react'
import { X } from 'lucide-react'
import { ErrorBox, FieldLabel, INPUT_48, SheetHeader } from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { MAX_CONCEPTOS, PLANTILLAS, montoConcepto, type Plantilla } from '@/lib/eventos'

interface ConceptoDraft { key: number; nombre: string; presupuesto: string }

let nextKey = 1
const draft = (nombre: string): ConceptoDraft => ({ key: nextKey++, nombre, presupuesto: '' })

export function NuevoEventoSheet({ onCreated, onLimit, onError }: {
  onCreated: (id: string, nombre: string) => void
  /** La cuenta es Gratis: Eventos es de Premium. */
  onLimit: () => void
  onError: (text: string) => void
}) {
  const fmt = useFormatMoney()
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null)
  const [nombre, setNombre] = useState('')
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [conceptos, setConceptos] = useState<ConceptoDraft[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function elegir(p: Plantilla) {
    setPlantilla(p)
    setNombre(p.nombre)
    setConceptos(p.conceptos.length > 0 ? p.conceptos.map(draft) : [draft('')])
  }

  const set = (key: number, campo: 'nombre' | 'presupuesto', valor: string) =>
    setConceptos((cs) => cs.map((c) => (c.key === key ? { ...c, [campo]: valor } : c)))
  const total = conceptos.reduce((s, c) => s + (montoConcepto(c.presupuesto) ?? 0), 0)

  async function guardar() {
    if (!plantilla) return
    if (!nombre.trim()) { setError('Ponle nombre al evento.'); return }
    if (fin && inicio && fin < inicio) { setError('La fecha final es antes de la inicial.'); return }
    const malo = conceptos.find((c) => montoConcepto(c.presupuesto) === null)
    if (malo) { setError(`Revisa el monto de ${malo.nombre || 'un concepto'}.`); return }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: plantilla.tipo, nombre, fechaInicio: inicio || null, fechaFin: fin || null,
          conceptos: conceptos.filter((c) => c.nombre.trim()).map((c) => ({ nombre: c.nombre, presupuesto: c.presupuesto })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 402) { onLimit(); return }
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el evento.')
      onCreated(data.id as string, nombre.trim())
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo crear el evento.')
    } finally {
      setSaving(false)
    }
  }

  if (!plantilla) {
    return (
      <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
        <SheetHeader emoji="🎉" title="Nuevo evento" subtitle="Elige una plantilla con conceptos sugeridos, o empieza en blanco" />
        <div className="grid grid-cols-2 gap-2.5">
          {PLANTILLAS.map((p) => (
            <button
              key={p.tipo}
              type="button"
              onClick={() => elegir(p)}
              className={`flex flex-col items-start gap-1 rounded-2xl border border-[var(--zafi-border)] bg-[var(--zafi-card)] p-3.5 text-left transition-transform active:scale-[0.97] ${p.tipo === 'otro' ? 'col-span-2' : ''}`}
            >
              <span aria-hidden className="text-[26px] leading-none">{p.emoji}</span>
              <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>{p.label}</span>
              <span className={`text-[12.5px] leading-[1.35] ${TEXT_MUTED}`}>
                {p.conceptos.length > 0 ? `${p.conceptos.slice(0, 3).join(', ')} y más` : 'Crea tus propios conceptos desde cero'}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
      <SheetHeader emoji={plantilla.emoji} title={plantilla.tipo === 'otro' ? 'Evento en blanco' : plantilla.label} subtitle="Anota cuánto piensas gastar en cada concepto" />
      <button type="button" onClick={() => setPlantilla(null)} className="-mt-2 self-start text-[13.5px] font-semibold text-electric-dark dark:text-electric-soft">
        ‹ Cambiar plantilla
      </button>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="evento-nombre">Nombre</FieldLabel>
        <input id="evento-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Cumpleaños de Sofía, Viaje a Semuc" className={INPUT_48} />
      </div>
      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="evento-inicio">Fecha (opcional)</FieldLabel>
          <input id="evento-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={INPUT_48} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="evento-fin">Hasta (opcional)</FieldLabel>
          <input id="evento-fin" type="date" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} className={INPUT_48} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel>Conceptos y cuánto piensas gastar</FieldLabel>
        {conceptos.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <input
                aria-label="Concepto"
                value={c.nombre}
                onChange={(e) => set(c.key, 'nombre', e.target.value)}
                placeholder="Concepto"
                className={INPUT_48}
              />
            </div>
            <div className="w-[108px] flex-none">
              <input
                aria-label={`Monto de ${c.nombre || 'concepto'}`}
                inputMode="decimal"
                value={c.presupuesto}
                onChange={(e) => set(c.key, 'presupuesto', e.target.value)}
                placeholder="Q 0"
                className={`${INPUT_48} text-right`}
              />
            </div>
            <button
              type="button"
              onClick={() => setConceptos((cs) => cs.filter((x) => x.key !== c.key))}
              aria-label={`Quitar ${c.nombre || 'concepto'}`}
              className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${TILE_BG} ${TEXT_MUTED}`}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        {conceptos.length < MAX_CONCEPTOS && (
          <button
            type="button"
            onClick={() => setConceptos((cs) => [...cs, draft('')])}
            className="flex h-11 items-center justify-center rounded-xl border-[1.5px] border-dashed border-electric-soft text-[14.5px] font-semibold text-electric-dark dark:text-electric-soft"
          >
            + Agregar concepto
          </button>
        )}
      </div>

      <div className={`flex items-baseline justify-between rounded-xl px-3.5 py-3 ${TILE_BG}`}>
        <span className={`text-[14px] font-semibold ${TEXT_MUTED}`}>Presupuesto total</span>
        <span className={`font-outfit text-[20px] font-extrabold ${TEXT_STRONG}`}>{fmt(total)}</span>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void guardar()} disabled={saving} className={PRIMARY_BUTTON}>
        {saving ? 'Creando…' : 'Crear evento'}
      </button>
    </div>
  )
}
