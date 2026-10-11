'use client'

// Ajustes › Mis Fuentes: editar nombre, institución y saldo, archivar
// (el historial se conserva) y restaurar.

import { useCallback, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import {
  Chevron, DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, GroupTitle, INPUT_48, LINK_TEXT, ListCard, PageHeader, PillButton, ROW_DIVIDER, RowBody, SheetHeader, Tile,
} from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { AddSourceSheet } from '@/components/networth/SourceSheets'
import { sendJson, useNetWorth } from '@/components/networth/useNetWorth'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { KIND_EMOJI, KIND_LABEL } from '@/lib/networth/sources'
import type { SourceView } from '@/lib/networth/data'

const BACK = { href: '/patrimonio', label: 'Mi patrimonio' }

function EditSheet({ source, onDone, onError }: { source: SourceView; onDone: (text: string) => void; onError: (t: string) => void }) {
  const [name, setName] = useState(source.name)
  const [institution, setInstitution] = useState(source.institution ?? '')
  const [balance, setBalance] = useState(String(source.balance))
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = {}
    if (name.trim() !== source.name) body.name = name
    if ((institution.trim() || null) !== source.institution) body.institution = institution
    if (Number(balance.replace(/,/g, '')) !== source.balance) body.balance = balance
    if (Object.keys(body).length === 0) { onDone('Sin cambios'); return }
    const r = await sendJson(`/api/networth/sources/${source.id}`, 'PATCH', body)
    setSaving(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar'); return }
    onDone('Guardado')
  }

  async function archive() {
    setSaving(true)
    const r = await sendJson(`/api/networth/sources/${source.id}`, 'PATCH', { archive: true })
    setSaving(false)
    if (!r.ok) { onError(r.error ?? 'No se pudo archivar'); return }
    onDone(`${source.name} archivada`)
  }

  return (
    <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-2.5">
      <SheetHeader emoji={KIND_EMOJI[source.kind]} title={source.name} subtitle={KIND_LABEL[source.kind]} />
      {confirmArchive ? (
        <>
          <p className={`text-[15px] leading-[1.5] ${TEXT_STRONG}`}>
            ¿Archivar {source.name}? Deja de contar en tu patrimonio desde hoy. Su historial se conserva y puedes restaurarla.
          </p>
          <button type="button" disabled={saving} onClick={() => void archive()} className={PRIMARY_BUTTON}>Sí, archivar</button>
          <button type="button" onClick={() => setConfirmArchive(false)} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>Cancelar</button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="ed-nombre">Nombre</FieldLabel>
            <input id="ed-nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={INPUT_48} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="ed-inst">Institución</FieldLabel>
            <input id="ed-inst" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Opcional" maxLength={60} className={INPUT_48} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="ed-saldo">{source.side === 'liability' ? 'Cuánto debes hoy' : 'Saldo de hoy'}</FieldLabel>
            <input id="ed-saldo" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.,]/g, ''))} className={`${INPUT_48} font-outfit`} />
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="button" disabled={saving || !name.trim() || balance === ''} onClick={() => void save()} className={PRIMARY_BUTTON}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setConfirmArchive(true)} className={DANGER_TEXT_BUTTON}>Archivar</button>
        </>
      )}
    </div>
  )
}

export default function MisFuentesSaldosPage() {
  const fmt = useFormatMoney()
  const { state, reload } = useNetWorth({ archived: true })
  const [sheet, setSheet] = useState<{ kind: 'add' } | { kind: 'edit'; source: SourceView } | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const clearMessage = useCallback(() => setMessage(null), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  if (state.status === 'loading') return <PageSkeleton variant="list" />
  const data = state.status === 'ok' ? state.data : null
  const own = data ? [...data.assets, ...data.liabilities].filter((s) => !s.fromDebts) : []
  const canWrite = data?.canWrite ?? false

  async function restore(id: string, name: string) {
    const r = await sendJson(`/api/networth/sources/${id}`, 'PATCH', { restore: true })
    setMessage(r.ok ? { text: `${name} restaurada`, tone: 'ok' } : { text: r.error ?? 'No se pudo restaurar', tone: 'error' })
    if (r.ok) await reload()
  }

  return (
    <AppShell title="Mis Fuentes" currentPath="/patrimonio/fuentes" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={BACK} title="Mis Fuentes" subtitle="Tus cuentas, efectivo, inversiones, bienes y otras deudas, con su saldo." />

        {state.status === 'error' && (
          <div className="mt-3.5 flex flex-col gap-2">
            <ErrorBox>No pudimos cargar tus fuentes.</ErrorBox>
            <PillButton onClick={() => void reload()}>Reintentar</PillButton>
          </div>
        )}

        {data && (
          <>
            <GroupTitle>Tus fuentes · {own.length}</GroupTitle>
            <ListCard>
              {own.map((s) => (
                <button key={s.id} type="button" disabled={!canWrite} onClick={() => setSheet({ kind: 'edit', source: s })} className={`flex w-full items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <RowBody tile={<Tile>{KIND_EMOJI[s.kind]}</Tile>} name={s.name} help={`${KIND_LABEL[s.kind]}${s.institution ? ` · ${s.institution}` : ''}`} />
                  <span className={`flex-none font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{s.side === 'liability' ? '−' : ''}{fmt(s.balance)}</span>
                  {canWrite && <Chevron />}
                </button>
              ))}
              {canWrite && (
                <button type="button" onClick={() => setSheet({ kind: 'add' })} className={`flex w-full items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <Tile className="bg-electric-ghost text-[22px] font-semibold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft">+</Tile>
                  <span className={`flex-1 text-left text-[15px] font-semibold ${LINK_TEXT}`}>Agregar fuente</span>
                </button>
              )}
            </ListCard>
            <p className={`mx-1 mt-3 text-[13px] leading-[1.45] ${TEXT_MUTED}`}>
              Tus tarjetas y préstamos se registran en Plan › Deudas y ya cuentan en tu patrimonio.
            </p>

            {data.archived.length > 0 && (
              <>
                <GroupTitle>Archivadas</GroupTitle>
                <ListCard>
                  {data.archived.map((s) => (
                    <div key={s.id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                      <RowBody tile={<Tile>{KIND_EMOJI[s.kind]}</Tile>} name={s.name} help={KIND_LABEL[s.kind]} />
                      {canWrite && <PillButton onClick={() => void restore(s.id, s.name)}>Restaurar</PillButton>}
                    </div>
                  ))}
                </ListCard>
              </>
            )}
          </>
        )}
      </div>

      <BottomSheet themed open={!!sheet} onClose={closeSheet} label={sheet?.kind === 'add' ? 'Agregar fuente' : 'Editar fuente'}>
        {sheet?.kind === 'add' && (
          <AddSourceSheet onDone={(name) => { setSheet(null); setMessage({ text: `${name} agregada`, tone: 'ok' }); void reload() }} />
        )}
        {sheet?.kind === 'edit' && (
          <EditSheet
            key={sheet.source.id}
            source={sheet.source}
            onDone={(text) => { setSheet(null); setMessage({ text, tone: 'ok' }); void reload() }}
            onError={(text) => setMessage({ text, tone: 'error' })}
          />
        )}
      </BottomSheet>
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  )
}
