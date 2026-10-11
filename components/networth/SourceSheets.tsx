'use client'

// Hojas de Mis Fuentes: agregar una fuente y actualizar su saldo.

import { useState } from 'react'
import { ErrorBox, FieldLabel, INPUT_48, SheetHeader } from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { INSTITUTION_SUGGESTIONS, KIND_EMOJI, KIND_LABEL, MANUAL_KINDS, type ManualKind } from '@/lib/networth/sources'
import type { SourceView } from '@/lib/networth/data'
import { sendJson } from './useNetWorth'

const chip = (on: boolean) =>
  `h-11 rounded-full border px-3.5 text-sm font-semibold transition-transform duration-150 active:scale-[0.96] ${
    on ? 'border-electric bg-electric text-white' : `border-[var(--zafi-border)] bg-[var(--zafi-card)] ${TEXT_STRONG}`
  }`

const SHEET_BODY = 'flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-2.5'

export function AddSourceSheet({ onDone }: { onDone: (name: string) => void }) {
  const [kind, setKind] = useState<ManualKind>('bank_account')
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [other, setOther] = useState(false)
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const usesInstitution = kind === 'bank_account' || kind === 'investment'

  async function save() {
    setSaving(true)
    setError('')
    const r = await sendJson('/api/networth/sources', 'POST', {
      kind, name, institution: usesInstitution ? institution : null, balance,
    })
    setSaving(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo agregar'); return }
    onDone(name.trim())
  }

  return (
    <div className={SHEET_BODY}>
      <SheetHeader emoji={KIND_EMOJI[kind]} title="Agregar fuente" subtitle="Una cuenta, efectivo, inversión, bien o deuda" />
      <div className="flex flex-col gap-1.5">
        <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Tipo</span>
        <div className="flex flex-wrap gap-2">
          {MANUAL_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
              {KIND_EMOJI[k]} {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {kind === 'other_liability' && (
          <p className={`text-[13px] leading-[1.45] ${TEXT_MUTED}`}>Tus tarjetas y préstamos ya cuentan desde Plan › Deudas. Agrega aquí solo otras deudas.</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="fuente-nombre">Nombre</FieldLabel>
        <input id="fuente-nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Cuenta monetaria" maxLength={60} className={INPUT_48} />
      </div>
      {usesInstitution && (
        <div className="flex flex-col gap-1.5">
          <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Institución</span>
          <div className="flex flex-wrap gap-2">
            {INSTITUTION_SUGGESTIONS.map((b) => (
              <button key={b} type="button" aria-pressed={!other && institution === b} onClick={() => { setOther(false); setInstitution(b) }} className={chip(!other && institution === b)}>{b}</button>
            ))}
            <button type="button" aria-pressed={other} onClick={() => { setOther(true); setInstitution('') }} className={chip(other)}>Otro</button>
          </div>
          {other && <input aria-label="Nombre de la institución" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ej. Banco Industrial" maxLength={60} className={INPUT_48} />}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="fuente-saldo">{kind === 'other_liability' ? 'Cuánto debes hoy' : 'Saldo de hoy'}</FieldLabel>
        <input id="fuente-saldo" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Q 0" className={`${INPUT_48} font-outfit`} />
      </div>
      <p className={`text-[13px] ${TEXT_MUTED}`}>Solo tú (y quien comparte tu hogar) ve estos datos.</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={saving || !name.trim() || balance === ''} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}

export function UpdateBalanceSheet({ source, onDone }: { source: SourceView; onDone: () => void }) {
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const r = await sendJson(`/api/networth/sources/${source.id}`, 'PATCH', { balance })
    setSaving(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo actualizar'); return }
    onDone()
  }

  return (
    <div className={SHEET_BODY}>
      <SheetHeader emoji={KIND_EMOJI[source.kind]} title={source.name} subtitle="Actualiza el saldo de hoy" />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="nuevo-saldo">{source.side === 'liability' ? 'Cuánto debes hoy' : 'Saldo de hoy'}</FieldLabel>
        <input id="nuevo-saldo" inputMode="decimal" autoFocus value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Q 0" className={`${INPUT_48} font-outfit`} />
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={saving || balance === ''} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Actualizar saldo'}
      </button>
    </div>
  )
}
