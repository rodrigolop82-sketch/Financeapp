import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the household for a user.
 * Priority: invited membership (role='member') FIRST, then owned household.
 * Owners are also in household_members with role='owner', so we must filter
 * by role='member' to find households they joined via invite.
 */
export async function getUserHousehold(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<{ id: string; owner_id: string; name: string; type: string; created_at: string } | null> {
  // 1. Check for an invited membership (role = 'member')
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('role', 'member')
    .limit(1)
    .single();

  if (membership) {
    const { data: hh } = await supabase
      .from('households')
      .select('*')
      .eq('id', membership.household_id)
      .single();
    if (hh) return hh;
  }

  // 2. Fall back to owned household (role = 'owner' in household_members)
  const { data: owned } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', userId)
    .limit(1)
    .single();

  return owned || null;
}
