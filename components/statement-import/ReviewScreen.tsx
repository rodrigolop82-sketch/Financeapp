'use client'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { localToday } from '@/lib/dates'
import { dayLabel } from '@/lib/movimientos'
import { getEmoji, paymentLabel } from '@/lib/categories-ui'
import { cleanBankName } from '@/lib/import/classify'
import { CategorySheet } from '@/components/movimientos/CategorySheet'
import type { BatchSummary, ExtractedTransaction, ImportReviewContext } from '@/hooks/useStatementImport'

// El panel de importación es siempre claro (fondo blanco), como el resto del flujo.

interface ReviewScreenProps {
  transactions: ExtractedTransaction[]
  /** "Tarjeta •••• 4821" o el banco. */
  accountLabel: string | null
  /** Cargos que ya se habían importado antes. */
  alreadyImported: number
  review: ImportReviewContext | null
  isLoading: boolean
  error?: string | null
  onSame: (id: string, same: boolean) => void
  onSetCategory: (id: string, categoryId: string, subItemId: string | null, type: 'expense' | 'income') => void
  onConfirm: () => void
  onBack: () => void
  /** Nada que agregar: cierra el flujo. */
  onDone: () => void
  /** Fotos: cargos que se parecen entre fotos. */
  batch?: BatchSummary | null
  onRemove?: (id: string) => void
}

const fmt = (n: number) => formatMoney(n, { showDecimals: true })

