import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json();
  const {
    query,
    from,
    to,
    categoryId,
    minAmount,
    maxAmount,
    transactionType,
    type,
    limit = 30,
    cursorDate,
    cursorId,
  } = body;

  if (query && typeof query === 'string' && query.trim().length > 0 && query.trim().length < 2) {
    return NextResponse.json({ error: 'La búsqueda necesita al menos 2 caracteres.' }, { status: 400 });
  }

  if (type !== undefined && type !== null && type !== 'expense' && type !== 'income') {
    return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
  }

  const safeLimit = Math.min(Math.max(1, Number(limit) || 30), 100);

  const { data: rows, error: searchError } = await supabase.rpc('search_transactions', {
    p_query: query?.trim() || null,
    p_from: from || null,
    p_to: to || null,
    p_category_id: categoryId || null,
    p_min_amount: minAmount != null ? Number(minAmount) : null,
    p_max_amount: maxAmount != null ? Number(maxAmount) : null,
    p_transaction_type: transactionType || null,
    p_limit: safeLimit,
    p_cursor_date: cursorDate || null,
    p_cursor_id: cursorId || null,
    p_type: type || null,
  });

  if (searchError) {
    return NextResponse.json(
      { error: 'No pudimos buscar las transacciones. Intenta de nuevo.' },
      { status: 500 },
    );
  }

  const { data: totals, error: totalsError } = await supabase.rpc('search_transactions_month_totals', {
    p_query: query?.trim() || null,
    p_from: from || null,
    p_to: to || null,
    p_category_id: categoryId || null,
    p_min_amount: minAmount != null ? Number(minAmount) : null,
    p_max_amount: maxAmount != null ? Number(maxAmount) : null,
    p_transaction_type: transactionType || null,
    p_type: type || null,
  });

  if (totalsError) {
    return NextResponse.json(
      { error: 'No pudimos obtener los totales. Intenta de nuevo.' },
      { status: 500 },
    );
  }

  // search_transactions no devuelve la parte del Plan del mes: se agrega aquí.
  // Si la columna no existe todavía (migración sin aplicar), las filas van sin ella.
  let enriched = (rows ?? []) as { id: string }[];
  if (enriched.length > 0) {
    const { data: subs, error: subsError } = await supabase
      .from('transactions')
      .select('id, budget_sub_item_id')
      .in('id', enriched.map((r) => r.id));
    if (!subsError && subs) {
      const byId = new Map((subs as { id: string; budget_sub_item_id: string | null }[]).map((t) => [t.id, t.budget_sub_item_id]));
      enriched = enriched.map((r) => ({ ...r, budget_sub_item_id: byId.get(r.id) ?? null }));
    }
  }

  return NextResponse.json({ rows: enriched, totals: totals ?? [] });
}
