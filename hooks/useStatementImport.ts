'use client'
import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { localToday } from '@/lib/dates'

export type ImportStep = 'idle' | 'upload' | 'processing' | 'review' | 'success'

export interface ExtractedTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  suggested_category: string
  category_id: string | null
  selected: boolean
  isDuplicate: boolean
  original_amount: number | null
  original_currency: string | null
}

export interface ImportStats {
  total: number
  imported: number
  duplicatesSkipped: number
  totalAmount: number
}

interface ImportState {
  step: ImportStep
  file: File | null
  filePreview: string | null
  bankDetected: string | null
  period: string | null
  transactions: ExtractedTransaction[]
  stats: ImportStats | null
  isLoading: boolean
  error: string | null
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function useStatementImport(householdId: string) {
  const [state, setState] = useState<ImportState>({
    step: 'idle',
    file: null,
    filePreview: null,
    bankDetected: null,
    period: null,
    transactions: [],
    stats: null,
    isLoading: false,
    error: null,
  })

  // Use refs to avoid stale closures
  const fileRef = useRef<File | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const startImport = useCallback(() => {
    fileRef.current = null
    setState(s => ({ ...s, step: 'upload', error: null, file: null, filePreview: null }))
  }, [])

  const closeImport = useCallback(() => {
    fileRef.current = null
    setState({
      step: 'idle', file: null, filePreview: null, bankDetected: null,
      period: null, transactions: [], stats: null, isLoading: false, error: null,
    })
  }, [])

  const setFile = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setState(s => ({ ...s, error: 'El archivo es muy grande. Máximo 10MB.' }))
      return
    }
    fileRef.current = file
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setState(s => ({ ...s, file, filePreview: preview, error: null }))
  }, [])

  const processFile = useCallback(async () => {
    const file = fileRef.current
    if (!file) return
    setState(s => ({ ...s, step: 'processing', isLoading: true, error: null }))

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/extract-statement', { method: 'POST', body: formData })

      if (!res.ok) {
        let errorMsg = 'Error al procesar el archivo'
        try {
          const errData = await res.json()
          errorMsg = errData.error || errorMsg
        } catch {
          // response wasn't JSON
        }
        setState(s => ({
          ...s,
          isLoading: false,
          error: errorMsg,
          step: 'upload',
        }))
        return
      }

      const data = await res.json()

      const rawTx = (data.transactions || []) as Array<{
        date: string
        description: string
        amount: number
        type: 'expense' | 'income'
        suggested_category: string
        category_id: string | null
        original_amount: number | null
        original_currency: string | null
      }>

      // Detect duplicates
      const supabase = createClient()
      const transactions: ExtractedTransaction[] = []

      for (const tx of rawTx) {
        const txDate = new Date(tx.date + 'T12:00:00')
        const dayBefore = new Date(txDate.getTime() - 86400000).toISOString().split('T')[0]
        const dayAfter = new Date(txDate.getTime() + 86400000).toISOString().split('T')[0]

        const { data: dupes } = await supabase
          .from('transactions')
          .select('id')
          .eq('household_id', householdId)
          .eq('amount', tx.amount)
          .gte('date', dayBefore)
          .lte('date', dayAfter)
          .limit(1)

        const isDuplicate = (dupes?.length ?? 0) > 0

        transactions.push({
          id: genId(),
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          suggested_category: tx.suggested_category,
          category_id: tx.category_id ?? null,
          selected: !isDuplicate,
          isDuplicate,
          original_amount: tx.original_amount ?? null,
          original_currency: tx.original_currency ?? null,
        })
      }

      setState(s => ({
        ...s,
        step: 'review',
        isLoading: false,
        bankDetected: data.bank || null,
        period: data.period || null,
        transactions,
      }))
    } catch (err) {
      console.error('Statement import error:', err)
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'Error de conexión. Intenta de nuevo.',
        step: 'upload',
      }))
    }
  }, [householdId])

  const toggleTransaction = useCallback((id: string) => {
    setState(s => ({
      ...s,
      transactions: s.transactions.map(t =>
        t.id === id ? { ...t, selected: !t.selected } : t
      ),
    }))
  }, [])

  const confirmImport = useCallback(async () => {
    const current = stateRef.current
    const selected = current.transactions.filter(t => t.selected)
    if (selected.length === 0) return

    setState(s => ({ ...s, isLoading: true, error: null }))
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setState(s => ({ ...s, isLoading: false, error: 'Sesión expirada. Iniciá sesión de nuevo.' }))
      return
    }

    const rows = selected.map(t => ({
      household_id: householdId,
      amount: t.amount,
      description: t.description,
      category_id: t.category_id || null,
      date: t.date || localToday(),
      source: 'csv' as const,
      created_by: user.id,
      original_amount: t.original_amount,
      original_currency: t.original_currency,
    }))

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert(rows)
      .select('id')

    if (error) {
      console.error('Transaction insert error:', error)
      setState(s => ({ ...s, isLoading: false, error: `Error al guardar: ${error.message}` }))
      return
    }

    if (!inserted || inserted.length === 0) {
      console.error('Insert returned no rows — RLS may be blocking')
      setState(s => ({ ...s, isLoading: false, error: 'No se pudieron guardar las transacciones. Verificá permisos.' }))
      return
    }

    // Log import audit (best-effort, don't block on failure)
    try {
      await supabase.from('statement_imports').insert({
        user_id: user.id,
        household_id: householdId,
        bank_detected: current.bankDetected,
        file_type: fileRef.current?.type === 'application/pdf' ? 'pdf' : 'image',
        transactions_found: current.transactions.length,
        transactions_imported: selected.length,
        duplicates_detected: current.transactions.filter(t => t.isDuplicate).length,
        status: 'completed',
      })
    } catch (auditErr) {
      console.warn('Failed to log import audit:', auditErr)
    }

    const totalAmount = selected
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    setState(s => ({
      ...s,
      step: 'success',
      isLoading: false,
      stats: {
        total: current.transactions.length,
        imported: inserted.length,
        duplicatesSkipped: current.transactions.filter(t => t.isDuplicate && !t.selected).length,
        totalAmount,
      },
    }))
  }, [householdId])

  return {
    ...state,
    startImport,
    closeImport,
    setFile,
    processFile,
    toggleTransaction,
    confirmImport,
  }
}
