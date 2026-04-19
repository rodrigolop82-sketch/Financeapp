import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the household for a user.
 * Priority: invited membership (household_members) FIRST, then owned household.
 * This ensures that when a user accepts a family invite, they use the shared
 * household instead of the one they created during their own onboarding.
 */
export async function getUserHousehold(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<{ id: string; owner_id: string; name: string; type: string; created_at: string } | null> {
  // 1. Check household_members first (user joined via invite)
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
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

  // 2. Fall back to owned household
  const { data: owned } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', userId)
    .limit(1)
    .single();

  return owned || null;
}
