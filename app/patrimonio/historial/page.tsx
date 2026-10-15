'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import {
  BADGE_INFO, DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, GroupTitle, INPUT_48, ListCard, PageHeader, PillButton, ROW_DIVIDER, SheetHeader,
} from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { PremiumInline } from '@/components/premium/PremiumInline'
import { upgradeHref } from '@/components/premium/PremiumTag'
import { useMaskedFmt, usePrivacy } from '@/components/privacidad/PrivacyProvider'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { localMonth } from '@/lib/dates'
import { addMonths } from '@/lib/como-te-fue'
import { MIN_MONTH, type HistoryRow } from '@/lib/networth/manual'

const BACK = { href: '/patrimonio', label: 'Mi patrimonio' }
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function monthText(month: string): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1] ?? month
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`
}

function num(v: string): number | null {
  const clean = v.replace(/[^0-9.]/g, '')
  if (clean === '') return null
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : null
}

type Load = { status: 'loading' } | { status: 'premium' } | { status: 'error' } | { status: 'ok'; rows: HistoryRow[] }
type Sheet = { month: string | null; row: HistoryRow | null; key: number }

// F3 Etapa B: corregir o agregar meses del historial, incluso de antes de
// usar Zafi. Premium, como la gráfica.
export default function HistorialPatrimonioPage() {
  const fmt = useMaskedFmt(useFormatMoney())
  const privacy = usePrivacy()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const clearMessage = useCallback(() => setMessage(null), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  const reload = useCallback(async () => {
    const res = await fetch('/api/networth/history', { cache: 'no-store' }).catch(() => null)
    if (res?.status === 403) { setLoad({ status: 'premium' }); return }
    if (!res?.ok) { setLoad({ status: 'error' }); return }
    const body = (await res.json()) as { series: HistoryRow[] }
    setLoad({ status: 'ok', rows: [...body.series].reverse() })
  }, [])

  useEffect(() => { void reload() }, [reload])

  if (load.status === 'loading' || !privacy.resolved) return <PageSkeleton variant="detail" />

  return (
    <AppShell title="Editar historial" currentPath="/patrimonio" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={BACK} title="Editar historial" subtitle="Corrige un mes o agrega meses de antes de usar Zafi." />

        {load.status === 'premium' && (
          <PremiumInline className="mt-3.5">
            Editar tu historial es parte de Premium. <Link href={upgradeHref('networth')} className="font-semibold underline">Ver Premium ›</Link>
          </PremiumInline>
        )}
        {load.status === 'error' && (
          <div className="mt-3.5 flex flex-col gap-2">
            <ErrorBox>No pudimos cargar tu historial.</ErrorBox>
            <PillButton onClick={() => void reload()}>Reintentar</PillButton>
          </div>
        )}

        {load.status === 'ok' && (
          <>
            <button
              type="button"
              onClick={() => setSheet({ month: null, row: null, key: Date.now() })}
              className="mt-3.5 flex h-[52px] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-electric-soft text-[15px] font-semibold text-electric-dark dark:text-electric-soft"
            >
              + Agregar un mes
            </button>
            <GroupTitle>Tus meses</GroupTitle>
            <ListCard>
              {load.rows.length === 0 && <p className={`py-3 text-sm ${TEXT_MUTED}`}>Aún no hay meses cerrados. Agrega uno para empezar.</p>}
              {load.rows.map((r) => (
                <button
                  key={r.month}
                  type="button"
                  onClick={() => setSheet({ month: r.month, row: r, key: Date.now() })}
                  className={`flex min-h-[56px] w-full items-center gap-3 py-3 text-left ${ROW_DIVIDER}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{monthText(r.month)}</span>
                    <span className={`text-[13px] ${TEXT_MUTED}`}>{r.origin === 'manual' ? 'Lo escribiste tú' : 'Calculado con tus saldos'}</span>
                  </span>
                  {r.origin === 'manual' && <span className={BADGE_INFO}>Editado</span>}
                  <span className={`flex-none font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{r.netWorth < 0 ? '−' : ''}{fmt(Math.abs(r.netWorth))}</span>
                </button>
              ))}
            </ListCard>
            <p className={`mt-3 px-1 text-[13px] leading-[1.4] ${TEXT_MUTED}`}>
              Un mes que escribes tú reemplaza al calculado en la gráfica. Si lo quitas, vuelve el cálculo.
            </p>
          </>
        )}
      </div>

      <BottomSheet themed open={!!sheet} onClose={closeSheet} label={sheet?.row ? 'Editar mes' : 'Agregar un mes'}>
        {sheet && (
          <MonthSheet
            key={sheet.key}
            row={sheet.row}
            fmt={fmt}
            onDone={(text) => { setSheet(null); setMessage({ text, tone: 'ok' }); void reload() }}
          />
        )}
      </BottomSheet>
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  )
}

function MonthSheet({ row, fmt, onDone }: { row: HistoryRow | null; fmt: (n: number) => string; onDone: (text: string) => void }) {
  const lastClosed = addMonths(localMonth(), -1)
  const [month, setMonth] = useState(row?.month ?? lastClosed)
  const [assets, setAssets] = useState(row?.origin === 'manual' ? String(row.assets ?? '') : '')
  const [liabilities, setLiabilities] = useState(row?.origin === 'manual' ? String(row.liabilities ?? '') : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const a = num(assets)
    const l = num(liabilities) ?? 0
    if (a === null) { setError('Escribe cuánto tenías ese mes.'); return }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/networth/history/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, assets: a, liabilities: l }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const body = await res?.json().catch(() => null)
      setError((body as { error?: string } | null)?.error ?? 'No se pudo guardar el mes. Intenta de nuevo.')
      return
    }
    onDone(`Guardamos ${monthText(month).toLowerCase()}`)
  }

  async function remove() {
    setSaving(true)
    const res = await fetch(`/api/networth/history/manual?month=${month}`, { method: 'DELETE' }).catch(() => null)
    setSaving(false)
    if (!res?.ok) { setError('No se pudo quitar. Intenta de nuevo.'); return }
    onDone('Volvimos al cálculo de ese mes')
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-6 pt-2">
      <SheetHeader emoji="📈" title={row ? monthText(row.month) : 'Agregar un mes'} subtitle={row?.origin === 'auto' ? `Hoy calculado: ${fmt(row.netWorth)}` : undefined} />
      {!row && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="hist-mes">Mes</FieldLabel>
          <input
            id="hist-mes"
            type="month"
            value={month}
            min={MIN_MONTH}
            max={lastClosed}
            onChange={(e) => setMonth(e.target.value)}
            className={INPUT_48}
          />
        </div>
      )}
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="hist-tenias">Lo que tenías</FieldLabel>
          <input id="hist-tenias" inputMode="decimal" value={assets} onChange={(e) => setAssets(e.target.value)} placeholder="Q 0" className={INPUT_48} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="hist-debias">Lo que debías</FieldLabel>
          <input id="hist-debias" inputMode="decimal" value={liabilities} onChange={(e) => setLiabilities(e.target.value)} placeholder="Q 0" className={INPUT_48} />
        </div>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={saving} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {row?.origin === 'manual' && (
        <button type="button" onClick={() => void remove()} disabled={saving} className={DANGER_TEXT_BUTTON}>
          Quitar y usar el cálculo
        </button>
      )}
    </div>
  )
}
