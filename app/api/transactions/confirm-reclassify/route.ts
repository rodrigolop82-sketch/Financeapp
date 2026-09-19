import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { getMerchantKey } from '@/lib/transactions/merchant-key';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json();
  const { sourceTransactionId, categoryId, ids, remember } = body;

  if (!sourceTransactionId || !categoryId) {
    return NextResponse.json({ error: 'Faltan datos requeridos.' }, { status: 400 });
  }

  const { data: memberRows } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id);
  const householdIds = (memberRows ?? []).map((r) => r.household_id);

  if (householdIds.length === 0) {
    return NextResponse.json({ error: 'No perteneces a ningún hogar.' }, { status: 403 });
  }

  const { data: sourceTx } = await supabase
    .from('transactions')
    .select('id, household_id, description, transaction_type')
    .eq('id', sourceTransactionId)
    .single();

  if (!sourceTx || !householdIds.includes(sourceTx.household_id)) {
    return NextResponse.json({ error: 'Transacción origen no encontrada.' }, { status: 404 });
  }

  const merchantKey = getMerchantKey(sourceTx.description);
  const selectedIds: string[] = Array.isArray(ids) ? ids : [];
  const snapshot: { id: string; categoryId: string; categorySource: string }[] = [];
  let appliedCount = 0;

  if (selectedIds.length > 0) {
    const { data: txToUpdate } = await supabase
      .from('transactions')
      .select('id, category_id, category_source, description, transaction_type, household_id')
      .in('id', selectedIds);

    const valid = (txToUpdate ?? []).filter((t) => {
      if (!householdIds.includes(t.household_id)) return false;
      if (t.transaction_type !== 'gasto') return false;
      if (t.category_id === categoryId) return false;
      if (merchantKey && getMerchantKey(t.description) !== merchantKey) return false;
      return true;
    });

    for (const t of valid) {
      snapshot.push({ id: t.id, categoryId: t.category_id, categorySource: t.category_source });
    }

    if (valid.length > 0) {
      const validIds = valid.map((t) => t.id);
      const { error: bulkError } = await supabase
        .from('transactions')
        .update({ category_id: categoryId, category_source: 'bulk' })
        .in('id', validIds);

      if (bulkError) {
        return NextResponse.json(
          { error: 'No pudimos guardar el cambio. Intenta de nuevo.' },
          { status: 500 },
        );
      }

      appliedCount = valid.length;
    }
  }

  let overrideCreated = false;

  if (remember && merchantKey) {
    const { data: existing } = await supabase
      .from('merchant_category_overrides')
      .select('id')
      .eq('merchant_key', merchantKey)
      .eq('household_id', sourceTx.household_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('merchant_category_overrides')
        .update({ category_id: categoryId, created_by: user.id, created_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      const { error: insertError } = await supabase
        .from('merchant_category_overrides')
        .insert({
          merchant_key: merchantKey,
          category_id: categoryId,
          household_id: sourceTx.household_id,
          created_by: user.id,
        });

      if (!insertError) {
        overrideCreated = true;
      }
    }
  }

  return NextResponse.json({
    success: true,
    appliedCount,
    overrideCreated,
    snapshot,
  });
}
