'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { localToday } from '@/lib/dates'
import { upsertDetectedSource } from '@/lib/sources'
import { compressImage, ImageDecodeError, IMAGE_DECODE_ERROR_MESSAGE } from '@/lib/import/image-compress'
import { mergeBatchResults, type ApiExtractedTx, type ExtractedTx } from '@/lib/import/batch-merge'
import { findDbDuplicates } from '@/lib/import/db-duplicates'
import { IMPORT_CONCURRENCY, MAX_IMPORT_IMAGES } from '@/lib/import/constants'

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
  /** Multi-photo imports only: 0-based photos this transaction was read from. */
  sourceImages?: number[]
  /** Multi-photo imports only: looks like a transaction from another photo. */
  possibleBatchDuplicate?: boolean
  /** Ids of the transactions this one may duplicate. */
  possibleDuplicateOf?: string[]
}

export interface ImportStats {
  total: number
  imported: number
  duplicatesSkipped: number
  totalAmount: number
}

export type PhotoStatus = 'queued' | 'analyzing' | 'done' | 'error'

export interface ImportPhoto {
  id: string
  file: File
  previewUrl: string
  status: PhotoStatus
  txCount: number | null
  error: string | null
}

export interface BatchSummary {
  photoCount: number
  exactDuplicatesCollapsed: number
}

interface ImportState {
  step: ImportStep
  /** Which source is being processed/reviewed. */
  importMode: 'pdf' | 'photos' | null
  file: File | null
  filePreview: string | null
  photos: ImportPhoto[]
  photoNotice: string | null
  batch: BatchSummary | null
  bankDetected: string | null
  period: string | null
  transactions: ExtractedTransaction[]
  stats: ImportStats | null
  isLoading: boolean
  error: string | null
  limitReached: boolean
  limitData: { used: number; limit: number; resetsAt: string } | null
  importUsage: { used: number; limit: number } | null
}

type PhotoResult = { bank: string | null; transactions: ApiExtractedTx[] }

const REQUEST_TIMEOUT_MS = 120000

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function genBatchId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // RFC 4122 v4 fallback for older WebViews.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>()
  for (const v of values) if (v && v !== 'Desconocido') counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: string | null = null
  let bestN = 0
  counts.forEach((n, v) => { if (n > bestN) { best = v; bestN = n } })
  return best ?? values.find(v => !!v) ?? null
}

const EMPTY_STATE: ImportState = {
  step: 'idle',
  importMode: null,
  file: null,
  filePreview: null,
  photos: [],
  photoNotice: null,
  batch: null,
  bankDetected: null,
  period: null,
  transactions: [],
  stats: null,
  isLoading: false,
  error: null,
  limitReached: false,
  limitData: null,
  importUsage: null,
}

