'use client'

// Hojas de Mis cuentas: agregar o editar una cuenta y actualizar su saldo.

import { useState } from 'react'
import { DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, INPUT_48, SheetHeader } from '@/components/layout/Pantalla'
import { Switch } from '@/components/cuenta/AccountUI'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { GT_BANKS } from '@/lib/sources'
import { KIND_EMOJI, KIND_LABEL, SOURCE_KINDS, hasStatements, type SourceKind } from '@/lib/networth/sources'
import type { DebtRef, SourceView } from '@/lib/networth/data'
import { sendJson } from './useNetWorth'

const chip = (on: boolean) =>
  `h-11 rounded-full border px-3.5 text-sm font-semibold transition-transform duration-150 active:scale-[0.96] ${
    on ? 'border-electric bg-electric text-white' : `border-[var(--zafi-border)] bg-[var(--zafi-card)] ${TEXT_STRONG}`
  }`

const SHEET_BODY = 'flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-2.5'
const LABEL = `text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`

function usesInstitution(kind: SourceKind): boolean {
  return kind === 'bank_account' || kind === 'credit_card' || kind === 'investment'
}

function ToggleRow({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{title}</span>
        <span className={`text-[13px] leading-[1.35] ${TEXT_MUTED}`}>{hint}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  )
}

