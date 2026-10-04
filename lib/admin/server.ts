// Admin (fase 12), solo servidor: verificación de admin, cliente con service
// role y carga de los datos que usan las métricas. El service role se crea
// SOLO después de comprobar que quien llama es admin.
//
// Último acceso: auth.users.last_sign_in_at (admin API, paginado) combinado
// con el último movimiento del hogar (ver lastAccessMs en dataset.ts).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isAdminEmail } from './access';
import type { AdminTx, AdminUser } from './dataset';

export type AdminGuard =
  | { ok: true; admin: SupabaseClient; email: string }
  | { ok: false; response: NextResponse };

/** Sesión + lista de admins + service role. Úsalo al inicio de cada ruta /api/admin/*. */
export async function requireAdmin(): Promise<AdminGuard> {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) {
    return { ok: false, response: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) };
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('[admin] Falta SUPABASE_SERVICE_ROLE_KEY');
    return { ok: false, response: NextResponse.json({ error: 'Falta configurar el servidor.' }, { status: 503 }) };
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { ok: true, admin, email: user.email! };
}

const PAGE = 1000;
const MAX_ROWS = 500_000;

/** Lee todas las filas (PostgREST corta en 1000 por petición). */
async function fetchAll<T>(admin: SupabaseClient, table: string, columns: string): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

async function lastSignIns(admin: SupabaseClient): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) {
      console.warn('[admin] No se pudo leer auth.users', error.message);
      break;
    }
    const users = data?.users ?? [];
    for (const u of users) map.set(u.id, u.last_sign_in_at ?? null);
    if (users.length < PAGE) break;
  }
  return map;
}

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  marketing_opt_in?: boolean | null;
}

export async function loadUsers(admin: SupabaseClient): Promise<AdminUser[]> {
  const base = 'id, email, full_name, created_at, plan, trial_ends_at';
  let users = await fetchAll<UserRow>(admin, 'users', `${base}, marketing_opt_in`);
  if (users.error) {
    // Sin la migración 20261011 todavía: nadie tiene consentimiento.
    console.warn('[admin] users sin marketing_opt_in:', users.error);
    users = await fetchAll<UserRow>(admin, 'users', base);
  }
  const [members, households, signIns] = await Promise.all([
    fetchAll<{ user_id: string; household_id: string }>(admin, 'household_members', 'user_id, household_id'),
    fetchAll<{ id: string; owner_id: string | null }>(admin, 'households', 'id, owner_id'),
    lastSignIns(admin),
  ]);
  const hhOf = new Map<string, string>();
  for (const h of households.rows) if (h.owner_id) hhOf.set(h.owner_id, h.id);
  for (const m of members.rows) if (m.user_id && m.household_id) hhOf.set(m.user_id, m.household_id);

  return users.rows.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    fullName: u.full_name,
    createdAt: u.created_at ?? new Date(0).toISOString(),
    plan: u.plan,
    trialEndsAt: u.trial_ends_at,
    marketingOptIn: u.marketing_opt_in === true,
    lastSignInAt: signIns.get(u.id) ?? null,
    householdId: hhOf.get(u.id) ?? null,
  }));
}

/** Movimientos sin montos: solo hogar, fecha de creación, tipo y origen. */
export async function loadTxs(admin: SupabaseClient): Promise<AdminTx[]> {
  const { rows, error } = await fetchAll<{ household_id: string; created_at: string; type: string | null; source: string | null }>(
    admin,
    'transactions',
    'household_id, created_at, type, source',
  );
  if (error) console.error('[admin] Error al leer movimientos', error);
  return rows.map((t) => ({ householdId: t.household_id, createdAt: t.created_at, type: t.type, source: t.source }));
}

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}
