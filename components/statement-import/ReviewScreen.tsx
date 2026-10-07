'use client'
import { useState } from 'react'
import { Check, ChevronLeft, Copy } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { localToday } from '@/lib/dates'
import { dayLabel } from '@/lib/movimientos'
import { getEmoji, paymentLabel } from '@/lib/categories-ui'
import { cleanBankName } from '@/lib/import/classify'
import { CategorySheet } from '@/components/movimientos/CategorySheet'
import type { BatchSummary, ExtractedTransaction, ImportReviewContext } from '@/hooks/useStatementImport'

interface ReviewScreenProps {
  transactions: ExtractedTransaction[]
  /** "Tarjeta •••• 4821" o el banco. */
  accountLabel: string | null
  /** Cargos que ya se habían importado antes. */
  alreadyImported: number
  review: ImportReviewContext | null
  isLoading: boolean
  error?: string | null
  /** null vuelve a dejar el duplicado pendiente ("Cambiar"). */
  onSame: (id: string, same: boolean | null) => void
  /** Casilla de un cargo nuevo: incluirlo o no. */
  onToggle: (id: string) => void
  /** "Incluir todos" / "Quitar todos" en Nuevos. */
  onSetAllNew: (selected: boolean) => void
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
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function ReviewScreen({
  transactions, accountLabel, alreadyImported, review, isLoading, error,
  onSame, onToggle, onSetAllNew, onSetCategory, onConfirm, onBack, onDone, batch, onRemove,
}: ReviewScreenProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const today = localToday()
  const categories = review?.categories ?? []
  const subItems = review?.subItems ?? []
  const payLabel = accountLabel?.startsWith('Cuenta') ? 'Transferencia' : 'Tarjeta'

  // Los nuevos se listan todos (los quitados quedan atenuados para poder volver a incluirlos).
  const dups = transactions.filter(t => t.kind === 'duplicate' && t.selected)
  const fixed = transactions.filter(t => t.kind === 'fixed' && t.selected)
  const fresh = transactions.filter(t => t.kind === 'new')
  const freshIn = fresh.filter(t => t.selected)
  const pending = dups.filter(t => t.same === null).length
  const dupsDistinct = dups.filter(t => t.same === false)
  const dupsSame = dups.filter(t => t.same === true).length
  const removed = fresh.length - freshIn.length
  const adding = [...freshIn, ...fixed, ...dupsDistinct]
  const toAdd = adding.length
  const spent = adding.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

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

  const nothing = transactions.length === 0
  const title = nothing ? 'Ya estás al día' : `Encontramos ${plural(transactions.length, 'cargo', 'cargos')}`
  const sub = nothing
    ? 'Ya importaste todo lo de este estado de cuenta.'
    : dups.length > 0
      ? 'Algunos se parecen a gastos que ya registraste. Revísalos para no contarlos dos veces.'
      : 'Revisa que la categoría esté bien antes de agregarlos.'

  let buttonLabel: string
  if (nothing) buttonLabel = 'Listo'
  else if (pending > 0) buttonLabel = pending === 1 ? 'Revisa 1 posible duplicado' : `Revisa ${pending} posibles duplicados`
  else if (toAdd > 0) buttonLabel = `Agregar ${plural(toAdd, 'movimiento', 'movimientos')}`
  else buttonLabel = 'Listo, no hay nada nuevo'

  let footNote: string | null = null
  if (!nothing) {
    if (pending > 0) footNote = `Faltan ${plural(pending, 'duplicado', 'duplicados')} por revisar`
    else {
      const parts: string[] = []
      if (spent > 0) parts.push(`${fmt(spent)} en gastos`)
      if (dupsSame) parts.push(plural(dupsSame, 'no se duplica', 'no se duplican'))
      if (removed) parts.push(plural(removed, 'quitado', 'quitados'))
      footNote = parts.length ? parts.join(' · ') : null
    }
  }

  const sectionHead = 'flex items-baseline justify-between gap-3 px-0.5'
  const sectionTitle = 'text-[13px] font-bold text-ink-700 dark:text-ink-200'
  const sectionCount = 'font-medium text-ink-400 dark:text-[var(--zafi-text-muted)]'
  const textAction = 'py-1.5 text-[13px] font-semibold text-electric-light'
  const listBox = 'overflow-hidden rounded-2xl border border-[var(--zafi-border)]'
  const strong = 'text-ink-900 dark:text-ink-100'
  const secondary = 'text-[var(--zafi-text-secondary)]'
  const muted = 'text-[var(--zafi-text-muted)]'
  // Ámbar: en claro el texto oscuro da contraste suficiente sobre card-alt.
  const amber = 'font-semibold text-warning-text dark:text-warning'

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-[22px] px-5 pb-5 pt-1">
        <div className="flex flex-col gap-1">
          <button type="button" onClick={onBack} aria-label="Subir otro archivo" className="-ml-1 mb-1 flex h-8 w-8 items-center justify-center text-ink-500">
            <ChevronLeft size={20} aria-hidden />
          </button>
          {accountLabel && <span className="eyebrow">{accountLabel}</span>}
          <h2 tabIndex={-1} className={`font-serif text-[26px] leading-[1.15] outline-none ${strong}`}>{title}</h2>
          <p className={`text-sm leading-[1.45] [text-wrap:pretty] ${secondary}`}>{sub}</p>
          {alreadyImported > 0 && !nothing && (
            <p className="text-[13px] text-ink-400">
              {alreadyImported === 1 ? '1 cargo ya estaba importado.' : `${alreadyImported} cargos ya estaban importados.`}
            </p>
          )}
        </div>

        {dups.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className={sectionHead}>
              <h3 className={sectionTitle}>
                ¿Ya los tenías? <span className={sectionCount}>· {dups.length - pending} de {dups.length}</span>
              </h3>
              {pending >= 2 && (
                <button type="button" className={textAction} onClick={() => dups.forEach(t => { if (t.same === null) onSame(t.id, true) })}>
                  Todos son el mismo ›
                </button>
              )}
            </div>
            {dups.map(t => {
              const m = t.matchId ? review?.matches[t.matchId] : undefined
              const bankName = cleanBankName(t.description)

              if (t.same !== null) {
                return (
                  <div key={t.id} className="flex min-h-[56px] animate-fade-up items-center gap-3 rounded-[14px] bg-[var(--zafi-card-alt)] px-3.5 py-2.5">
                    <span aria-hidden className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-white ${t.same ? 'bg-success-dark' : 'bg-navy-light'}`}>
                      {t.same ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2.5} />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={`truncate text-sm font-semibold ${strong}`}>{bankName} · {fmt(t.amount)}</span>
                      <span className={`text-[12.5px] ${secondary}`}>
                        {t.same ? 'Es el mismo — te quedas con uno' : 'Son distintos — se guardan los dos'}
                      </span>
                    </span>
                    <button type="button" onClick={() => onSame(t.id, null)} className="flex-none py-2.5 pl-2 text-[13px] font-semibold text-electric-light">
                      Cambiar
                    </button>
                  </div>
                )
              }

              const dateDiff = !!m && m.date !== t.date
              const methodDiff = !!m && paymentLabel(m.payment_method) !== payLabel
              const diffs = [dateDiff && 'la fecha', methodDiff && 'el método'].filter(Boolean)
              const pill = 'h-11 rounded-full text-sm font-semibold transition-transform active:scale-[.96]'
              return (
                <div key={t.id} className="flex animate-fade-up flex-col gap-3 rounded-2xl border border-[rgba(245,158,11,.45)] bg-[var(--zafi-card-alt)] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-outfit text-[20px] font-extrabold tracking-[-0.02em] ${strong}`}>{fmt(t.amount)}</span>
                    <span className="rounded-full bg-[rgba(245,158,11,.16)] px-[9px] py-[3px] text-[11.5px] font-bold text-warning-text dark:text-warning">Mismo monto</span>
                  </div>
                  <div className="grid grid-cols-[54px_minmax(0,1fr)] items-baseline gap-2">
                    <span className={`text-[11.5px] font-bold ${muted}`}>Tú</span>
                    <span className="flex min-w-0 flex-col">
                      <span className={`truncate text-sm font-semibold ${strong}`}>{m?.description || 'Sin nombre'}</span>
                      <span className={`text-[12.5px] ${secondary}`}>{m ? `${dayLabel(m.date, today)} · ${paymentLabel(m.payment_method)}` : ''}</span>
                    </span>
                    <span className={`text-[11.5px] font-bold ${muted}`}>Banco</span>
                    <span className="flex min-w-0 flex-col">
                      <span className={`truncate text-sm font-semibold ${strong}`}>{bankName}</span>
                      <span className={`text-[12.5px] ${secondary}`}>
                        <span className={dateDiff ? amber : ''}>{dayLabel(t.date, today)}</span>
                        {' · '}
                        <span className={methodDiff ? amber : ''}>{payLabel}</span>
                      </span>
                    </span>
                  </div>
                  {diffs.length > 0 && (
                    <span className="text-[12.5px] leading-[1.4] text-warning-text dark:text-warning">
                      Cambia {diffs.join(' y ')}. Si es el mismo, nos quedamos con los datos del banco y tu categoría.
                    </span>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => onSame(t.id, true)} className={`${pill} bg-electric text-white hover:bg-electric-dark`}>
                      Sí, es el mismo
                    </button>
                    <button type="button" onClick={() => onSame(t.id, false)} className={`${pill} border-[1.5px] border-[var(--zafi-border)] bg-transparent ${strong}`}>
                      Son distintos
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {fixed.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className={`px-0.5 ${sectionTitle}`}>Coincide con un gasto fijo</h3>
            <div className={listBox}>
              {fixed.map((t, i) => {
                const cat = catOf(t.category_id)
                return (
                  <div key={t.id} className={`flex items-center gap-3 px-3.5 py-3 ${i < fixed.length - 1 ? 'border-b border-[var(--zafi-border-light)]' : ''}`}>
                    <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-success-light text-xl dark:bg-[var(--zafi-success-bg)]">{cat ? getEmoji(cat) : '📌'}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className={`truncate text-[14.5px] font-semibold ${strong}`}>{cleanBankName(t.description)}</span>
                      <span className="text-[12.5px] text-success-text dark:text-[var(--zafi-success-text)]">{destLabel(t)} · se marca pagado ✓</span>
                      <span className="truncate text-[11.5px] text-ink-400">{t.description}</span>
                    </span>
                    <span className={`flex-none font-outfit text-[15px] font-bold ${strong}`}>{fmt(t.amount)}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {fresh.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className={sectionHead}>
              <h3 className={sectionTitle}>
                Nuevos <span className={sectionCount}>· {freshIn.length} de {fresh.length} se agregan</span>
              </h3>
              <button type="button" className={textAction} onClick={() => onSetAllNew(freshIn.length !== fresh.length)}>
                {freshIn.length === fresh.length ? 'Quitar todos' : 'Incluir todos'}
              </button>
            </div>
            <div className={listBox}>
              {fresh.map((t, i) => {
                const cat = catOf(t.category_id)
                const name = cleanBankName(t.description)
                const on = t.selected
                const batchDup = on && !!batch && batch.photoCount > 1 && t.possibleBatchDuplicate
                  && (t.possibleDuplicateOf ?? []).some(id => transactions.find(x => x.id === id)?.selected)
                return (
                  <div key={t.id} className={i < fresh.length - 1 ? 'border-b border-[var(--zafi-border-light)]' : ''}>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setEditing(t.id)}
                        aria-label={`${name}, ${destLabel(t)}. Cambiar categoría`}
                        className={`flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3.5 pr-1 text-left transition-opacity duration-200 ${on ? '' : 'opacity-[.42]'}`}
                      >
                        <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-bg text-xl">{cat ? getEmoji(cat) : '❔'}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-px">
                          <span className={`truncate text-[14.5px] font-semibold ${strong}`}>{name}</span>
                          <span className={`text-[12.5px] ${secondary}`}>{destLabel(t)} · {dayLabel(t.date, today)}</span>
                          <span className={`truncate text-[11.5px] ${muted}`}>{t.description}</span>
                        </span>
                        <span className={`flex-none font-outfit text-[15px] font-bold ${t.type === 'income' ? 'text-success' : strong} ${on ? '' : 'line-through'}`}>
                          {t.type === 'income' ? '+' : ''}{fmt(t.amount)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggle(t.id)}
                        aria-pressed={on}
                        aria-label={on ? `Quitar ${name}` : `Incluir ${name}`}
                        className="flex h-[60px] w-[52px] flex-none items-center justify-center pl-1 pr-3.5"
                      >
                        <span
                          aria-hidden
                          className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-white transition-colors duration-150 ${on ? 'bg-electric' : 'border-[1.5px] border-[var(--zafi-text-muted)] bg-transparent'}`}
                        >
                          {on && <Check size={14} strokeWidth={3} />}
                        </span>
                      </button>
                    </div>
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
            <span className={`px-0.5 text-[12.5px] leading-[1.4] ${muted}`}>
              Toca un cargo para cambiar su categoría. Quita los que no quieras contar, como el pago de tu tarjeta.
            </span>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-danger-light px-3.5 py-2.5 text-[13px] font-medium text-danger-text dark:bg-[var(--zafi-error-bg)] dark:text-[var(--zafi-error-text)]">{error}</p>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[var(--zafi-border-light)] bg-[var(--zafi-card)] px-5 pb-[30px] pt-3">
        {footNote && <span className={`text-center text-[12.5px] ${secondary}`}>{footNote}</span>}
        <button
          type="button"
          aria-disabled={pending > 0}
          disabled={isLoading}
          onClick={() => {
            if (pending > 0) return
            if (nothing) onDone()
            else onConfirm()
          }}
          className={`h-[54px] w-full rounded-[14px] text-base font-semibold ${pending > 0 ? `cursor-default bg-[var(--zafi-card-alt)] ${muted}` : 'bg-electric text-white hover:bg-electric-dark'} disabled:opacity-60`}
        >
          {isLoading ? 'Guardando…' : buttonLabel}
        </button>
      </div>
    </div>
  )
}
