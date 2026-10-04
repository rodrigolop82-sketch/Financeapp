'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, FileUp, Mic } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { localToday, localDaysAgo } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { deriveTransactionType } from '@/lib/transactions/transaction-type'
import { categoryQuestion, getEmoji, paymentLabel, PAYMENT_OPTIONS, type PaymentMethod } from '@/lib/categories-ui'
import { cleanAmountInput, dayLabel, topCategories } from '@/lib/movimientos'
import { VoiceOverlay } from '@/components/voice/VoiceOverlay'
import { StatementImportFlow } from '@/components/statement-import/StatementImportFlow'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { CategoryGrid, CATEGORY_TILE_CLASS } from '@/components/transactions/CategoryGrid'
import { CategorySheet } from '@/components/movimientos/CategorySheet'
import { DateSheet, OptionSheet } from '@/components/movimientos/OptionSheet'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { UndoToast } from '@/components/transactions/UndoToast'
import { SuccessCheck } from '@/components/motion/SuccessCheck'
import { EXPENSE_SAVED_EVENT } from '@/components/avisos/PushOfferSheet'
import { DELETE_UNDO_MS } from '@/lib/transactions/undo-delete'
import { SubItemPicker, type SubItemOption } from '@/components/movimientos/SubItemPicker'
import { suggestSubItem } from '@/lib/plan-del-mes'
import { isReservedLeaf } from '@/lib/month-start-data'
import {
  BORDER, PRIMARY_BUTTON, SHEET_TITLE, SOFT_BG, TEXT_BODY, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG, TILE_BG,
} from '@/components/movimientos/ui'
import type { BudgetCategory, ExtractedTransaction, VoiceExtractionResult } from '@/types'

/** Se emite cuando se guardan movimientos desde la hoja de agregar. */
export const TRANSACTIONS_CHANGED_EVENT = 'zafi:tx-changed'

export interface TxChangedDetail {
  /** Movimiento recién guardado (para resaltarlo en la lista). */
  id?: string
  date?: string
}

type TxType = 'expense' | 'income'

interface Draft {
  type: TxType
  amount: string
  name: string
  categoryId: string | null
  /** Parte del Plan del mes (obligatoria si la categoría tiene partes). */
  subItemId: string | null
  date: string
  pay: PaymentMethod
  originalAmount: number | null
  originalCurrency: string | null
}

interface AddContext {
  householdId: string
  userId: string
  categories: BudgetCategory[]
  /** Cuántas veces se usó cada categoría en los últimos 90 días. */
  usage: Record<string, number>
  /** Partes del Plan del mes. */
  subItems: SubItemOption[]
}

type SubView = 'category' | 'date' | 'payment'

/** Pantalla de éxito dentro de la hoja después de guardar. */
interface SaveSuccess {
  amount: string
  label: string
  /** Alto que tenía el formulario: la hoja no salta al cambiar de contenido. */
  minHeight: number
}

/** Guardado reciente con "Deshacer". */
interface SavedUndo {
  text: string
  ids: string[]
  /** Incluye un gasto: al cerrarse el toast (sin "Deshacer") se ofrecen los avisos. */
  hasExpense: boolean
  undone?: boolean
}

/** Mínimo que se ve el spinner del botón, y cuánto se queda el check antes de bajar la hoja. */
const SAVE_SPINNER_MIN_MS = 350
const SUCCESS_HOLD_MS = 1000

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Qué borrador edita la sub-hoja: el formulario manual o una tarjeta de "entendí esto". */
type Target = 'manual' | number

function blankDraft(): Draft {
  return { type: 'expense', amount: '', name: '', categoryId: null, subItemId: null, date: localToday(), pay: 'efectivo', originalAmount: null, originalCurrency: null }
}

function draftFromExtracted(t: ExtractedTransaction): Draft {
  return {
    type: t.type === 'income' ? 'income' : 'expense',
    amount: t.amount > 0 ? String(Math.round(t.amount * 100) / 100) : '',
    name: t.description ?? '',
    categoryId: t.category_id ?? null,
    subItemId: null,
    date: t.date || localToday(),
    pay: t.payment_method ?? 'efectivo',
    originalAmount: t.original_amount ?? null,
    originalCurrency: t.original_currency ?? null,
  }
}

