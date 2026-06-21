import { createClient } from '@/lib/supabase'
import { normalizeMerchantName } from '@/lib/merchant-normalization'

type CategorizationResult = {
  category: string
  source: 'override' | 'rules' | 'ai'
} | null

export async function categorizeTransaction(
  merchant: string,
  categories: { id: string; name: string }[],
  keywordRules?: Record<string, string[]>
): Promise<CategorizationResult> {
  const normalized = normalizeMerchantName(merchant)
  if (!normalized) return null

  const supabase = createClient()
  const { data: override } = await supabase
    .from('merchant_category_overrides')
    .select('category')
    .eq('merchant_normalized', normalized)
    .single()

  if (override) {
    const match = categories.find(
      c => c.name.toLowerCase() === override.category.toLowerCase()
    )
    if (match) return { category: match.id, source: 'override' }
  }

  if (keywordRules) {
    const lower = merchant.toLowerCase()
    for (const [catKeyword, keywords] of Object.entries(keywordRules)) {
      if (keywords.some(k => lower.includes(k))) {
        const match = categories.find(c =>
          c.name.toLowerCase().includes(catKeyword)
        )
        if (match) return { category: match.id, source: 'rules' }
      }
    }
  }

  return null
}

export async function saveMerchantOverride(
  merchantRaw: string,
  categoryName: string,
  userId: string
): Promise<void> {
  const normalized = normalizeMerchantName(merchantRaw)
  if (!normalized) return

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('merchant_category_overrides')
    .select('id, category, times_confirmed')
    .eq('merchant_normalized', normalized)
    .single()

  if (existing) {
    const sameCategory = existing.category.toLowerCase() === categoryName.toLowerCase()
    await supabase
      .from('merchant_category_overrides')
      .update({
        category: categoryName,
        times_confirmed: sameCategory ? existing.times_confirmed + 1 : 1,
        last_corrected_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('merchant_category_overrides')
      .insert({
        merchant_normalized: normalized,
        category: categoryName,
        source: 'user_correction',
        times_confirmed: 1,
        last_corrected_by: userId,
      })
  }
}

export async function categorizeTransactionServer(
  merchant: string,
  categories: { id: string; name: string }[],
  supabase: ReturnType<typeof createClient>
): Promise<CategorizationResult> {
  const normalized = normalizeMerchantName(merchant)
  if (!normalized) return null

  const { data: override } = await supabase
    .from('merchant_category_overrides')
    .select('category')
    .eq('merchant_normalized', normalized)
    .single()

  if (override) {
    const match = categories.find(
      c => c.name.toLowerCase() === override.category.toLowerCase()
    )
    if (match) return { category: match.id, source: 'override' }
  }

  return null
}
