'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { localToday } from '@/lib/dates'
import { deriveTransactionType } from '@/lib/transactions/transaction-type'
import { AddExpenseSheet } from '@/components/dashboard/AddExpenseSheet'
import { ExpenseDrawer } from '@/components/expenses/ExpenseDrawer'
import { VoiceOverlay } from '@/components/voice/VoiceOverlay'
import { TransactionPreview } from '@/components/voice/TransactionPreview'
import { StatementImportFlow } from '@/components/statement-import/StatementImportFlow'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import type { BudgetCategory, ExtractedTransaction, VoiceExtractionResult } from '@/types'

/** Se emite cuando se guardan movimientos desde la hoja de agregar. */
export const TRANSACTIONS_CHANGED_EVENT = 'zafi:transactions-changed'

type AddAction = 'voice' | 'manual' | 'scan'

interface AddContext {
  householdId: string
  userId: string
  categories: BudgetCategory[]
}

function notifyTransactionsChanged() {
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT))
}

/**
 * Hoja global de agregar. Se monta una vez en AppShell y se abre con el
 * evento `zafi:open-add` (el botón + de la barra inferior) o con los deep
 * links `?action=voice|manual|scan` en cualquier ruta.
 */
export function AddSheet() {
  const [chooserOpen, setChooserOpen] = useState(false)
  const [ctx, setCtx] = useState<AddContext | null>(null)
  const loadRef = useRef<Promise<AddContext | null> | null>(null)
  const [pendingManual, setPendingManual] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [importActive, setImportActive] = useState(false)
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)

  // El hogar y las categorías se cargan solo cuando hacen falta, para no
  // sumar consultas a cada página que usa AppShell.
  const ensureContext = useCallback(() => {
    if (!loadRef.current) {
      loadRef.current = (async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        const household = await getUserHousehold(supabase, user.id)
        if (!household) return null
        const { data: cats } = await supabase
          .from('budget_categories')
          .select('*')
          .eq('household_id', household.id)
        const loaded = { householdId: household.id as string, userId: user.id, categories: (cats ?? []) as BudgetCategory[] }
        setCtx(loaded)
        return loaded
      })().then((loaded) => {
        if (!loaded) loadRef.current = null
        return loaded
      })
    }
    return loadRef.current
  }, [])

  const showMessage = useCallback((text: string, tone: 'ok' | 'error') => {
    setMessage({ text, tone })
  }, [])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), message.tone === 'error' ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [message])

  const runAction = useCallback((action: AddAction) => {
    void ensureContext()
    if (action === 'voice') setVoiceOpen(true)
    if (action === 'manual') setPendingManual(true)
    if (action === 'scan') setImportActive(true)
  }, [ensureContext])

  // ExpenseDrawer se monta cuando hay contexto; recién ahí se le puede abrir.
  useEffect(() => {
    if (!pendingManual || !ctx) return
    setPendingManual(false)
    window.dispatchEvent(new CustomEvent('zafi:open-expense-drawer'))
  }, [pendingManual, ctx])

  useEffect(() => {
    function onOpen() {
      setChooserOpen(true)
      void ensureContext()
    }
    window.addEventListener('zafi:open-add', onOpen)
    return () => window.removeEventListener('zafi:open-add', onOpen)
  }, [ensureContext])

  // Deep links ?action=voice|manual|scan. Se quita el parámetro para que
  // recargar la página no vuelva a abrir el flujo.
  useEffect(() => {
    const url = new URL(window.location.href)
    const action = url.searchParams.get('action')
    if (action !== 'voice' && action !== 'manual' && action !== 'scan') return
    url.searchParams.delete('action')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    runAction(action)
  }, [runAction])

  async function saveVoiceTransactions(transactions: ExtractedTransaction[]) {
    const context = await ensureContext()
    if (!context || transactions.length === 0) return
    const supabase = createClient()
    const rows = transactions.map((t) => {
      const type = t.type === 'income' ? 'income' : 'expense'
      const cat = context.categories.find((c) => c.id === t.category_id)
      return {
        household_id: context.householdId,
        amount: t.amount,
        description: t.description,
        category_id: t.category_id ?? null,
        date: t.date || localToday(),
        source: 'voice' as const,
        type,
        transaction_type: deriveTransactionType(type, cat?.bucket),
        payment_method: 'efectivo' as const,
        voice_raw_text: voiceResult?.raw_text ?? null,
        created_by: context.userId,
        original_amount: t.original_amount ?? null,
        original_currency: t.original_currency ?? null,
      }
    })
    const { error } = await supabase.from('transactions').insert(rows)
    if (error) {
      showMessage(`No se pudo guardar: ${error.message}`, 'error')
      return
    }
    setVoiceResult(null)
    const n = transactions.length
    showMessage(`${n} movimiento${n > 1 ? 's' : ''} guardado${n > 1 ? 's' : ''}`, 'ok')
    notifyTransactionsChanged()
  }

  const closeChooser = useCallback(() => setChooserOpen(false), [])
  const closeVoicePreview = useCallback(() => setVoiceResult(null), [])

  return (
    <>
      <AddExpenseSheet
        open={chooserOpen}
        onClose={closeChooser}
        onScan={() => runAction('scan')}
        onVoice={() => runAction('voice')}
        onManual={() => runAction('manual')}
      />

      {ctx && (
        <ExpenseDrawer
          householdId={ctx.householdId}
          categories={ctx.categories}
          onSuccess={notifyTransactionsChanged}
          onVoiceOverlay={() => setVoiceOpen(true)}
        />
      )}

      {ctx && importActive && (
        <StatementImportFlow
          householdId={ctx.householdId}
          onDone={() => { setImportActive(false); notifyTransactionsChanged() }}
        />
      )}

      <VoiceOverlay
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onResult={(result) => { setVoiceResult(result); setVoiceOpen(false) }}
        onError={(err) => showMessage(err, 'error')}
      />

      <BottomSheet open={!!voiceResult} onClose={closeVoicePreview}>
        <div className="px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))] overflow-y-auto">
          <h2 tabIndex={-1} className="font-serif text-2xl text-ink-900 mb-3 outline-none">Revisa antes de guardar</h2>
          {voiceResult && (
            <TransactionPreview
              key={voiceResult.raw_text}
              result={voiceResult}
              onConfirm={saveVoiceTransactions}
              onCancel={closeVoicePreview}
            />
          )}
        </div>
      </BottomSheet>

      {message && (
        <div
          role={message.tone === 'error' ? 'alert' : 'status'}
          className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-6 left-4 right-4 z-[60] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div
            className={`px-4 py-3 rounded-2xl text-sm font-semibold ${
              message.tone === 'error' ? 'bg-danger-light text-danger-text' : 'bg-navy-darker text-white'
            }`}
            style={{ boxShadow: '0 10px 30px rgba(13,31,54,0.3)' }}
          >
            {message.text}
          </div>
        </div>
      )}
    </>
  )
}
