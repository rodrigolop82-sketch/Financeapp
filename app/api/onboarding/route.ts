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
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const {
    householdName,
    householdType,
    totalIncome,
    incomeType,
    fixedExpenses,
    debts,
    totalSavings,
    hasEmergencyFund,
  } = body;

  const totalFixedExpenses = Object.values(fixedExpenses as Record<string, number>).reduce(
    (a: number, b: number) => a + b, 0
  );
  const totalDebt = (debts as { balance: number }[]).reduce(
    (a: number, b: { balance: number }) => a + b.balance, 0
  );

  // Compute score
  const profile = {
    total_income: totalIncome,
    total_fixed_expenses: totalFixedExpenses,
    total_debt: totalDebt,
    total_savings: totalSavings,
    has_emergency_fund: hasEmergencyFund,
    income_type: incomeType,
  };
  const score = calculateHealthScore(profile);
  const planSteps = generateInitialPlan(profile, score);

  // 1. Create household (trigger auto-creates default budget categories)
  const { data: household, error: hhError } = await supabase
    .from('households')
    .insert({
      name: householdName,
      owner_id: user.id,
      type: householdType === 'individual' ? 'individual' : 'family',
    })
    .select('id')
    .single();

  if (hhError || !household) {
    return NextResponse.json({ error: 'Error al crear hogar', details: hhError?.message }, { status: 500 });
  }

  // 2. Add user as owner in household_members
  await supabase.from('household_members').insert({
    household_id: household.id,
    user_id: user.id,
    role: 'owner',
  });

  // 3. Create financial profile
  await supabase.from('financial_profiles').insert({
    household_id: household.id,
    total_income: totalIncome,
    income_type: incomeType,
    total_fixed_expenses: totalFixedExpenses,
    total_debt: totalDebt,
    total_savings: totalSavings,
    has_emergency_fund: hasEmergencyFund,
    health_score: score.total,
  });

  // 4. Insert debts
  if (debts && debts.length > 0) {
    const debtRows = (debts as {
      name: string;
      type: string;
      balance: number;
      interestRate: number;
      minPayment: number;
    }[]).map((d) => ({
      household_id: household.id,
      name: d.name || 'Deuda sin nombre',
      type: d.type as 'credit' | 'loan' | 'informal',
      balance: d.balance,
      interest_rate: d.interestRate,
      min_payment: d.minPayment,
    }));
    await supabase.from('debts').insert(debtRows);
  }

  // 5. Update budget categories with suggested amounts (50/30/20)
  if (totalIncome > 0) {
    const needsBudget = totalIncome * 0.5;
    const wantsBudget = totalIncome * 0.3;
    const savingsBudget = totalIncome * 0.2;

    // Get the auto-created categories
    const { data: categories } = await supabase
      .from('budget_categories')
      .select('id, bucket')
      .eq('household_id', household.id);

    if (categories) {
      const needsCats = categories.filter((c) => c.bucket === 'needs');
      const wantsCats = categories.filter((c) => c.bucket === 'wants');
      const savingsCats = categories.filter((c) => c.bucket === 'savings');

      // Distribute evenly within each bucket
      const distributeEvenly = async (cats: typeof categories, total: number) => {
        const perCat = Math.round((total / cats.length) * 100) / 100;
        for (const cat of cats) {
          await supabase
            .from('budget_categories')
            .update({ budgeted_amount: perCat })
            .eq('id', cat.id);
        }
      };

      await distributeEvenly(needsCats, needsBudget);
      await distributeEvenly(wantsCats, wantsBudget);
      await distributeEvenly(savingsCats, savingsBudget);
    }
  }

  // 6. Create initial action plan
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  await supabase.from('action_plans').insert({
    household_id: household.id,
    month: monthStr,
    steps: planSteps,
    completed_steps: [],
    generated_by: 'rule',
  });

  // 7. Create initial monthly snapshot
  await supabase.from('monthly_snapshots').insert({
    household_id: household.id,
    month: monthStr,
    health_score: score.total,
    income: totalIncome,
    expenses: totalFixedExpenses,
    savings: totalSavings,
    plan_completed: false,
  });

  return NextResponse.json({
    success: true,
    householdId: household.id,
    healthScore: score.total,
  });
}
