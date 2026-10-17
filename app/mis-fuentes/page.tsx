'use client'

// Mis cuentas: cuentas de banco y tarjetas, las que tienen movimientos.
// Efectivo, inversiones, bienes y otras deudas viven solo en Mi patrimonio.
// Cada cuenta puede tener saldo (cuenta en el patrimonio), entrar al cierre
// de mes y ser personal o compartida.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import {
  BADGE_INFO, BADGE_NEUTRAL, BADGE_OK, Chevron, ErrorBox, GroupTitle, LINK_TEXT, ListCard, PageHeader, PillButton, ROW_DIVIDER, RowBody, Tile,
} from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { CARD } from '@/components/resumen/ctf-ui'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { AccountSheet } from '@/components/networth/SourceSheets'
import { sendJson, useNetWorth } from '@/components/networth/useNetWorth'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { ACCOUNT_KINDS, KIND_EMOJI, KIND_LABEL, isAccountKind } from '@/lib/networth/sources'
import type { SourceView } from '@/lib/networth/data'

const SUBTITLE = 'Tus cuentas de banco y tarjetas. Con saldo cuentan en tu patrimonio; con cierre de mes, Zafi te recuerda su estado de cuenta.'

function help(s: SourceView): string {
  return [KIND_LABEL[s.kind], s.institution && s.institution !== s.name ? s.institution : null, s.last4 ? `•••• ${s.last4}` : null]
    .filter(Boolean).join(' · ')
}

function AccountRight({ s, fmt }: { s: SourceView; fmt: (n: number) => string }) {
  if (s.kind === 'credit_card') {
    return s.debt
      ? <span className={`flex-none font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>−{fmt(s.debt.balance)}</span>
      : <span className={`flex-none text-[13px] ${TEXT_MUTED}`}>Sin deuda vinculada</span>
  }
  if (s.balance === null) return <span className={`flex-none text-[13px] ${TEXT_MUTED}`}>Sin saldo</span>
  return <span className={`flex-none font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{s.side === 'liability' ? '−' : ''}{fmt(s.balance)}</span>
}

export default function MisCuentasPage() {
  const fmt = useFormatMoney()
  const { state, reload } = useNetWorth({ archived: true })
  const [applePay, setApplePay] = useState(false)
  const [sheet, setSheet] = useState<{ kind: 'add' } | { kind: 'edit'; source: SourceView } | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const clearMessage = useCallback(() => setMessage(null), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  // Apple Pay está activo si hay al menos una clave del atajo.
  useEffect(() => {
    fetch('/api/shortcut-tokens', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setApplePay((data?.tokens ?? []).length > 0))
      .catch(() => {})
  }, [])

  if (state.status === 'loading') return <PageSkeleton variant="list" />
  const data = state.status === 'ok' ? state.data : null
  const canWrite = data?.canWrite ?? false
  const accounts = (data?.accounts ?? []).filter((a) => isAccountKind(a.kind))
  const mine = accounts.filter((a) => a.mine || !a.shared)
  const shared = accounts.filter((a) => !a.mine && a.shared)
  const archived = (data?.archived ?? []).filter((a) => isAccountKind(a.kind))

  async function restore(id: string, name: string) {
    const r = await sendJson(`/api/networth/sources/${id}`, 'PATCH', { restore: true })
    setMessage(r.ok ? { text: `${name} restaurada`, tone: 'ok' } : { text: r.error ?? 'No se pudo restaurar', tone: 'error' })
    if (r.ok) await reload()
  }

  const row = (s: SourceView) => (
    <button key={s.id} type="button" disabled={!canWrite} onClick={() => setSheet({ kind: 'edit', source: s })} className={`flex w-full items-center gap-3 py-3 ${ROW_DIVIDER}`}>
      <RowBody
        tile={<Tile>{KIND_EMOJI[s.kind]}</Tile>}
        name={s.name}
        badge={s.detected ? <span className={BADGE_INFO}>Detectada</span> : s.shared && s.mine ? <span className={BADGE_NEUTRAL}>Compartida</span> : undefined}
        help={help(s)}
      />
      <AccountRight s={s} fmt={fmt} />
      {canWrite && <Chevron />}
    </button>
  )

  return (
    <AppShell title="Mis cuentas" currentPath="/mis-fuentes" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/mas', label: 'Más' }} title="Mis cuentas" subtitle={SUBTITLE} />
        <p className={`hidden text-sm lg:block ${TEXT_MUTED}`}>{SUBTITLE}</p>

        {state.status === 'error' && (
          <div className="mt-3.5 flex flex-col gap-2">
            <ErrorBox>No pudimos cargar tus cuentas.</ErrorBox>
            <PillButton onClick={() => void reload()}>Reintentar</PillButton>
          </div>
        )}

        {data && (
          <>
            <GroupTitle>Tus cuentas · {mine.length}</GroupTitle>
            <ListCard>
              {mine.map(row)}
              {canWrite && (
                <button type="button" onClick={() => setSheet({ kind: 'add' })} className={`flex w-full items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <Tile className="bg-electric-ghost text-[22px] font-semibold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft">+</Tile>
                  <span className={`flex-1 text-left text-[15px] font-semibold ${LINK_TEXT}`}>Agregar cuenta</span>
                </button>
              )}
            </ListCard>

            {shared.length > 0 && (
              <>
                <GroupTitle>Compartidas por tu hogar · {shared.length}</GroupTitle>
                <ListCard>{shared.map(row)}</ListCard>
              </>
            )}

            <p className={`mx-1 mt-3 text-[13px] leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>
              Al importar un estado de cuenta, Zafi agrega el banco por ti. El saldo de las tarjetas se toma de Plan › Deudas.
              Efectivo, inversiones, vehículos, inmuebles y otras deudas se agregan en{' '}
              <Link href="/patrimonio" className={`font-semibold ${LINK_TEXT}`}>Mi patrimonio</Link>.
            </p>

            {/* Conexiones, aparte de las cuentas (C13) */}
            <GroupTitle>Conexiones</GroupTitle>
            <div className="flex flex-col">
              <Link href="/mis-fuentes/apple-pay" className={`flex items-center gap-3 p-3.5 transition-transform duration-150 active:scale-[0.98] ${CARD}`}>
                <RowBody tile={<Tile>📲</Tile>} name="Apple Pay" help="Tus pagos con el iPhone llegan solos" />
                {applePay && <span className={BADGE_OK}>Activo</span>}
                <Chevron />
              </Link>

              <Link href="/patrimonio" className={`mt-2.5 flex items-center gap-3 p-3.5 transition-transform duration-150 active:scale-[0.98] ${CARD}`}>
                <RowBody tile={<Tile>📈</Tile>} name="Mi patrimonio" help="Lo que tienes menos lo que debes" />
                <Chevron />
              </Link>
            </div>

            {archived.length > 0 && (
              <>
                <GroupTitle>Archivadas</GroupTitle>
                <ListCard>
                  {archived.map((s) => (
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

      <BottomSheet themed open={!!sheet} onClose={closeSheet} label={sheet?.kind === 'add' ? 'Agregar cuenta' : 'Editar cuenta'}>
        {sheet && data && (
          <AccountSheet
            key={sheet.kind === 'edit' ? sheet.source.id : 'nueva'}
            source={sheet.kind === 'edit' ? sheet.source : undefined}
            debts={data.debts}
            kinds={ACCOUNT_KINDS}
            onDone={(text) => { setSheet(null); setMessage({ text, tone: 'ok' }); void reload() }}
            onError={(text) => setMessage({ text, tone: 'error' })}
          />
        )}
      </BottomSheet>
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  )
}
