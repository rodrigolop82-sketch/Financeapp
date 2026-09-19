import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json();
  const { items, overrideCreated, merchantKey, householdId } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Nada que deshacer.' }, { status: 400 });
  }

  const { data: memberRows } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id);
  const householdIds = (memberRows ?? []).map((r) => r.household_id);

  if (householdIds.length === 0) {
    return NextResponse.json({ error: 'No perteneces a ningún hogar.' }, { status: 403 });
  }

  const txIds = items.map((item: { id: string }) => item.id);
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, household_id')
    .in('id', txIds);

  const validIds = new Set(
    (existing ?? [])
      .filter((t) => householdIds.includes(t.household_id))
      .map((t) => t.id),
  );

  let restoredCount = 0;

  for (const item of items as { id: string; categoryId: string; categorySource: string }[]) {
    if (!validIds.has(item.id)) continue;

    const { error } = await supabase
      .from('transactions')
      .update({
        category_id: item.categoryId,
        category_source: item.categorySource,
      })
      .eq('id', item.id);

    if (!error) restoredCount++;
  }

  if (overrideCreated && merchantKey && householdId && householdIds.includes(householdId)) {
    await supabase
      .from('merchant_category_overrides')
      .delete()
      .eq('merchant_key', merchantKey)
      .eq('household_id', householdId);
  }

  return NextResponse.json({ success: true, restoredCount });
}
