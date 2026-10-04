'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { GT_BANKS } from '@/lib/sources'
import { DELETE_UNDO_MS } from '@/lib/transactions/undo-delete'
import type { UserSource, SourceType } from '@/types'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { UndoToast } from '@/components/transactions/UndoToast'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui'
import { CARD } from '@/components/resumen/ctf-ui'
import {
  BADGE_INFO, BADGE_OK, Chevron, DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, GroupTitle, INPUT_48, LINK_TEXT, ListCard,
  PageHeader, ROW_DIVIDER, RowBody, Segmented, SheetHeader, Tile,
} from '@/components/layout/Pantalla'

const TYPE_LABELS: Record<SourceType, string> = {
  tarjeta_credito: 'Tarjeta de crédito',
  cuenta_bancaria: 'Cuenta bancaria',
  efectivo: 'Efectivo',
}

const TYPE_EMOJI: Record<SourceType, string> = {
  tarjeta_credito: '💳',
  cuenta_bancaria: '🏦',
  efectivo: '💵',
}

const TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'tarjeta_credito', label: 'Tarjeta' },
  { value: 'cuenta_bancaria', label: 'Cuenta' },
  { value: 'efectivo', label: 'Efectivo' },
]

const SUBTITLE = 'Así Zafi sabe qué estados de cuenta te faltan al cerrar el mes.'
const OTHER = 'Otro banco'

/** Hoja abierta: editar un banco, elegir uno nuevo o completar sus datos. */
type Sheet =
  | { kind: 'edit'; source: UserSource }
  | { kind: 'pick' }
  | { kind: 'new'; bank: string }

interface Draft {
  bank: string
  type: SourceType
  nickname: string
}

