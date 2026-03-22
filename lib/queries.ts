import { SupabaseClient } from '@supabase/supabase-js';

export async function getUserDashboardData(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get user profile
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get household (owner)
  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1)
    .single();

  if (!household) return { user: userProfile, household: null };

  // Parallel queries for household data
  const [
    { data: financialProfile },
    { data: categories },
    { data: debts },
    { data: actionPlan },
    { data: snapshots },
    { data: transactions },
  ] = await Promise.all([
    supabase
      .from('financial_profiles')
      .select('*')
      .eq('household_id', household.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('budget_categories')
      .select('*')
      .eq('household_id', household.id),
    supabase
      .from('debts')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_paid', false)
      .order('balance', { ascending: true }),
    supabase
      .from('action_plans')
      .select('*')
      .eq('household_id', household.id)
      .order('month', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('monthly_snapshots')
      .select('*')
      .eq('household_id', household.id)
      .order('month', { ascending: true }),
    supabase
      .from('transactions')
      .select('*, budget_categories(name, bucket)')
      .eq('household_id', household.id)
      .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
      .order('date', { ascending: false }),
  ]);

  // Compute spending by bucket for current month
  const spentByBucket = { needs: 0, wants: 0, savings: 0 };
  if (transactions) {
    for (const tx of transactions) {
      const bucket = (tx.budget_categories as { bucket: string } | null)?.bucket;
      if (bucket && bucket in spentByBucket) {
        spentByBucket[bucket as keyof typeof spentByBucket] += Number(tx.amount);
      }
    }
  }

  // Budget totals by bucket
  const budgetByBucket = { needs: 0, wants: 0, savings: 0 };
  if (categories) {
    for (const cat of categories) {
      if (cat.bucket in budgetByBucket) {
        budgetByBucket[cat.bucket as keyof typeof budgetByBucket] += Number(cat.budgeted_amount);
      }
    }
  }

  // Score history from snapshots
  const scoreHistory = (snapshots || []).map((s) => {
    const d = new Date(s.month);
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return { month: monthNames[d.getMonth()], score: s.health_score ?? 0 };
  });

  return {
    user: userProfile,
    household,
    financialProfile,
    categories,
    debts: debts || [],
    actionPlan,
    snapshots: snapshots || [],
    transactions: transactions || [],
    spentByBucket,
    budgetByBucket,
    scoreHistory,
  };
}