/** Agregar (sin `source`) o editar una cuenta. */
export function AccountSheet({ source, debts, onDone, onError }: {
  source?: SourceView
  debts: DebtRef[]
  onDone: (text: string) => void
  onError?: (text: string) => void
}) {
  const editing = !!source
  const [kind, setKind] = useState<SourceKind>(source?.kind ?? 'bank_account')
  const [name, setName] = useState(source?.name ?? '')
  const known = (GT_BANKS as readonly string[]).includes(source?.institution ?? '')
  const [institution, setInstitution] = useState(source?.institution ?? '')
  const [otherBank, setOtherBank] = useState(!!source?.institution && !known)
  const [last4, setLast4] = useState(source?.last4 ?? '')
  const [balance, setBalance] = useState(source?.balance !== null && source?.balance !== undefined ? String(source.balance) : '')
  const [debtId, setDebtId] = useState(source?.debt?.id ?? '')
  const [shared, setShared] = useState(source?.shared ?? false)
  const [tracks, setTracks] = useState(source?.tracksStatements ?? hasStatements('bank_account'))
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const card = kind === 'credit_card'
  const canShare = !editing || source!.mine

  function pickKind(k: SourceKind) {
    setKind(k)
    if (!editing) setTracks(hasStatements(k))
  }

  async function save() {
    setSaving(true)
    setError('')
    let r: { ok: boolean; error?: string }
    if (!editing) {
      r = await sendJson('/api/networth/sources', 'POST', {
        kind, name, institution: usesInstitution(kind) ? institution : null,
        balance: card ? null : balance, last4: card || kind === 'bank_account' ? last4 : null,
        debtId: card ? debtId || null : null, shared, tracksStatements: tracks,
      })
    } else {
      const body: Record<string, unknown> = {}
      if (name.trim() !== source!.name) body.name = name
      if ((institution.trim() || null) !== source!.institution) body.institution = institution
      if ((last4 || null) !== source!.last4) body.last4 = last4
      if (!card && balance !== '' && Number(balance.replace(/,/g, '')) !== source!.balance) body.balance = balance
      if (card && (debtId || null) !== (source!.debt?.id ?? null)) body.debtId = debtId || null
      if (canShare && shared !== source!.shared) body.shared = shared
      if (tracks !== source!.tracksStatements) body.tracksStatements = tracks
      if (Object.keys(body).length === 0) { setSaving(false); onDone('Sin cambios'); return }
      r = await sendJson(`/api/networth/sources/${source!.id}`, 'PATCH', body)
    }
    setSaving(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar'); return }
    onDone(editing ? 'Guardado' : `${name.trim()} agregada`)
  }

  async function archive() {
    setSaving(true)
    const r = await sendJson(`/api/networth/sources/${source!.id}`, 'PATCH', { archive: true })
    setSaving(false)
    if (!r.ok) { onError?.(r.error ?? 'No se pudo archivar'); return }
    onDone(`${source!.name} archivada`)
  }

  if (confirmArchive && source) {
    return (
      <div className={SHEET_BODY}>
        <SheetHeader emoji={KIND_EMOJI[source.kind]} title={source.name} subtitle={KIND_LABEL[source.kind]} />
        <p className={`text-[15px] leading-[1.5] ${TEXT_STRONG}`}>
          ¿Archivar {source.name}? Deja de contar en tu patrimonio y en el cierre de mes desde hoy. Su historial se conserva y puedes restaurarla.
        </p>
        <button type="button" disabled={saving} onClick={() => void archive()} className={PRIMARY_BUTTON}>Sí, archivar</button>
        <button type="button" onClick={() => setConfirmArchive(false)} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>Cancelar</button>
      </div>
    )
  }

  return (
    <div className={SHEET_BODY}>
      <SheetHeader emoji={KIND_EMOJI[kind]} title={editing ? source!.name : 'Agregar cuenta'} subtitle={editing ? KIND_LABEL[kind] : 'Un banco, tarjeta, efectivo, inversión, bien o deuda'} />

      {!editing && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Tipo</span>
          <div className="flex flex-wrap gap-2">
            {SOURCE_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => pickKind(k)} className={chip(kind === k)}>
                {KIND_EMOJI[k]} {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          {kind === 'other_liability' && (
            <p className={`text-[13px] leading-[1.45] ${TEXT_MUTED}`}>Tus tarjetas y préstamos ya cuentan desde Plan › Deudas. Agrega aquí solo otras deudas.</p>
          )}
        </div>
      )}

      {usesInstitution(kind) && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Banco</span>
          <div className="flex flex-wrap gap-2">
            {GT_BANKS.map((b) => (
              <button key={b} type="button" aria-pressed={!otherBank && institution === b} onClick={() => { setOtherBank(false); setInstitution(b); if (!name.trim() || (GT_BANKS as readonly string[]).includes(name)) setName(b) }} className={chip(!otherBank && institution === b)}>{b}</button>
            ))}
            <button type="button" aria-pressed={otherBank} onClick={() => { setOtherBank(true); setInstitution('') }} className={chip(otherBank)}>Otro</button>
          </div>
          {otherBank && <input aria-label="Nombre del banco" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ej. Banco Azteca" maxLength={60} className={INPUT_48} />}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="cuenta-nombre">Nombre</FieldLabel>
        <input id="cuenta-nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder={card ? 'Ej. Visa oro' : 'Ej. Cuenta monetaria'} maxLength={60} className={INPUT_48} />
      </div>

      {(card || kind === 'bank_account') && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="cuenta-last4">Últimos 4 dígitos (opcional)</FieldLabel>
          <input id="cuenta-last4" inputMode="numeric" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" className={`${INPUT_48} font-outfit`} />
        </div>
      )}

      {card ? (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Su deuda en Plan › Deudas</span>
          {debts.length === 0 ? (
            <p className={`text-[13.5px] leading-[1.45] ${TEXT_MUTED}`}>Aún no tienes deudas registradas. Agrega la tarjeta en Plan › Deudas para que su saldo cuente en tu patrimonio.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!debtId} onClick={() => setDebtId('')} className={chip(!debtId)}>Sin vincular</button>
              {debts.map((d) => (
                <button key={d.id} type="button" aria-pressed={debtId === d.id} onClick={() => setDebtId(d.id)} className={chip(debtId === d.id)}>{d.name}</button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="cuenta-saldo">{kind === 'other_liability' ? 'Cuánto debes hoy (opcional)' : 'Saldo de hoy (opcional)'}</FieldLabel>
          <input id="cuenta-saldo" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Q 0" className={`${INPUT_48} font-outfit`} />
          <span className={`text-[12.5px] ${TEXT_MUTED}`}>Con saldo, la cuenta cuenta en tu patrimonio.</span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {canShare && (
          <ToggleRow title="Compartir con mi hogar" hint="Si no, solo tú la ves." checked={shared} onChange={setShared} />
        )}
        <ToggleRow title="Cierre de mes" hint="Recordarme cargar su estado de cuenta." checked={tracks} onChange={setTracks} />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={saving || !name.trim()} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {editing && <button type="button" onClick={() => setConfirmArchive(true)} className={DANGER_TEXT_BUTTON}>Archivar</button>}
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
      <SheetHeader emoji={KIND_EMOJI[source.kind]} title={source.name} subtitle={source.balance === null ? 'Agrega el saldo de hoy' : 'Actualiza el saldo de hoy'} />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="nuevo-saldo">{source.side === 'liability' ? 'Cuánto debes hoy' : 'Saldo de hoy'}</FieldLabel>
        <input id="nuevo-saldo" inputMode="decimal" autoFocus value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Q 0" className={`${INPUT_48} font-outfit`} />
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={saving || balance === ''} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Guardar saldo'}
      </button>
    </div>
  )
}
