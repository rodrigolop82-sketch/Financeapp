import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the household for a user (un solo hogar activo).
 * Priority: invited membership (role='member') FIRST, then owned household.
 * Owners are also in household_members with role='owner', so we must filter
 * by role='member' to find households they joined via invite.
 * Los hogares archivados (el del invitado después de unir cuentas) no cuentan.
 */
export async function getUserHousehold(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<{ id: string; owner_id: string; name: string; type: string; created_at: string } | null> {
  // 1. Check for an invited membership (role = 'member')
  const { data: memberships } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('role', 'member');

  for (const m of memberships ?? []) {
    const { data: hh } = await supabase
      .from('households')
      .select('*')
      .eq('id', m.household_id)
      .maybeSingle();
    if (hh && !hh.archived_at) return hh;
  }

  // 2. Fall back to owned household (role = 'owner' in household_members)
  const { data: owned } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });

  return (owned ?? []).find((h: { archived_at?: string | null }) => !h.archived_at) ?? null;
}
