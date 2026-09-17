import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditEventType =
  | 'login'
  | 'logout'
  | 'data_export'
  | 'account_deletion_requested'
  | 'password_changed'
  | 'email_changed'
  | 'mfa_enabled'
  | 'mfa_disabled'

export async function logAuditEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: AuditEventType,
  metadata?: Record<string, unknown>
) {
  const { error } = await supabase.from('audit_log').insert({
    user_id: userId,
    event_type: eventType,
    metadata: metadata ?? {},
  })

  if (error) {
    console.error('[audit_log] Failed to log event:', error.message)
  }
}
