import { SupabaseClient } from '@supabase/supabase-js';

type Household = { id: string; owner_id: string; name: string; type: string; created_at: string };

/**
 * Returns the household for a user (un solo hogar activo).
 * Priority: invited membership (role='member') FIRST, then owned household.
 * Owners are also in household_members with role='owner', so we must filter
 * by role='member' to find households they joined via invite.
 * Los hogares archivados (el del invitado después de unir cuentas) no cuentan.
 * Las dos consultas van en paralelo: cada pantalla espera por esto antes de
 * cargar sus datos, y en fila sumaban dos o tres viajes a la base.
 */
export async function getUserHousehold(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<Household | null> {
  const [{ data: memberships }, { data: owned }] = await Promise.all([
    // 1. Invited memberships (role = 'member'), con su hogar embebido
    supabase
      .from('household_members')
      .select('household_id, households(*)')
      .eq('user_id', userId)
      .eq('role', 'member'),
    // 2. Fallback: owned household (role = 'owner' in household_members)
    supabase
      .from('households')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  type Embedded = Household & { archived_at?: string | null };
  for (const m of memberships ?? []) {
    // Sin tipos generados, el cliente lo tipa como arreglo; PostgREST devuelve
    // un objeto porque cada membresía apunta a un solo hogar.
    const embedded = m.households as unknown as Embedded | Embedded[] | null;
    const hh = Array.isArray(embedded) ? embedded[0] : embedded;
    if (hh && !hh.archived_at) return hh;
  }

  return (owned ?? []).find((h: { archived_at?: string | null }) => !h.archived_at) ?? null;
}
