/** Transaction shape returned by /api/extract-statement. */
export interface ApiExtractedTx {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income'
  suggested_category: string
  category_id: string | null
  original_amount: number | null
  original_currency: string | null
}

export interface ExtractedTx extends ApiExtractedTx {
  /** 0-based position of the photo this transaction came from. */
  sourceImageIndex: number
}

export interface MergedTx extends ApiExtractedTx {
  key: string
  /** Every photo (0-based) where this transaction appeared, ascending. */
  sourceImageIndexes: number[]
  possibleBatchDuplicate: boolean
  /** Keys of the other merged transactions this one may duplicate. */
  possibleDuplicateOf: string[]
}

export interface MergedResult {
  transactions: MergedTx[]
  /** Transactions dropped because they were exact repeats across photos. */
  exactDuplicatesCollapsed: number
  /** Transactions flagged as a possible duplicate of one from another photo. */
  possibleDuplicateCount: number
}

export function normalizeDescription(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function cents(amount: number): number {
  return Math.round(amount * 100)
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>()
  const compact = s.replace(/\s+/g, '')
  for (let i = 0; i < compact.length - 1; i++) {
    const bg = compact.slice(i, i + 2)
    out.set(bg, (out.get(bg) ?? 0) + 1)
  }
  return out
}

/** Sørensen–Dice similarity over character bigrams, 0..1. */
export function descriptionSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const ba = bigrams(a)
  const bb = bigrams(b)
  let total = 0
  ba.forEach(n => { total += n })
  bb.forEach(n => { total += n })
  if (total === 0) return 0
  let overlap = 0
  ba.forEach((n, bg) => { overlap += Math.min(n, bb.get(bg) ?? 0) })
  return (2 * overlap) / total
}

const SIMILARITY_THRESHOLD = 0.6

function isSimilar(a: string, b: string): boolean {
  if (!a || !b) return false
  const compactA = a.replace(/\s+/g, '')
  const compactB = b.replace(/\s+/g, '')
  if (compactA.includes(compactB) || compactB.includes(compactA)) return true
  return descriptionSimilarity(a, b) >= SIMILARITY_THRESHOLD
}

/**
 * Consolidates per-photo extraction results into a single list.
 *
 * - Exact duplicates across photos (same date, amount, type and normalized
 *   description) collapse into one entry that records every source photo.
 *   Collapsing is multiset-aware: two identical purchases in the same photo
 *   stay as two entries, and a later photo repeating both maps onto them.
 * - Near duplicates (same date/amount/type, similar description) from
 *   different photos are kept and cross-flagged for the user to decide.
 * - Output is sorted by date descending.
 */
export function mergeBatchResults(results: ExtractedTx[][]): MergedResult {
  type Entry = MergedTx & { norm: string; order: number }
  const entries: Entry[] = []
  const byExactKey = new Map<string, Entry[]>()
  let exactDuplicatesCollapsed = 0

  results.forEach((photoTxs, photoPos) => {
    const seenInPhoto = new Map<string, number>()
    for (const tx of photoTxs) {
      const imageIndex = Number.isInteger(tx.sourceImageIndex) ? tx.sourceImageIndex : photoPos
      const norm = normalizeDescription(tx.description)
      const exactKey = `${tx.date}|${cents(tx.amount)}|${tx.type}|${norm}`
      const occurrence = seenInPhoto.get(exactKey) ?? 0
      seenInPhoto.set(exactKey, occurrence + 1)

      const bucket = byExactKey.get(exactKey) ?? []
      const target = bucket[occurrence]
      if (target && !target.sourceImageIndexes.includes(imageIndex)) {
        target.sourceImageIndexes.push(imageIndex)
        exactDuplicatesCollapsed++
        continue
      }

      const { sourceImageIndex: _ignored, ...rest } = tx
      void _ignored
      const entry: Entry = {
        ...rest,
        key: `p${imageIndex}-${entries.length}`,
        sourceImageIndexes: [imageIndex],
        possibleBatchDuplicate: false,
        possibleDuplicateOf: [],
        norm,
        order: entries.length,
      }
      entries.push(entry)
      bucket.push(entry)
      byExactKey.set(exactKey, bucket)
    }
  })

  // Near duplicates: compare only within the same date/amount/type group.
  const byLooseKey = new Map<string, Entry[]>()
  for (const e of entries) {
    const k = `${e.date}|${cents(e.amount)}|${e.type}`
    const group = byLooseKey.get(k) ?? []
    group.push(e)
    byLooseKey.set(k, group)
  }
  byLooseKey.forEach(group => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (a.norm === b.norm) continue
        // Entries sharing a photo are distinct lines of the same screenshot.
        if (a.sourceImageIndexes.some(ix => b.sourceImageIndexes.includes(ix))) continue
        if (!isSimilar(a.norm, b.norm)) continue
        a.possibleBatchDuplicate = true
        b.possibleBatchDuplicate = true
        a.possibleDuplicateOf.push(b.key)
        b.possibleDuplicateOf.push(a.key)
      }
    }
  })

  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return a.order - b.order
  })

  const transactions: MergedTx[] = entries.map(({ norm: _n, order: _o, ...tx }) => {
    void _n
    void _o
    return { ...tx, sourceImageIndexes: [...tx.sourceImageIndexes].sort((x, y) => x - y) }
  })

  return {
    transactions,
    exactDuplicatesCollapsed,
    possibleDuplicateCount: transactions.filter(t => t.possibleBatchDuplicate).length,
  }
}

/** "Foto 2", "Fotos 2 y 3", "Fotos 1, 2 y 3" (indexes are 0-based). */
export function sourceLabel(indexes: number[]): string {
  const n = indexes.map(i => i + 1)
  if (n.length === 0) return ''
  if (n.length === 1) return `Foto ${n[0]}`
  return `Fotos ${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
}
