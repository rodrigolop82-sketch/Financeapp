import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the household for a user — first checking if they own one,
 * then falling back to checking household_members (family mode).
 */
export async function getUserHousehold(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<{ id: string; owner_id: string; name: string; type: string; created_at: string } | null> {
  // 1. Try as owner
  const { data: owned } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', userId)
    .limit(1)
    .single();

  if (owned) return owned;

  // 2. Fall back to household_members (user joined via invite)
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!membership) return null;

  const { data: hh } = await supabase
    .from('households')
    .select('*')
    .eq('id', membership.household_id)
    .single();

  return hh || null;
}
