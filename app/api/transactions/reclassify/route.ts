import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { getMerchantKey } from '@/lib/transactions/merchant-key';
import { deriveTransactionType } from '@/lib/transactions/transaction-type';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json();
  const { transactionId, categoryId, type } = body;

  if (!transactionId || !categoryId) {
    return NextResponse.json({ error: 'Faltan datos requeridos.' }, { status: 400 });
  }

  if (type !== undefined && type !== 'expense' && type !== 'income') {
    return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
  }

  const { data: memberRows } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id);
  const householdIds = (memberRows ?? []).map((r) => r.household_id);

  if (householdIds.length === 0) {
    return NextResponse.json({ error: 'No perteneces a ningún hogar.' }, { status: 403 });
  }

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .select('id, household_id, category_id, description, category_source, transaction_type, type')
    .eq('id', transactionId)
    .single();

  if (txError || !tx) {
    return NextResponse.json({ error: 'Transacción no encontrada.' }, { status: 404 });
  }

  if (!householdIds.includes(tx.household_id)) {
    return NextResponse.json({ error: 'No tienes acceso a esta transacción.' }, { status: 403 });
  }

  const { data: cat } = await supabase
    .from('budget_categories')
    .select('id, household_id, bucket')
    .eq('id', categoryId)
    .single();

  if (!cat) {
    return NextResponse.json({ error: 'Categoría no encontrada.' }, { status: 404 });
  }

  const isSystemCategory = cat.household_id === null;
  if (!isSystemCategory && !householdIds.includes(cat.household_id)) {
    return NextResponse.json({ error: 'No tienes acceso a esta categoría.' }, { status: 403 });
  }

  const prevCategoryId = tx.category_id;
  const prevCategorySource = tx.category_source;
  const prevType = tx.type;
  const prevTransactionType = tx.transaction_type;

  const newType: 'expense' | 'income' = type ?? tx.type;
  const newTransactionType = deriveTransactionType(newType, cat.bucket);
  const categoryChanged = categoryId !== prevCategoryId;

  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      category_id: categoryId,
      category_source: 'manual',
      type: newType,
      transaction_type: newTransactionType,
    })
    .eq('id', transactionId);

  if (updateError) {
    return NextResponse.json(
      { error: 'No pudimos guardar el cambio. Intenta de nuevo.' },
      { status: 500 },
    );
  }

  const snapshot = {
    id: tx.id,
    categoryId: prevCategoryId,
    categorySource: prevCategorySource,
    type: prevType,
    transactionType: prevTransactionType,
  };

  const merchantKey = getMerchantKey(tx.description);
  const isGasto = tx.transaction_type === 'gasto';

  // The "same merchant, reclassify the rest too?" flow only makes sense when
  // the category itself changed — a type-only edit (gasto ↔ ingreso) applies
  // to this one transaction.
  if (!merchantKey || !isGasto || !categoryChanged) {
    return NextResponse.json({
      success: true,
      learningDeferred: false,
      matches: [],
      truncated: false,
      snapshot,
    });
  }

  const { data: allSameMerchant } = await supabase
    .from('transactions')
    .select('id, description, category_id, category_source, transaction_type, date, amount, household_id')
    .eq('household_id', tx.household_id)
    .eq('transaction_type', 'gasto')
    .neq('id', transactionId)
    .neq('category_id', categoryId)
    .order('date', { ascending: false })
    .limit(600);

  const candidates = (allSameMerchant ?? []).filter((t) => {
    return getMerchantKey(t.description) === merchantKey;
  });

  const truncated = candidates.length > 500;
  const matches = candidates.slice(0, 500).map((t) => ({
    id: t.id,
    description: t.description,
    category_id: t.category_id,
    category_source: t.category_source,
    date: t.date,
    amount: t.amount,
  }));

  const defaultSelectedIds = matches
    .filter((t) => t.category_source !== 'manual')
    .map((t) => t.id);

  return NextResponse.json({
    success: true,
    learningDeferred: matches.length > 0,
    matches,
    defaultSelectedIds,
    truncated,
    snapshot,
  });
}