export function ReviewScreen({
  transactions, accountLabel, alreadyImported, review, isLoading, error,
  onSame, onSetCategory, onConfirm, onBack, onDone, batch, onRemove,
}: ReviewScreenProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const today = localToday()
  const categories = review?.categories ?? []
  const subItems = review?.subItems ?? []
  const payLabel = accountLabel?.startsWith('Cuenta') ? 'Transferencia' : 'Tarjeta'

  const visible = transactions.filter(t => t.selected)
  const dups = visible.filter(t => t.kind === 'duplicate')
  const fixed = visible.filter(t => t.kind === 'fixed')
  const fresh = visible.filter(t => t.kind === 'new')
  const pending = dups.filter(t => t.same === null).length
  const toAdd = visible.filter(t => t.kind !== 'duplicate' || t.same === false).length

  const catOf = (id: string | null) => categories.find(c => c.id === id)
  const destLabel = (t: ExtractedTransaction) => {
    const cat = catOf(t.category_id)
    if (!cat) return 'Sin categoría'
    const part = t.subItemId ? subItems.find(s => s.id === t.subItemId)?.name : null
    return part ? `${cat.name} · ${part}` : cat.name
  }

  const editingTx = editing ? transactions.find(t => t.id === editing) : undefined
  if (editingTx) {
    return (
      <div className="flex flex-col">
        <button type="button" onClick={() => setEditing(null)} className="self-start flex items-center gap-1 min-h-[44px] px-4 text-[15px] font-semibold text-electric">
          <ChevronLeft size={18} aria-hidden /> Volver
        </button>
        <CategorySheet
          categories={categories}
          type={editingTx.type}
          subtitle={`${cleanBankName(editingTx.description)} · ${fmt(editingTx.amount)}`}
          initialCategoryId={editingTx.category_id}
          subItems={subItems}
          initialSubItemId={editingTx.subItemId}
          onSave={(categoryId, type, _all, subItemId) => {
            onSetCategory(editingTx.id, categoryId, subItemId, type)
            setEditing(null)
          }}
        />
      </div>
    )
  }

  const nothing = visible.length === 0
  const title = nothing ? 'Ya estás al día' : `Encontramos ${visible.length} ${visible.length === 1 ? 'cargo' : 'cargos'}`
  const sub = nothing
    ? 'Ya importaste todo lo de este estado de cuenta.'
    : dups.length > 0
      ? 'Algunos se parecen a gastos que ya registraste. Revísalos para no contarlos dos veces.'
      : 'Revisa que la categoría esté bien antes de agregarlos.'

  let buttonLabel: string
  if (nothing) buttonLabel = 'Listo'
  else if (pending > 0) buttonLabel = pending === 1 ? 'Revisa 1 posible duplicado' : `Revisa ${pending} posibles duplicados`
  else if (toAdd > 0) buttonLabel = `Agregar ${toAdd} ${toAdd === 1 ? 'movimiento' : 'movimientos'}`
  else buttonLabel = 'Listo, no hay nada nuevo'

  const sectionTitle = 'px-0.5 text-[13px] font-bold text-ink-700 dark:text-ink-200'
  const listBox = 'overflow-hidden rounded-2xl border border-ink-100'

  return (
    <div className="flex flex-col gap-[18px] px-5 pb-6 pt-1">
      <div className="flex flex-col gap-1">
        <button type="button" onClick={onBack} aria-label="Subir otro archivo" className="-ml-1 mb-1 flex h-8 w-8 items-center justify-center text-ink-500">
          <ChevronLeft size={20} aria-hidden />
        </button>
        {accountLabel && <span className="eyebrow">{accountLabel}</span>}
        <h2 tabIndex={-1} className="font-serif text-[26px] leading-tight text-ink-900 dark:text-ink-100 outline-none">{title}</h2>
        <p className="text-sm leading-[1.45] text-ink-500 [text-wrap:pretty]">{sub}</p>
        {alreadyImported > 0 && !nothing && (
          <p className="text-[13px] text-ink-400">
            {alreadyImported === 1 ? '1 cargo ya estaba importado.' : `${alreadyImported} cargos ya estaban importados.`}
          </p>
        )}
      </div>

      {dups.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={sectionTitle}>¿Es el mismo pago?</h3>
          {dups.map(t => {
            const m = t.matchId ? review?.matches[t.matchId] : undefined
            const cell = 'flex min-w-0 flex-col gap-0.5 rounded-xl bg-[var(--zafi-card)] px-3 py-2.5'
            const btn = (on: boolean, activeBg: string) =>
              `h-[42px] rounded-xl border-[1.5px] text-sm font-semibold ${on ? `${activeBg} text-white` : 'border-ink-100 bg-[var(--zafi-card)] dark:border-white/10 text-ink-700 dark:text-ink-200'}`
            return (
              <div key={t.id} className="flex flex-col gap-3 rounded-2xl bg-warning-light dark:bg-warning/15 p-3.5">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2.5">
                  <div className={cell}>
                    <span className="text-[11.5px] font-bold text-ink-500">Tú lo registraste</span>
                    <span className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{m?.description || 'Sin nombre'}</span>
                    <span className="font-outfit text-[17px] font-bold text-ink-900 dark:text-ink-100">{m ? fmt(Number(m.amount)) : ''}</span>
                    <span className="text-[12.5px] text-ink-500">{m ? `${dayLabel(m.date, today)} · ${paymentLabel(m.payment_method)}` : ''}</span>
                  </div>
                  <div className={cell}>
                    <span className="text-[11.5px] font-bold text-ink-500">Del banco</span>
                    <span className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{cleanBankName(t.description)}</span>
                    <span className="font-outfit text-[17px] font-bold text-ink-900 dark:text-ink-100">{fmt(t.amount)}</span>
                    <span className="text-[12.5px] text-ink-500">{dayLabel(t.date, today)} · {payLabel}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={t.same === true} onClick={() => onSame(t.id, true)} className={btn(t.same === true, 'border-electric bg-electric')}>
                    Es el mismo
                  </button>
                  <button type="button" aria-pressed={t.same === false} onClick={() => onSame(t.id, false)} className={btn(t.same === false, 'border-navy bg-navy')}>
                    Son distintos
                  </button>
                </div>
                {t.same !== null && (
                  <span className="text-[13px] leading-[1.4] text-warning-text">
                    {t.same ? 'Nos quedamos con uno solo, con los datos del banco y tu categoría.' : 'Se guardan los dos.'}
                  </span>
                )}
              </div>
            )
          })}
        </section>
      )}

      {fixed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={sectionTitle}>Coincide con un gasto fijo</h3>
          <div className={listBox}>
            {fixed.map((t, i) => {
              const cat = catOf(t.category_id)
              return (
                <div key={t.id} className={`flex items-center gap-3 px-3.5 py-3 ${i < fixed.length - 1 ? 'border-b border-[var(--zafi-border-light)]' : ''}`}>
                  <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-success-light text-xl dark:bg-[var(--zafi-success-bg)]">{cat ? getEmoji(cat) : '📌'}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[14.5px] font-semibold text-ink-900 dark:text-ink-100">{cleanBankName(t.description)}</span>
                    <span className="text-[12.5px] text-success-text dark:text-[var(--zafi-success-text)]">{destLabel(t)} · se marca pagado ✓</span>
                    <span className="truncate text-[11.5px] text-ink-400">{t.description}</span>
                  </span>
                  <span className="flex-none font-outfit text-[15px] font-bold text-ink-900 dark:text-ink-100">{fmt(t.amount)}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={sectionTitle}>Nuevos</h3>
          <div className={listBox}>
            {fresh.map((t, i) => {
              const cat = catOf(t.category_id)
              const batchDup = !!batch && batch.photoCount > 1 && t.possibleBatchDuplicate
                && (t.possibleDuplicateOf ?? []).some(id => transactions.find(x => x.id === id)?.selected)
              return (
                <div key={t.id} className={i < fresh.length - 1 ? 'border-b border-[var(--zafi-border-light)]' : ''}>
                  <button
                    type="button"
                    onClick={() => setEditing(t.id)}
                    aria-label={`${cleanBankName(t.description)}, ${destLabel(t)}. Cambiar categoría`}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-bg text-xl">{cat ? getEmoji(cat) : '❔'}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="truncate text-[14.5px] font-semibold text-ink-900 dark:text-ink-100">{cleanBankName(t.description)}</span>
                      <span className="text-[12.5px] text-ink-500">{destLabel(t)} · {dayLabel(t.date, today)}</span>
                      <span className="truncate text-[11.5px] text-ink-400">{t.description}</span>
                    </span>
                    <span className={`flex-none font-outfit text-[15px] font-bold ${t.type === 'income' ? 'text-success-dark' : 'text-ink-900 dark:text-ink-100'}`}>
                      {t.type === 'income' ? '+' : ''}{fmt(t.amount)}
                    </span>
                  </button>
                  {batchDup && onRemove && (
                    <div className="flex items-center gap-2 px-3.5 pb-3 pl-[66px] text-[12.5px] text-electric-dark">
                      Se repite en otra foto.
                      <button type="button" onClick={() => onRemove(t.id)} className="font-semibold underline">Quitar este</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger-light px-3.5 py-2.5 text-[13px] font-medium text-danger-text dark:bg-[var(--zafi-error-bg)] dark:text-[var(--zafi-error-text)]">{error}</p>
      )}

      <button
        type="button"
        aria-disabled={pending > 0}
        disabled={isLoading}
        onClick={() => {
          if (pending > 0) return
          if (nothing) onDone()
          else onConfirm()
        }}
        className={`h-[54px] w-full rounded-[14px] text-base font-semibold ${pending > 0 ? 'bg-ink-100 text-ink-500' : 'bg-electric text-white hover:bg-electric-dark'} disabled:opacity-60`}
      >
        {isLoading ? 'Guardando…' : buttonLabel}
      </button>
    </div>
  )
}
