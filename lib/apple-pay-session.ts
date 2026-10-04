// Sesión + service role para /api/shortcut-tokens (solo servidor). El
// service role solo se crea después de comprobar la sesión, y cada consulta
// filtra por el user_id de la sesión (nunca por ids del cliente).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export type TokenGuard =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: NextResponse };

export async function requireUserForTokens(): Promise<TokenGuard> {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('[apple-pay] Falta SUPABASE_SERVICE_ROLE_KEY');
    return { ok: false, response: NextResponse.json({ error: 'Falta configurar el servidor.' }, { status: 503 }) };
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { ok: true, userId: user.id, admin };
}

/** Columnas que ve el cliente (nunca token_hash). */
export const PUBLIC_TOKEN_COLUMNS = 'id, created_at, last_used_at, revoked_at';