export function useStatementImport(householdId: string) {
  const [state, setState] = useState<ImportState>(EMPTY_STATE)

  // Use refs to avoid stale closures
  const fileRef = useRef<File | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Multi-photo batch bookkeeping
  const photosRef = useRef<ImportPhoto[]>([])
  photosRef.current = state.photos
  const resultsRef = useRef(new Map<string, PhotoResult>())
  const batchIdRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const finalizingRef = useRef(false)

  const abortBatch = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const revokeAll = useCallback((photos: ImportPhoto[]) => {
    photos.forEach(p => URL.revokeObjectURL(p.previewUrl))
  }, [])

  // Leaving the flow must not leave requests hanging or blob URLs alive.
  useEffect(() => () => {
    abortRef.current?.abort()
    photosRef.current.forEach(p => URL.revokeObjectURL(p.previewUrl))
  }, [])

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/usage')
      if (res.ok) {
        const data = await res.json()
        if (data.plan === 'free') {
          setState(s => ({
            ...s,
            limitReached: data.imports.remaining === 0,
            limitData: data.imports.remaining === 0
              ? { used: data.imports.used, limit: data.imports.limit, resetsAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString() }
              : null,
            importUsage: { used: data.imports.used, limit: data.imports.limit },
          }))
        }
      }
    } catch { /* best effort */ }
  }, [])

  const resetBatch = useCallback(() => {
    abortBatch()
    resultsRef.current.clear()
    batchIdRef.current = null
    finalizingRef.current = false
  }, [abortBatch])

  const startImport = useCallback(() => {
    fileRef.current = null
    resetBatch()
    revokeAll(photosRef.current)
    setState(s => ({
      ...s, step: 'upload', importMode: null, error: null, file: null, filePreview: null,
      photos: [], photoNotice: null, batch: null,
    }))
    fetchUsage()
  }, [fetchUsage, resetBatch, revokeAll])

  const closeImport = useCallback(() => {
    fileRef.current = null
    resetBatch()
    revokeAll(photosRef.current)
    setState(EMPTY_STATE)
  }, [resetBatch, revokeAll])

  const setFile = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setState(s => ({ ...s, error: 'El archivo es muy grande. Máximo 10MB.' }))
      return
    }
    fileRef.current = file
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setState(s => ({ ...s, file, filePreview: preview, error: null }))
  }, [])

  // ─── Multi-photo selection ─────────────────────────────────────────

  const addPhotos = useCallback((files: File[]) => {
    const current = photosRef.current
    const room = Math.max(0, MAX_IMPORT_IMAGES - current.length)
    const accepted = files.slice(0, room)
    const skipped = files.length - accepted.length

    const added: ImportPhoto[] = accepted.map(file => ({
      id: genId(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
      txCount: null,
      error: null,
    }))

    const notice = skipped > 0
      ? `Máximo ${MAX_IMPORT_IMAGES} fotos por importación. Se omitieron ${skipped} foto${skipped === 1 ? '' : 's'}.`
      : null

    setState(s => ({ ...s, photos: [...s.photos, ...added], photoNotice: notice, error: null }))
  }, [])

  const removePhoto = useCallback((id: string) => {
    const photo = photosRef.current.find(p => p.id === id)
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    resultsRef.current.delete(id)
    setState(s => ({ ...s, photos: s.photos.filter(p => p.id !== id), photoNotice: null }))
  }, [])

  // ─── Multi-photo processing ────────────────────────────────────────

  const updatePhoto = useCallback((id: string, patch: Partial<ImportPhoto>) => {
    setState(s => ({ ...s, photos: s.photos.map(p => (p.id === id ? { ...p, ...patch } : p)) }))
  }, [])

  const analyzePhoto = useCallback(async (id: string, batchId: string, signal: AbortSignal) => {
    const photo = photosRef.current.find(p => p.id === id)
    if (!photo || signal.aborted) return
    const stale = () => signal.aborted || batchIdRef.current !== batchId

    updatePhoto(id, { status: 'analyzing', error: null, txCount: null })

    let blob: Blob
    try {
      blob = await compressImage(photo.file)
    } catch (err) {
      if (stale()) return
      updatePhoto(id, {
        status: 'error',
        error: err instanceof ImageDecodeError ? err.message : IMAGE_DECODE_ERROR_MESSAGE,
      })
      return
    }
    if (stale()) return

    const position = photosRef.current.findIndex(p => p.id === id)
    const formData = new FormData()
    formData.append('file', blob, `foto-${position + 1}.jpg`)
    formData.append('batchId', batchId)

    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal.addEventListener('abort', onAbort)
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; controller.abort() }, REQUEST_TIMEOUT_MS)

    try {
      let res: Response
      try {
        res = await fetch('/api/extract-statement', { method: 'POST', body: formData, signal: controller.signal })
      } catch {
        if (stale()) return
        updatePhoto(id, {
          status: 'error',
          error: timedOut
            ? 'El análisis tardó demasiado. Intenta con una foto más clara.'
            : 'Error de conexión. Revisa tu internet e inténtalo de nuevo.',
        })
        return
      }
      if (stale()) return

      if (res.status === 402) {
        const errData = await res.json().catch(() => ({}))
        // Free plan exhausted: stop the whole batch.
        abortBatch()
        batchIdRef.current = null
        setState(s => ({
          ...s,
          isLoading: false,
          limitReached: true,
          limitData: { used: errData.used, limit: errData.limit, resetsAt: errData.resetsAt },
          step: 'upload',
          photos: s.photos.map(p => ({ ...p, status: 'queued', txCount: null, error: null })),
        }))
        return
      }

      if (!res.ok) {
        let errorMsg = 'Error al procesar la foto'
        try {
          const errData = await res.json()
          errorMsg = errData.error || errorMsg
        } catch {
          // response wasn't JSON
        }
        if (stale()) return
        updatePhoto(id, { status: 'error', error: errorMsg })
        return
      }

      const data = await res.json()
      if (stale()) return
      const transactions = (data.transactions || []) as ApiExtractedTx[]
      resultsRef.current.set(id, { bank: data.bank || null, transactions })
      updatePhoto(id, { status: 'done', txCount: transactions.length, error: null })
    } catch {
      if (stale()) return
      updatePhoto(id, { status: 'error', error: 'Error al procesar la foto' })
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', onAbort)
    }
  }, [abortBatch, updatePhoto])

  const runQueue = useCallback(async (ids: string[], batchId: string, signal: AbortSignal) => {
    let next = 0
    const worker = async () => {
      while (next < ids.length && !signal.aborted) {
        const id = ids[next++]
        await analyzePhoto(id, batchId, signal)
      }
    }
    await Promise.all(Array.from({ length: Math.min(IMPORT_CONCURRENCY, ids.length) }, worker))
  }, [analyzePhoto])

  const processPhotos = useCallback(() => {
    const photos = photosRef.current
    if (photos.length === 0) return

    resetBatch()
    const batchId = genBatchId()
    const controller = new AbortController()
    batchIdRef.current = batchId
    abortRef.current = controller

    setState(s => ({
      ...s,
      step: 'processing',
      importMode: 'photos',
      isLoading: true,
      error: null,
      photoNotice: null,
      photos: s.photos.map(p => ({ ...p, status: 'queued', txCount: null, error: null })),
    }))

    // The free-plan monthly limit is counted once per batchId server-side
    // (lib/import/batch-gating.ts), not once per photo.
    runQueue(photos.map(p => p.id), batchId, controller.signal)
  }, [resetBatch, runQueue])

  const retryPhoto = useCallback((id: string) => {
    const batchId = batchIdRef.current
    if (!batchId) return
    if (!abortRef.current || abortRef.current.signal.aborted) abortRef.current = new AbortController()
    finalizingRef.current = false
    analyzePhoto(id, batchId, abortRef.current.signal)
  }, [analyzePhoto])

  /** Cancels pending requests and returns to the selection screen. Nothing is saved. */
  const cancelProcessing = useCallback(() => {
    resetBatch()
    setState(s => ({
      ...s,
      step: 'upload',
      importMode: null,
      isLoading: false,
      photos: s.photos.map(p => ({ ...p, status: 'queued', txCount: null, error: null })),
    }))
  }, [resetBatch])

  /** Merges finished photos, flags DB duplicates and moves to review. */
  const finalizePhotos = useCallback(async () => {
    if (finalizingRef.current) return
    finalizingRef.current = true
    const batchId = batchIdRef.current

    const photos = photosRef.current
    const perPhoto: ExtractedTx[][] = []
    const banks: (string | null)[] = []
    photos.forEach((p, index) => {
      const result = p.status === 'done' ? resultsRef.current.get(p.id) : undefined
      if (!result) return
      banks.push(result.bank)
      perPhoto.push(result.transactions.map(tx => ({ ...tx, sourceImageIndex: index })))
    })

    setState(s => ({ ...s, isLoading: true }))

    try {
      const merged = mergeBatchResults(perPhoto)
      const supabase = createClient()
      const dupFlags = await findDbDuplicates(supabase, householdId, merged.transactions)
      if (batchIdRef.current !== batchId) return

      const idByKey = new Map(merged.transactions.map(t => [t.key, genId()]))
      const transactions: ExtractedTransaction[] = merged.transactions.map((tx, i) => ({
        id: idByKey.get(tx.key)!,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        suggested_category: tx.suggested_category,
        category_id: tx.category_id ?? null,
        selected: !dupFlags[i],
        isDuplicate: dupFlags[i],
        original_amount: tx.original_amount ?? null,
        original_currency: tx.original_currency ?? null,
        sourceImages: tx.sourceImageIndexes,
        possibleBatchDuplicate: tx.possibleBatchDuplicate,
        possibleDuplicateOf: tx.possibleDuplicateOf.map(k => idByKey.get(k)!),
      }))

      setState(s => ({
        ...s,
        step: 'review',
        isLoading: false,
        bankDetected: mostCommon(banks),
        period: null,
        transactions,
        batch: { photoCount: perPhoto.length, exactDuplicatesCollapsed: merged.exactDuplicatesCollapsed },
      }))
    } catch (err) {
      console.error('Batch finalize error:', err)
      finalizingRef.current = false
      if (batchIdRef.current !== batchId) return
      setState(s => ({ ...s, isLoading: false, error: 'Error al preparar la revisión. Inténtalo de nuevo.' }))
    }
  }, [householdId])

  // Advance automatically once every photo has settled without errors.
  useEffect(() => {
    if (state.step !== 'processing' || state.importMode !== 'photos') return
    const photos = state.photos
    if (photos.length === 0) {
      resetBatch()
      setState(s => ({ ...s, step: 'upload', importMode: null, isLoading: false }))
      return
    }
    if (photos.some(p => p.status === 'queued' || p.status === 'analyzing')) return

    const failed = photos.filter(p => p.status === 'error')
    if (failed.length === 0) {
      finalizePhotos()
      return
    }
    if (photos.length === 1) {
      // Single photo: same behaviour as before — back to upload with the error.
      resetBatch()
      setState(s => ({
        ...s,
        step: 'upload',
        importMode: null,
        isLoading: false,
        error: failed[0].error,
        photos: s.photos.map(p => ({ ...p, status: 'queued', txCount: null, error: null })),
      }))
      return
    }
    setState(s => (s.isLoading ? { ...s, isLoading: false } : s))
  }, [state.step, state.importMode, state.photos, finalizePhotos, resetBatch])

  // ─── PDF (single file) processing ──────────────────────────────────

  const processFile = useCallback(async () => {
    const file = fileRef.current
    if (!file) return
    setState(s => ({ ...s, step: 'processing', importMode: 'pdf', batch: null, isLoading: true, error: null }))

    try {
      const formData = new FormData()
      formData.append('file', file)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      let res: Response
      try {
        res = await fetch('/api/extract-statement', { method: 'POST', body: formData, signal: controller.signal })
      } catch (fetchErr) {
        clearTimeout(timeout)
        const isAbort = fetchErr instanceof DOMException && fetchErr.name === 'AbortError'
        setState(s => ({
          ...s,
          isLoading: false,
          error: isAbort
            ? 'El analisis tardo demasiado. Intenta con una foto mas clara o un PDF mas corto.'
            : 'Error de conexion. Revisa tu internet e intentalo de nuevo.',
          step: 'upload',
        }))
        return
      }
      clearTimeout(timeout)

      if (res.status === 402) {
        const errData = await res.json()
        setState(s => ({
          ...s,
          isLoading: false,
          limitReached: true,
          limitData: { used: errData.used, limit: errData.limit, resetsAt: errData.resetsAt },
          step: 'upload',
        }))
        return
      }

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

      const rawTx = (data.transactions || []) as ApiExtractedTx[]

      // Detect duplicates
      const supabase = createClient()
      const dupFlags = await findDbDuplicates(supabase, householdId, rawTx)

      const transactions: ExtractedTransaction[] = rawTx.map((tx, i) => ({
        id: genId(),
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        suggested_category: tx.suggested_category,
        category_id: tx.category_id ?? null,
        selected: !dupFlags[i],
        isDuplicate: dupFlags[i],
        original_amount: tx.original_amount ?? null,
        original_currency: tx.original_currency ?? null,
      }))

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
        error: 'Error de conexion. Revisa tu internet e intentalo de nuevo.',
        step: 'upload',
      }))
    }
  }, [householdId])

  // ─── Review ────────────────────────────────────────────────────────

  const toggleTransaction = useCallback((id: string) => {
    setState(s => ({
      ...s,
      transactions: s.transactions.map(t =>
        t.id === id ? { ...t, selected: !t.selected } : t
      ),
    }))
  }, [])

  const deselectTransaction = useCallback((id: string) => {
    setState(s => ({
      ...s,
      transactions: s.transactions.map(t => (t.id === id ? { ...t, selected: false } : t)),
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

    const bankLabel = current.bankDetected ? ` [${current.bankDetected}]` : ''

    const rows = selected.map(t => ({
      household_id: householdId,
      amount: t.amount,
      description: t.description + bankLabel,
      category_id: t.category_id || null,
      date: t.date || localToday(),
      source: 'csv' as const,
      type: 'expense' as const,
      payment_method: 'tarjeta' as const,
      created_by: user.id,
    }))

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert(rows)
      .select('id')

    if (error) {
      console.error('Transaction insert error:', error)
      setState(s => ({ ...s, isLoading: false, error: 'Error al guardar las transacciones. Intentalo de nuevo.' }))
      return
    }

    if (!inserted || inserted.length === 0) {
      console.error('Insert returned no rows — RLS may be blocking')
      setState(s => ({ ...s, isLoading: false, error: 'No se pudieron guardar las transacciones. Verificá permisos.' }))
      return
    }

    // Log import audit (best-effort, don't block on failure)
    const summary = {
      bank_detected: current.bankDetected,
      transactions_found: current.transactions.length,
      transactions_imported: selected.length,
      duplicates_detected: current.transactions.filter(t => t.isDuplicate).length,
      status: 'completed',
    }
    try {
      const batchId = current.importMode === 'photos' ? batchIdRef.current : null
      if (batchId) {
        // The batch row was created server-side when the first photo was analyzed.
        await supabase.from('statement_imports').update(summary).eq('batch_id', batchId)
      } else {
        await supabase.from('statement_imports').insert({
          user_id: user.id,
          household_id: householdId,
          file_type: fileRef.current?.type === 'application/pdf' ? 'pdf' : 'image',
          ...summary,
        })
      }
    } catch (auditErr) {
      console.warn('Failed to log import audit:', auditErr)
    }

    // Auto-detect source (best-effort, never blocks)
    if (current.bankDetected) {
      upsertDetectedSource(user.id, current.bankDetected).catch(() => {})
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
    addPhotos,
    removePhoto,
    processPhotos,
    retryPhoto,
    cancelProcessing,
    finalizePhotos,
    toggleTransaction,
    deselectTransaction,
    confirmImport,
  }
}
