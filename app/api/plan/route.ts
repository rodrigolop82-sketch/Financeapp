import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { calculateHealthScore } from '@/lib/scoring';
import { generateInitialPlan } from '@/lib/action-plan';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { householdId } = await request.json();

  // Get current financial profile
  const { data: fp } = await supabase
    .from('financial_profiles')
    .select('*')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (!fp) return NextResponse.json({ error: 'Sin perfil financiero' }, { status: 400 });

  const profile = {
    total_income: Number(fp.total_income),
    total_fixed_expenses: Number(fp.total_fixed_expenses),
    total_debt: Number(fp.total_debt),
    total_savings: Number(fp.total_savings),
    has_emergency_fund: fp.has_emergency_fund,
    income_type: fp.income_type as 'fixed' | 'variable' | 'mixed',
  };

  const score = calculateHealthScore(profile);
  const steps = generateInitialPlan(profile, score);

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Upsert plan for current month
  const { data: plan } = await supabase
    .from('action_plans')
    .upsert({
      household_id: householdId,
      month: monthStr,
      steps,
      completed_steps: [],
      generated_by: 'rule',
    }, { onConflict: 'household_id,month' })
    .select('id')
    .single();

  return NextResponse.json({ steps, planId: plan?.id });
}
