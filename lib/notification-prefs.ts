// Lectura y guardado de notification_preferences desde el navegador
// (Mi cuenta › Recordatorios y la hoja de avisos). Si todavía no se aplicó
// la migración 20261012 (due/cap/income), se guarda lo demás igual.
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export const NEW_PREF_COLUMNS = ['due_enabled', 'cap_enabled', 'income_enabled'] as const;

export async function saveNotificationPrefs(
  supabase: Client,
  userId: string,
  prefs: Record<string, boolean | number>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('notification_preferences').upsert({ user_id: userId, ...prefs });
  if (!error) return { error: null };
  // Columnas nuevas sin migrar: se reintenta sin ellas.
  const legacy = Object.fromEntries(
    Object.entries(prefs).filter(([k]) => !(NEW_PREF_COLUMNS as readonly string[]).includes(k)),
  );
  if (Object.keys(legacy).length === Object.keys(prefs).length) return { error: error.message };
  const retry = await supabase.from('notification_preferences').upsert({ user_id: userId, ...legacy });
  return { error: retry.error?.message ?? null };
}
