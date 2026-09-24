import { createClient } from '@supabase/supabase-js'
import { checkAndIncrement, rollbackIncrement } from '@/lib/usage'
import { BATCH_WINDOW_MINUTES, MAX_IMPORT_IMAGES } from './constants'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidBatchId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export type BatchClaim =
  | { ok: true }
  | { ok: false; kind: 'limit'; used: number; limit: number | null; resetsAt: string }
  | { ok: false; kind: 'rejected'; message: string }

const REJECT_MESSAGES: Record<string, string> = {
  full: `Máximo ${MAX_IMPORT_IMAGES} fotos por importación.`,
  expired: 'Esta importación expiró. Vuelve a empezar para analizar más fotos.',
  closed: 'Esta importación ya fue guardada. Inicia una nueva para analizar más fotos.',
  pending: 'Estamos verificando tu plan. Intenta de nuevo en unos segundos.',
}

const PENDING_RETRY_MS = 250
const PENDING_MAX_ATTEMPTS = 40

/**
 * Reserves a photo slot in a multi-photo batch. The first photo of a batch
 * counts one monthly import; the rest of the batch rides on it.
 */
export async function claimBatchImage(userId: string, householdId: string, batchId: string): Promise<BatchClaim> {
  const supabase = getServiceSupabase()

  for (let attempt = 0; attempt < PENDING_MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.rpc('claim_import_batch_image', {
      p_user_id: userId,
      p_household_id: householdId,
      p_batch_id: batchId,
      p_max_images: MAX_IMPORT_IMAGES,
      p_window_minutes: BATCH_WINDOW_MINUTES,
    })
    if (error) throw new Error(`Batch claim failed: ${error.message}`)

    const res = data as { ok: boolean; needs_usage?: boolean; reason?: string }
    if (!res.ok) {
      // Another photo of this batch is checking the plan limit; wait for it.
      if (res.reason === 'pending') {
        await new Promise(r => setTimeout(r, PENDING_RETRY_MS))
        continue
      }
      return { ok: false, kind: 'rejected', message: REJECT_MESSAGES[res.reason ?? ''] ?? REJECT_MESSAGES.closed }
    }

    if (!res.needs_usage) return { ok: true }

    let usage: Awaited<ReturnType<typeof checkAndIncrement>>
    try {
      usage = await checkAndIncrement(userId, 'statement_import')
    } catch (err) {
      await supabase.rpc('settle_import_batch_usage', { p_user_id: userId, p_batch_id: batchId, p_counted: false })
      throw err
    }
    await supabase.rpc('settle_import_batch_usage', { p_user_id: userId, p_batch_id: batchId, p_counted: usage.allowed })
    if (!usage.allowed) {
      return { ok: false, kind: 'limit', used: usage.used, limit: usage.limit, resetsAt: usage.resetsAt }
    }
    return { ok: true }
  }

  return { ok: false, kind: 'rejected', message: REJECT_MESSAGES.pending }
}

/** Frees the slot of a photo whose extraction failed; refunds the import if the batch has no photos left. */
export async function releaseBatchImage(userId: string, batchId: string): Promise<void> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.rpc('release_import_batch_image', {
    p_user_id: userId,
    p_batch_id: batchId,
  })
  if (error) {
    console.error('Batch release failed:', error.message)
    return
  }
  if ((data as { rollback_usage?: boolean })?.rollback_usage) {
    await rollbackIncrement(userId, 'statement_import')
  }
}
