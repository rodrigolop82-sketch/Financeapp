import { createClient } from '@/lib/supabase'

// Bancos de Guatemala y la cuenta que detecta una importación de estado de
// cuenta (Mis cuentas). La parte de decidir es pura, para vitest.

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

export const GT_BANKS = [
  'Banrural',
  'BAM',
  'Industrial',
  'G&T Continental',
  'Bantrab',
  'BAC',
] as const

export interface DetectedAccount {
  bank: string
  last4: string | null
  kind: 'credit_card' | 'bank_account'
}

interface ExistingRow { id: string; kind: string; institution: string | null; last4: string | null }

/**
 * ¿Qué hacer con la cuenta detectada? Si ya existe (mismo banco y mismos
 * últimos 4, o mismo banco y tipo sin últimos 4 guardados) no se duplica;
 * si le faltaban los últimos 4 se completan.
 */
export function detectedSourceAction(
  rows: ExistingRow[],
  d: DetectedAccount,
): { action: 'none' } | { action: 'fill_last4'; id: string } | { action: 'insert' } {
  const sameBank = rows.filter((r) => (r.institution ?? '').toLowerCase() === d.bank.toLowerCase())
  if (d.last4) {
    if (sameBank.some((r) => r.last4 === d.last4)) return { action: 'none' }
    const blank = sameBank.find((r) => !r.last4 && r.kind === d.kind)
    return blank ? { action: 'fill_last4', id: blank.id } : { action: 'insert' }
  }
  return sameBank.some((r) => r.kind === d.kind) ? { action: 'none' } : { action: 'insert' }
}

/** Nombre de una cuenta detectada: "Tarjeta •••• 4821" o el banco. */
export function detectedSourceName(d: DetectedAccount): string {
  if (!d.last4) return d.bank
  return `${d.kind === 'bank_account' ? 'Cuenta' : 'Tarjeta'} •••• ${d.last4}`
}

/** Agrega (o reconoce) la cuenta de un estado de cuenta importado. Best-effort. */
export async function upsertDetectedSource(
  householdId: string,
  input: { bank: string; last4: string | null; isAccount: boolean },
): Promise<void> {
  if (!input.bank || input.bank === 'Desconocido') return
  const d: DetectedAccount = {
    bank: normalizeBankName(input.bank),
    last4: input.last4,
    kind: input.isAccount ? 'bank_account' : 'credit_card',
  }
  const supabase = createClient()
  // RLS deja ver las propias y las compartidas del hogar.
  const { data: rows } = await supabase
    .from('financial_sources')
    .select('id, kind, institution, last4')
    .eq('household_id', householdId)
    .is('archived_at', null)

  const decision = detectedSourceAction((rows ?? []) as ExistingRow[], d)
  if (decision.action === 'fill_last4') {
    await supabase.from('financial_sources').update({ last4: d.last4 }).eq('id', decision.id)
  } else if (decision.action === 'insert') {
    await supabase.from('financial_sources').insert({
      household_id: householdId,
      kind: d.kind,
      name: detectedSourceName(d),
      institution: d.bank,
      last4: d.last4,
      detection_method: 'auto',
      tracks_statements: true,
      shared: false,
    })
  }
}