export default function MisFuentesPage() {
  const [sources, setSources] = useState<UserSource[]>([])
  const [loading, setLoading] = useState(true)
  const [applePay, setApplePay] = useState(false)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [draft, setDraft] = useState<Draft>({ bank: '', type: 'tarjeta_credito', nickname: '' })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [undo, setUndo] = useState<UserSource | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const loadSources = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('user_sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true })

    setSources((data ?? []) as UserSource[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadSources() }, [loadSources])

  // Apple Pay está activo si hay al menos una clave del atajo.
  useEffect(() => {
    fetch('/api/shortcut-tokens', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setApplePay((data?.tokens ?? []).length > 0))
      .catch(() => {})
  }, [])

  const closeSheet = useCallback(() => { setSheet(null); setErrorMsg(null) }, [])
  const dismissUndo = useCallback(() => setUndo(null), [])
  const clearMessage = useCallback(() => setMessage(null), [])

  function openEdit(source: UserSource) {
    setErrorMsg(null)
    setDraft({ bank: source.bank_name, type: source.type, nickname: source.nickname ?? '' })
    setSheet({ kind: 'edit', source })
  }

  function openPick() {
    setErrorMsg(null)
    setSheet({ kind: 'pick' })
  }

  function pickBank(bank: string) {
    setDraft({ bank: bank === OTHER ? '' : bank, type: 'tarjeta_credito', nickname: '' })
    setSheet({ kind: 'new', bank })
  }

  async function handleAdd() {
    const bankName = draft.bank.trim()
    if (!bankName) return

    setSaving(true)
    setErrorMsg(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      router.push('/login')
      return
    }

    const { error } = await supabase.from('user_sources').insert({
      user_id: user.id,
      type: draft.type,
      bank_name: bankName,
      nickname: draft.nickname.trim() || null,
      detection_method: 'manual',
    })
    setSaving(false)

    if (error) {
      setErrorMsg('No se pudo agregar el banco. Intenta de nuevo.')
      return
    }

    setSheet(null)
    setMessage({ text: `${bankName} agregado`, tone: 'ok' })
    await loadSources()
  }

  async function handleSaveEdit(source: UserSource) {
    setSaving(true)
    setErrorMsg(null)

    const { error } = await supabase.from('user_sources').update({
      type: draft.type,
      nickname: draft.nickname.trim() || null,
    }).eq('id', source.id)
    setSaving(false)

    if (error) {
      setErrorMsg('No se pudo guardar el cambio. Intenta de nuevo.')
      return
    }

    setSheet(null)
    setMessage({ text: 'Guardado', tone: 'ok' })
    await loadSources()
  }

  async function setActive(source: UserSource, active: boolean) {
    const { error } = await supabase.from('user_sources').update({ active }).eq('id', source.id)
    if (error) {
      setMessage({ text: active ? 'No se pudo deshacer. Intenta de nuevo.' : 'No se pudo quitar el banco. Intenta de nuevo.', tone: 'error' })
      return false
    }
    await loadSources()
    return true
  }

  async function handleDeactivate(source: UserSource) {
    setSheet(null)
    if (await setActive(source, false)) setUndo(source)
  }

  async function runUndo() {
    const u = undo
    setUndo(null)
    if (u) await setActive(u, true)
  }

  if (loading) {
    return <PageSkeleton variant="list" />
  }

  return (
    <AppShell title="Mis bancos" currentPath="/mis-fuentes" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/mas', label: 'Más' }} title="Mis bancos" subtitle={SUBTITLE} />
        <p className={`hidden text-sm lg:block ${TEXT_MUTED}`}>{SUBTITLE}</p>

        {/* Apple Pay vía Atajos (fase 13) */}
        <Link
          href="/mis-fuentes/apple-pay"
          className={`mt-3.5 flex items-center gap-3 p-3.5 transition-transform duration-150 active:scale-[0.98] ${CARD}`}
        >
          <RowBody tile={<Tile>📲</Tile>} name="Apple Pay" help="Tus pagos con el iPhone llegan solos" />
          {applePay && <span className={BADGE_OK}>Activo</span>}
          <Chevron />
        </Link>

        <GroupTitle>Tus cuentas y tarjetas · {sources.length}</GroupTitle>
        <ListCard>
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => openEdit(source)}
              className={`flex w-full items-center gap-3 py-3 ${ROW_DIVIDER}`}
            >
              <RowBody
                tile={<Tile>{TYPE_EMOJI[source.type]}</Tile>}
                name={source.bank_name}
                badge={source.detection_method === 'auto' && <span className={BADGE_INFO}>Detectado</span>}
                help={`${TYPE_LABELS[source.type]}${source.nickname ? ` · ${source.nickname}` : ''}`}
              />
              <Chevron />
            </button>
          ))}
          <button type="button" onClick={openPick} className={`flex w-full items-center gap-3 py-3 ${ROW_DIVIDER}`}>
            <Tile className="bg-electric-ghost text-[22px] font-semibold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft">+</Tile>
            <span className={`flex-1 text-left text-[15px] font-semibold ${LINK_TEXT}`}>Agregar banco o tarjeta</span>
          </button>
        </ListCard>
        <p className={`mx-1 mt-3 text-[13px] leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>
          Al importar un estado de cuenta, Zafi agrega el banco por ti.
        </p>
      </div>

      <BottomSheet themed open={!!sheet} onClose={closeSheet} label={sheet?.kind === 'edit' ? 'Editar banco' : 'Agregar banco'}>
        {sheet && (
          <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-2.5">
            {sheet.kind === 'pick' ? (
              <>
                <SheetHeader emoji="🏦" title="Agrega un banco" subtitle="Elige el tuyo" />
                <div className="flex flex-wrap gap-2">
                  {[...GT_BANKS, OTHER].map((bank) => {
                    const added = bank !== OTHER && sources.some((s) => s.bank_name === bank)
                    return (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => pickBank(bank)}
                        className={`h-11 rounded-full border border-[var(--zafi-border)] px-3.5 text-sm font-semibold transition-transform duration-150 active:scale-[0.96] ${
                          added ? `${TILE_BG} ${TEXT_MUTED}` : `bg-[var(--zafi-card)] ${TEXT_STRONG}`
                        }`}
                      >
                        {bank}{added ? ' ✓' : ''}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                {sheet.kind === 'edit' ? (
                  <SheetHeader emoji={TYPE_EMOJI[draft.type]} title={sheet.source.bank_name} subtitle="Cambia el tipo o ponle un apodo" />
                ) : (
                  <SheetHeader emoji={TYPE_EMOJI[draft.type]} title={sheet.bank === OTHER ? 'Otro banco' : sheet.bank} subtitle="¿Qué es?" />
                )}
                {sheet.kind === 'new' && sheet.bank === OTHER && (
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="bank-name">Nombre del banco</FieldLabel>
                    <input
                      id="bank-name"
                      type="text"
                      value={draft.bank}
                      onChange={(e) => setDraft((d) => ({ ...d, bank: e.target.value }))}
                      placeholder="Ej. Banco Azteca"
                      className={INPUT_48}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Tipo</span>
                  <Segmented label="Tipo" options={TYPE_OPTIONS} value={draft.type} onChange={(type) => setDraft((d) => ({ ...d, type }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="bank-nick">Apodo</FieldLabel>
                  <input
                    id="bank-nick"
                    type="text"
                    value={draft.nickname}
                    onChange={(e) => setDraft((d) => ({ ...d, nickname: e.target.value }))}
                    placeholder="Opcional, ej. “Tarjeta principal”"
                    className={INPUT_48}
                  />
                </div>
                {errorMsg && <ErrorBox>{errorMsg}</ErrorBox>}
                <button
                  type="button"
                  onClick={() => (sheet.kind === 'edit' ? handleSaveEdit(sheet.source) : handleAdd())}
                  disabled={saving || !draft.bank.trim()}
                  className={PRIMARY_BUTTON}
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                {sheet.kind === 'edit' && (
                  <button type="button" onClick={() => handleDeactivate(sheet.source)} className={DANGER_TEXT_BUTTON}>
                    Dejar de usar este banco
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </BottomSheet>

      <UndoToast
        key={undo?.id}
        visible={!!undo}
        title={`${undo?.bank_name ?? ''} ya no se usa`}
        onUndo={() => void runUndo()}
        onDismiss={dismissUndo}
        duration={DELETE_UNDO_MS}
      />
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  )
}
