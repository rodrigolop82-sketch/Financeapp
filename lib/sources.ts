import { createClient } from '@/lib/supabase'
import type { UserSource } from '@/types'

const KNOWN_BANKS: Record<string, string> = {
  banrural: 'Banrural',
  bam: 'BAM',
  industrial: 'Industrial',
  'banco industrial': 'Industrial',
  'g&t': 'G&T Continental',
  'g&t continental': 'G&T Continental',
  'gyt': 'G&T Continental',
  bantrab: 'Bantrab',
  bac: 'BAC',
  'bi': 'Industrial',
}

export function normalizeBankName(raw: string): string {
  const lower = raw.trim().toLowerCase()
  return KNOWN_BANKS[lower] ?? raw.trim()
}

export async function upsertDetectedSource(
  userId: string,
  bankDetected: string,
): Promise<void> {
  if (!bankDetected) return

  const bankName = normalizeBankName(bankDetected)
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('user_sources')
    .select('id')
    .eq('user_id', userId)
    .eq('bank_name', bankName)
    .limit(1)

  if (existing && existing.length > 0) return

  await supabase.from('user_sources').insert({
    user_id: userId,
    type: 'tarjeta_credito',
    bank_name: bankName,
    detection_method: 'auto',
  })
}

export async function getUserSources(userId: string): Promise<UserSource[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_sources')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true })

  return (data ?? []) as UserSource[]
}

export const GT_BANKS = [
  'Banrural',
  'BAM',
  'Industrial',
  'G&T Continental',
  'Bantrab',
  'BAC',
] as const