/**
 * Parte sugerida por palabras clave del texto libre ("cuota mantenimiento"
 * → Vivienda · Cuota de mantenimiento). Si ninguna coincide, se pregunta.
 */
function withSuggestedPart(d: Draft, raw: string, context: AddContext | null): Draft {
  if (!context || d.type !== 'expense') return d
  const hit = suggestSubItem(`${raw} ${d.name}`, context.subItems)
  return hit ? { ...d, categoryId: hit.category_id, subItemId: hit.id } : d
}

function notifyTransactionsChanged(detail?: TxChangedDetail) {
  window.dispatchEvent(new CustomEvent<TxChangedDetail | undefined>(TRANSACTIONS_CHANGED_EVENT, { detail }))
}

/**
 * Hoja global de agregar. Se monta una vez en AppShell y se abre con el
 * evento `zafi:open-add` (el botón +), con `?action=voice|manual|scan` o
 * con `?shared_text=` (Web Share Target), en cualquier ruta.
 */
export function AddSheet() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [subView, setSubView] = useState<{ view: SubView; target: Target } | null>(null)
  const [ctx, setCtx] = useState<AddContext | null>(null)
  const loadRef = useRef<Promise<AddContext | null> | null>(null)

  const [quick, setQuick] = useState('')
  const [parsing, setParsing] = useState(false)
  const [manual, setManual] = useState<Draft>(blankDraft)
  const [parsed, setParsed] = useState<Draft[] | null>(null)
  const [parsedSource, setParsedSource] = useState<'text' | 'voice'>('text')
  const [rawText, setRawText] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<SaveSuccess | null>(null)
  const [saved, setSaved] = useState<SavedUndo | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const finishRef = useRef<(() => void) | null>(null)

  const [voiceOpen, setVoiceOpen] = useState(false)
  const [importActive, setImportActive] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)

  const quickRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  // El hogar, las categorías y su uso se cargan solo cuando hacen falta.
  const ensureContext = useCallback(() => {
    if (!loadRef.current) {
      loadRef.current = (async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        const household = await getUserHousehold(supabase, user.id)
        if (!household) return null
        const [{ data: cats }, { data: recent }, { data: subs }] = await Promise.all([
          supabase.from('budget_categories').select('*').eq('household_id', household.id),
          supabase
            .from('transactions')
            .select('category_id')
            .eq('household_id', household.id)
            .gte('date', localDaysAgo(90))
            .limit(1000),
          supabase
            .from('budget_sub_items')
            .select('id, category_id, name')
            .eq('household_id', household.id)
            .order('created_at', { ascending: true }),
        ])
        const usage: Record<string, number> = {}
        for (const r of (recent ?? []) as { category_id: string | null }[]) {
          if (r.category_id) usage[r.category_id] = (usage[r.category_id] ?? 0) + 1
        }
        const loaded: AddContext = {
          householdId: household.id as string,
          userId: user.id,
          categories: ((cats ?? []) as BudgetCategory[]).filter((c) => !c.archived_at),
          usage,
          subItems: (subs ?? []) as SubItemOption[],
        }
        setCtx(loaded)
        return loaded
      })().then((loaded) => {
        if (!loaded) loadRef.current = null
        return loaded
      })
    }
    return loadRef.current
  }, [])

  const toast = useCallback((text: string, tone: StatusMessage['tone'] = 'error') => setMessage({ text, tone }), [])
  const dismissSaved = useCallback(() => setSaved(null), [])

  // Momento justo para ofrecer los avisos (components/avisos/PushOfferSheet.tsx):
  // cuando se cierra el toast de un gasto guardado y no se deshizo.
  const lastSavedRef = useRef<SavedUndo | null>(null)
  useEffect(() => {
    const prev = lastSavedRef.current
    lastSavedRef.current = saved
    if (!saved && prev?.hasExpense && !prev.undone) window.dispatchEvent(new Event(EXPENSE_SAVED_EVENT))
  }, [saved])

  const resetAll = useCallback(() => {
    setQuick('')
    setManual(blankDraft())
    setParsed(null)
    setRawText('')
    setSubView(null)
  }, [])

  const openSheet = useCallback(() => {
    void ensureContext()
    setOpen(true)
  }, [ensureContext])

  const closeSheet = useCallback(() => {
    setOpen(false)
    setSubView(null)
  }, [])

  // ── Interpretar texto o voz ─────────────────────

  const applyExtraction = useCallback(async (transactions: ExtractedTransaction[], source: 'text' | 'voice', raw: string) => {
    const context = await ensureContext()
    const drafts = transactions.map(draftFromExtracted).map((d) => withSuggestedPart(d, raw, context))
    const withAmount = drafts.filter((d) => Number(d.amount) > 0)
    setRawText(raw)
    if (withAmount.length > 0) {
      setParsed(withAmount)
      setParsedSource(source)
      return
    }
    // Se entendió algo pero sin monto: se precarga el formulario manual.
    if (drafts[0]) setManual({ ...drafts[0], amount: '' })
    setParsed(null)
    toast('Falta el monto.')
    setTimeout(() => amountRef.current?.focus(), 50)
  }, [toast, ensureContext])

  const interpret = useCallback(async (text: string) => {
    const t = text.trim()
    if (!t || parsing) return
    setParsing(true)
    try {
      const res = await fetch('/api/parse-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(data.error || 'No pude entenderlo. Intenta de nuevo.')
      } else if (!data.transactions?.length) {
        toast(data.clarification || 'No entendí un movimiento en ese texto.')
      } else {
        await applyExtraction(data.transactions, 'text', t)
      }
    } catch {
      toast('Error de conexión. Intenta de nuevo.')
    }
    setParsing(false)
  }, [parsing, applyExtraction, toast])

  // ── Entradas: botón +, deep links y Web Share Target ──

  useEffect(() => {
    window.addEventListener('zafi:open-add', openSheet)
    return () => window.removeEventListener('zafi:open-add', openSheet)
  }, [openSheet])

  useEffect(() => {
    const url = new URL(window.location.href)
    const action = url.searchParams.get('action')
    const shared = url.searchParams.get('shared_text')
    if (!action && !shared) return
    url.searchParams.delete('action')
    url.searchParams.delete('shared_text')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    void ensureContext()
    if (shared) {
      setOpen(true)
      setQuick(shared)
      void interpret(shared)
    } else if (action === 'voice') {
      setVoiceOpen(true)
    } else if (action === 'scan') {
      setImportActive(true)
    } else if (action === 'manual') {
      setOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // El monto recibe el foco al abrir la hoja.
  useEffect(() => {
    if (!open || parsed || subView) return
    const t = setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 320)
    return () => clearTimeout(t)
  }, [open, parsed, subView])

  // ── Guardar ─────────────────────────────────────

  /** Si la categoría tiene partes, hay que elegir una. */
  function needsPart(d: Draft): boolean {
    return d.type === 'expense' && !!d.categoryId && !d.subItemId
      && (ctx?.subItems ?? []).some((p) => p.category_id === d.categoryId)
  }

  function validate(d: Draft): string | null {
    if (!(Number(d.amount) > 0)) return 'Falta el monto.'
    if (!d.categoryId) return d.type === 'income' ? 'Elige de dónde vino.' : 'Elige en qué fue.'
    if (needsPart(d)) return 'Elige de qué parte.'
    return null
  }

  async function save(drafts: Draft[], source: 'manual' | 'text' | 'voice') {
    if (saving || success) return
    const problem = drafts.map(validate).find(Boolean)
    if (problem) { toast(problem); return }
    const context = await ensureContext()
    if (!context) { toast('No pudimos encontrar tu hogar. Recarga la página.'); return }
    setSaving(true)
    const startedAt = Date.now()
    const formHeight = contentRef.current?.offsetHeight ?? 0
    const rows = drafts.map((d) => {
      const cat = context.categories.find((c) => c.id === d.categoryId)
      return {
        household_id: context.householdId,
        category_id: d.categoryId,
        amount: Number(d.amount),
        description: d.name.trim() || ctx?.subItems.find((p) => p.id === d.subItemId)?.name || cat?.name || null,
        date: d.date,
        source,
        type: d.type,
        transaction_type: deriveTransactionType(d.type, cat?.bucket),
        payment_method: d.pay,
        voice_raw_text: source === 'voice' ? rawText || null : null,
        created_by: context.userId,
        original_amount: d.originalAmount,
        original_currency: d.originalCurrency,
        // Solo se manda con parte: así funciona aunque falte la migración del Plan del mes.
        ...(d.subItemId ? { budget_sub_item_id: d.subItemId } : {}),
      }
    })
    const { data, error } = await createClient().from('transactions').insert(rows).select('id, date')
    if (error) {
      setSaving(false)
      toast(`No se pudo guardar: ${error.message}`)
      return
    }
    const first = rows[0]
    // Gasto en una hoja fija apartada: "pendiente" baja solo, no se cuenta dos veces.
    const joinedPromise = rows.length === 1 && first.type === 'expense' && !!first.category_id && first.date.slice(0, 7) === localToday().slice(0, 7)
      ? isReservedLeaf(createClient(), context.householdId, first.date.slice(0, 7), {
          categoryId: first.category_id,
          subItemId: drafts[0].subItemId,
        }).catch(() => false)
      : Promise.resolve(false)

    // El spinner del botón se ve al menos 350 ms; luego, el check.
    await wait(Math.max(0, SAVE_SPINNER_MIN_MS - (Date.now() - startedAt)))
    setSaving(false)
    const total = rows.reduce((sum, r) => sum + r.amount, 0)
    const cat = context.categories.find((c) => c.id === first.category_id)
    setSuccess({
      amount: formatMoney(total, { showDecimals: true }),
      label: rows.length > 1
        ? `${rows.length} movimientos · guardados`
        : `${cat ? `${getEmoji(cat)} ${cat.name}` : first.description ?? ''} · guardado`,
      minHeight: Math.min(formHeight, 520),
    })
    navigator.vibrate?.(15)

    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      finishRef.current = null
      closeSheet()
      // La hoja termina de bajar antes de volver al formulario.
      setTimeout(() => { setSuccess(null); resetAll() }, 320)
      notifyTransactionsChanged({ id: data?.[0]?.id, date: data?.[0]?.date ?? first.date })
      void joinedPromise.then((joined) => {
        setSaved({
          ids,
          hasExpense: rows.some((r) => r.type === 'expense'),
          text: rows.length > 1
            ? `Guardados ${rows.length} movimientos`
            : joined
              ? `Guardado: ${first.description ?? ''}. Lo juntamos con lo que ya habías apartado.`
              : `Guardado: ${first.description ?? ''} · ${formatMoney(first.amount, { showDecimals: true })}`,
        })
      })
    }
    finishRef.current = finish
    setTimeout(finish, SUCCESS_HOLD_MS)
  }

  /** "Deshacer" del guardado: borra lo que se acaba de insertar. */
  async function undoSaved() {
    const s = saved
    if (s) s.undone = true
    setSaved(null)
    if (!s || s.ids.length === 0) return
    const { error } = await createClient().from('transactions').delete().in('id', s.ids)
    if (error) { toast('No se pudo deshacer. Intenta de nuevo.'); return }
    notifyTransactionsChanged()
  }

  // ── Edición de borradores ────────────────────────

  function draftFor(target: Target): Draft | undefined {
    return target === 'manual' ? manual : parsed?.[target]
  }

  function patchDraft(target: Target, patch: Partial<Draft>) {
    if (target === 'manual') setManual((d) => ({ ...d, ...patch }))
    else setParsed((ps) => ps?.map((d, i) => (i === target ? { ...d, ...patch } : d)) ?? null)
  }

  function setType(target: Target, type: TxType) {
    const d = draftFor(target)
    if (!d) return
    const cat = ctx?.categories.find((c) => c.id === d.categoryId)
    const fits = cat && (type === 'income') === (cat.bucket === 'income')
    patchDraft(target, { type, categoryId: fits ? d.categoryId : null, subItemId: fits ? d.subItemId : null })
  }

  async function pasteFromClipboard() {
    quickRef.current?.focus()
    try {
      const text = await navigator.clipboard.readText()
      if (text) setQuick(text)
    } catch {
      // Sin permiso: el usuario puede pegarlo a mano en el campo.
    }
  }

  // ── Vista ───────────────────────────────────────

  const categories = ctx?.categories ?? []
  const catOf = (id: string | null) => categories.find((c) => c.id === id)
  const partsOf = (catId: string | null) => (ctx?.subItems ?? []).filter((p) => p.category_id === catId)
  const today = localToday()
  const fmtAmount = (d: Draft) => formatMoney(Number(d.amount) || 0, { showDecimals: true })

  const manualPool = categories.filter((c) => (manual.type === 'income') === (c.bucket === 'income'))
  // Las categorías con partes (p. ej. Vivienda) siempre están en la cuadrícula rápida.
  const withParts = new Set((ctx?.subItems ?? []).map((p) => p.category_id))
  let quickCats = topCategories(manualPool, ctx?.usage ?? {}, 7)
  for (const c of manualPool.filter((x) => withParts.has(x.id) && !quickCats.some((q) => q.id === x.id))) {
    const drop = [...quickCats].reverse().find((q) => !withParts.has(q.id))
    if (drop) quickCats = quickCats.map((q) => (q.id === drop.id ? c : q))
  }
  const manualCat = catOf(manual.categoryId)
  if (manualCat && !quickCats.some((c) => c.id === manualCat.id)) quickCats = [manualCat, ...quickCats.slice(0, 6)]
  const canSaveManual = Number(manual.amount) > 0 && !!manual.categoryId && !needsPart(manual)

  const chip = `h-9 px-3.5 rounded-full border text-[13.5px] font-semibold ${BORDER} ${TEXT_BODY} bg-[var(--zafi-card)]`
  const softChip = `h-[38px] px-3.5 rounded-full text-[13.5px] font-semibold ${TILE_BG} text-navy dark:text-ink-100`

  const sub = subView ? draftFor(subView.target) : undefined

  function closeSubOrSheet() {
    if (finishRef.current) finishRef.current()
    else if (subView) setSubView(null)
    else closeSheet()
  }

  return (
    <>
      <BottomSheet themed open={open} onClose={closeSubOrSheet} label="Agregar movimiento">
        {/* Guardado: check, monto y categoría; la hoja baja sola en ~1 s */}
        {success && (
          <div
            role="status"
            className="flex flex-col items-center justify-center px-5 pt-6 pb-[calc(60px+env(safe-area-inset-bottom))]"
            style={{ minHeight: success.minHeight || 360 }}
          >
            <SuccessCheck size={96} title={success.amount} subtitle={success.label} />
          </div>
        )}

        {/* Sub-hojas: categoría, fecha, forma de pago */}
        {!success && subView?.view === 'category' && sub && (
          <CategorySheet
            key={`${String(subView.target)}-${sub.type}`}
            categories={categories}
            type={sub.type}
            subtitle={sub.name || (Number(sub.amount) > 0 ? fmtAmount(sub) : '')}
            initialCategoryId={sub.categoryId}
            subItems={ctx?.subItems}
            initialSubItemId={sub.subItemId}
            onMissingSubItem={() => toast('Elige de qué parte.')}
            onSave={(categoryId, type, _applyAll, subItemId) => {
              patchDraft(subView.target, { categoryId, type, subItemId })
              setSubView(null)
            }}
          />
        )}
        {!success && subView?.view === 'date' && sub && (
          <DateSheet
            today={today}
            selected={sub.date}
            onSelect={(date) => { patchDraft(subView.target, { date }); setSubView(null) }}
          />
        )}
        {!success && subView?.view === 'payment' && sub && (
          <OptionSheet<PaymentMethod>
            title={sub.type === 'income' ? '¿Cómo lo recibiste?' : '¿Con qué pagaste?'}
            options={PAYMENT_OPTIONS}
            selected={sub.pay}
            onSelect={(pay) => { patchDraft(subView.target, { pay }); setSubView(null) }}
          />
        )}

        {/* Estado "entendí esto" */}
        {!success && !subView && parsed && (
          <div ref={contentRef} className="flex flex-col gap-4 px-5 pt-1.5 pb-[calc(30px+env(safe-area-inset-bottom))] overflow-y-auto [&>*]:shrink-0">
            <div className="flex flex-col gap-1">
              <h2 tabIndex={-1} className="eyebrow outline-none">Entendí esto</h2>
              {rawText && <p className={`text-sm italic ${TEXT_MUTED}`}>“{rawText}”</p>}
            </div>

            {parsed.map((d, i) => {
              const cat = catOf(d.categoryId)
              const isIncome = d.type === 'income'
              return (
                <div key={i} className={`flex flex-col gap-3 ${parsed.length > 1 ? `p-3.5 rounded-2xl border ${BORDER}` : ''}`}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className={`flex-none w-[52px] h-[52px] rounded-[15px] flex items-center justify-center text-[26px] ${TILE_BG}`}>
                      {cat ? getEmoji(cat) : '❔'}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className={`truncate font-semibold text-base ${TEXT_STRONG}`}>{d.name || cat?.name || 'Sin nombre'}</span>
                      <span className={`font-outfit font-extrabold text-[32px] leading-tight ${isIncome ? 'text-success-dark' : TEXT_STRONG}`}>
                        {isIncome ? '+' : ''}{fmtAmount(d)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setType(i, isIncome ? 'expense' : 'income')}
                      aria-label={`Tipo: ${isIncome ? 'ingreso' : 'gasto'}. Cambiar`}
                      className={`h-[38px] px-3.5 rounded-full text-[13.5px] font-semibold ${
                        isIncome ? 'bg-success-light text-success-text' : 'bg-electric-ghost text-electric-dark'
                      }`}
                    >
                      {isIncome ? 'Ingreso' : 'Gasto'}
                    </button>
                    <button type="button" onClick={() => setSubView({ view: 'category', target: i })} className={softChip}>
                      {cat ? `${getEmoji(cat)} ${cat.name}` : categoryQuestion(d.type)} ▾
                    </button>
                    <button type="button" onClick={() => setSubView({ view: 'date', target: i })} className={softChip}>
                      {dayLabel(d.date, today)} ▾
                    </button>
                    <button type="button" onClick={() => setSubView({ view: 'payment', target: i })} className={softChip}>
                      {paymentLabel(d.pay)} ▾
                    </button>
                  </div>
                  <SubItemPicker
                    options={partsOf(d.categoryId)}
                    selectedId={d.subItemId}
                    onSelect={(id) => patchDraft(i, { subItemId: id })}
                  />
                </div>
              )
            })}

            <p className={`text-[13.5px] ${TEXT_MUTED}`}>Toca cualquier dato para corregirlo.</p>
            <button
              type="button"
              disabled={saving}
              aria-disabled={parsed.some(needsPart)}
              onClick={() => void save(parsed, parsedSource)}
              className={parsed.some(needsPart)
                ? 'h-[54px] w-full rounded-[14px] font-semibold text-base bg-ink-100 text-ink-400 dark:bg-white/10'
                : PRIMARY_BUTTON}
            >
              {saving ? <span className="inline-block w-[22px] h-[22px] border-[2.5px] border-white/40 border-t-white rounded-full animate-spin align-middle" role="status" aria-label="Guardando" /> : parsed.length > 1 ? `Guardar ${parsed.length}` : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => { setManual(parsed[0]); setParsed(null); setTimeout(() => amountRef.current?.focus(), 50) }}
              className="h-10 text-electric font-semibold text-[14.5px]"
            >
              Corregir a mano
            </button>
          </div>
        )}

        {/* Estado "escribir" */}
        {!success && !subView && !parsed && (
          <div ref={contentRef} className="flex flex-col gap-4 px-5 pt-1.5 pb-[calc(30px+env(safe-area-inset-bottom))] overflow-y-auto [&>*]:shrink-0">
            <div className="flex flex-col gap-0.5">
              <h2 tabIndex={-1} className={SHEET_TITLE}>Agregar</h2>
              <p className={`text-sm ${TEXT_MUTED}`}>Escríbelo como se lo dirías a alguien.</p>
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); void interpret(quick) }}
            >
              <input
                ref={quickRef}
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                placeholder="Ej. “uber 38” o “me pagaron 8500”"
                aria-label="Escribe el movimiento"
                enterKeyHint="go"
                className={`flex-1 min-w-0 h-[50px] rounded-[14px] border-[1.5px] border-electric-soft px-3.5 text-[15.5px] outline-none focus:border-electric bg-[var(--zafi-card)] placeholder:text-ink-400 ${TEXT_STRONG}`}
              />
              {quick.trim() ? (
                <button
                  type="submit"
                  disabled={parsing}
                  aria-label="Interpretar"
                  className="flex-none w-[50px] h-[50px] rounded-[14px] bg-electric text-white flex items-center justify-center disabled:opacity-60"
                >
                  {parsing
                    ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
                    : <ArrowRight size={20} aria-hidden />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setVoiceOpen(true)}
                  aria-label="Dictar por voz"
                  className="flex-none w-[50px] h-[50px] rounded-[14px] bg-electric text-white flex items-center justify-center"
                >
                  <Mic size={20} aria-hidden />
                </button>
              )}
            </form>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVoiceOpen(true)}
                className={`h-[46px] rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold ${
                  voiceOpen
                    ? 'bg-[#FEF2F2] border-[#FCA5A5] text-danger-text'
                    : `${BORDER} bg-[var(--zafi-card)] text-navy dark:text-ink-100`
                }`}
              >
                <Mic size={18} aria-hidden />
                {voiceOpen ? 'Escuchando…' : 'Dictar'}
              </button>
              <button
                type="button"
                onClick={() => { closeSheet(); void ensureContext(); setImportActive(true) }}
                className={`h-[46px] rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold ${BORDER} bg-[var(--zafi-card)] text-navy dark:text-ink-100`}
              >
                <FileUp size={18} aria-hidden />
                Estado de cuenta
              </button>
            </div>

            <div className={`flex items-center gap-2.5 text-[13px] ${TEXT_FAINT}`}>
              <span className="flex-1 h-px bg-ink-100 dark:bg-white/10" />
              o llénalo tú
              <span className="flex-1 h-px bg-ink-100 dark:bg-white/10" />
            </div>

            <div role="radiogroup" aria-label="Gasté o recibí" className="grid grid-cols-2 rounded-xl p-1 bg-[var(--zafi-tab-bg)]">
              {(['expense', 'income'] as const).map((t) => {
                const active = manual.type === t
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType('manual', t)}
                    className={`h-[38px] rounded-[9px] font-semibold text-sm ${
                      active
                        ? `bg-[var(--zafi-tab-active)] shadow-[0_1px_3px_rgba(30,58,95,0.15)] ${t === 'income' ? 'text-success-dark' : 'text-[var(--zafi-tab-active-text)]'}`
                        : 'text-[var(--zafi-tab-inactive-text)]'
                    }`}
                  >
                    {t === 'income' ? 'Recibí' : 'Gasté'}
                  </button>
                )
              })}
            </div>

            <label className="flex items-center justify-center gap-1">
              <span aria-hidden className="font-outfit font-extrabold text-[44px] text-ink-400">Q</span>
              <input
                ref={amountRef}
                value={manual.amount}
                onChange={(e) => setManual((d) => ({ ...d, amount: cleanAmountInput(e.target.value) }))}
                inputMode="decimal"
                placeholder="0"
                aria-label="Monto"
                className={`w-[200px] bg-transparent outline-none font-outfit font-extrabold text-[48px] tracking-[-0.03em] placeholder:text-ink-200 ${TEXT_STRONG}`}
              />
            </label>

            <input
              value={manual.name}
              onChange={(e) => setManual((d) => ({ ...d, name: e.target.value }))}
              placeholder="¿Qué fue? (opcional)"
              aria-label="Nombre"
              maxLength={80}
              className={`h-[46px] rounded-xl border px-3.5 text-[15px] outline-none focus:border-electric placeholder:text-ink-400 ${BORDER} ${SOFT_BG} ${TEXT_STRONG}`}
            />

            <div className="flex flex-col gap-2">
              <span className={`text-[13px] font-semibold ${TEXT_MUTED}`}>{categoryQuestion(manual.type)}</span>
              {ctx ? (
                <CategoryGrid
                  themed
                  name="add-category"
                  categories={quickCats}
                  selectedId={manual.categoryId ?? ''}
                  onSelect={(id) => setManual((d) => ({ ...d, categoryId: id, subItemId: id === d.categoryId ? d.subItemId : null }))}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setSubView({ view: 'category', target: 'manual' })}
                      className={`${CATEGORY_TILE_CLASS} border-ink-100 dark:border-white/10 bg-[var(--zafi-card)] hover:border-ink-400`}
                    >
                      <span aria-hidden className={`text-[21px] leading-none ${TEXT_MUTED}`}>···</span>
                      <span className={`text-[11.5px] font-semibold ${TEXT_BODY}`}>Más</span>
                    </button>
                  }
                />
              ) : (
                <div className="grid grid-cols-4 gap-2" aria-hidden>
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} className={`h-[72px] rounded-[14px] animate-pulse ${TILE_BG}`} />
                  ))}
                </div>
              )}
            </div>

            <SubItemPicker
              options={partsOf(manual.categoryId)}
              selectedId={manual.subItemId}
              onSelect={(id) => setManual((d) => ({ ...d, subItemId: id }))}
            />

            <div className="flex gap-2">
              <button type="button" onClick={() => setSubView({ view: 'date', target: 'manual' })} className={chip}>
                {dayLabel(manual.date, today)} ▾
              </button>
              <button type="button" onClick={() => setSubView({ view: 'payment', target: 'manual' })} className={chip}>
                {paymentLabel(manual.pay)} ▾
              </button>
            </div>

            <button
              type="button"
              aria-disabled={!canSaveManual}
              disabled={saving}
              onClick={() => void save([manual], 'manual')}
              className={`h-[54px] w-full rounded-[14px] font-semibold text-base flex items-center justify-center transition duration-150 ${
                canSaveManual || saving ? 'bg-electric text-white hover:bg-electric-dark active:scale-[0.96]' : 'bg-ink-100 text-ink-400 dark:bg-white/10'
              }`}
            >
              {saving ? <span className="inline-block w-[22px] h-[22px] border-[2.5px] border-white/40 border-t-white rounded-full animate-spin align-middle" role="status" aria-label="Guardando" /> : manual.type === 'income' ? 'Guardar ingreso' : 'Guardar gasto'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Foto', hint: 'de un recibo', emoji: '📷', onClick: () => { closeSheet(); router.push('/capture') } },
                { label: 'Mensaje', hint: 'del banco', emoji: '💬', onClick: () => { void pasteFromClipboard() } },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={o.onClick}
                  className={`h-[72px] rounded-[14px] flex flex-col items-center justify-center gap-0.5 ${SOFT_BG}`}
                >
                  <span aria-hidden className="text-lg leading-none">{o.emoji}</span>
                  <span className={`text-[13px] font-semibold ${TEXT_STRONG}`}>{o.label}</span>
                  <span className={`text-[11.5px] ${TEXT_MUTED}`}>{o.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>

      {ctx && importActive && (
        <StatementImportFlow
          householdId={ctx.householdId}
          onDone={() => setImportActive(false)}
          onChanged={() => notifyTransactionsChanged()}
        />
      )}

      <VoiceOverlay
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onResult={(result: VoiceExtractionResult) => {
          setVoiceOpen(false)
          setOpen(true)
          void ensureContext()
          if (!result.transactions?.length) {
            toast(result.clarification || 'No entendí un movimiento. Intenta de nuevo.')
            return
          }
          void applyExtraction(result.transactions, 'voice', result.raw_text)
        }}
        onError={(err) => toast(err)}
      />

      <StatusToast message={message} onDone={() => setMessage(null)} />
      <UndoToast
        visible={!!saved && !message}
        title={saved?.text ?? ''}
        duration={DELETE_UNDO_MS}
        onUndo={() => void undoSaved()}
        onDismiss={dismissSaved}
      />
    </>
  )
}
