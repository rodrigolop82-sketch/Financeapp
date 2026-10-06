import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { localToday } from '@/lib/dates';
import { clampHistoryFrom, freeHistoryStart, getEffectivePlan } from '@/lib/plans';

interface MonthTotal {
  month: string;
  count: number;
  sum_expense: number;
  sum_income: number;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json();
  const {
    query,
    from: requestedFrom,
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

  // Gratis ve los últimos 3 meses: lo de antes no se borra, solo se oculta.
  const { plan } = await getEffectivePlan(user.id);
  const historyStart = plan === 'free' ? freeHistoryStart(localToday()) : null;
  const from = historyStart ? clampHistoryFrom(requestedFrom, historyStart) : requestedFrom;
  if (historyStart && to && to < historyStart) {
    return NextResponse.json({ rows: [], totals: cursorDate ? null : [], hidden: await countHidden() });
  }

  /** Cuántos resultados quedan antes del límite (mismos filtros). */
  async function countHidden(): Promise<{ count: number; before: string } | null> {
    if (!historyStart || cursorDate) return null;
    if (requestedFrom && requestedFrom >= historyStart) return null;
    const dayBefore = new Date(Date.parse(historyStart + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc('search_transactions_summary', {
      p_query: query?.trim() || null,
      p_from: requestedFrom || null,
      p_to: to && to < dayBefore ? to : dayBefore,
      p_category_id: categoryId || null,
      p_min_amount: minAmount != null ? Number(minAmount) : null,
      p_max_amount: maxAmount != null ? Number(maxAmount) : null,
      p_transaction_type: transactionType || null,
      p_type: type || null,
    });
    if (error) return null;
    const count = ((data ?? []) as { count: number }[]).reduce((n, t) => n + Number(t.count), 0);
    return count > 0 ? { count, before: historyStart } : null;
  }

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

  // Totales por mes (cuántos, gastos e ingresos): solo con la primera página.
  let totals: MonthTotal[] = [];
  if (!cursorDate) {
    const filters = {
      p_query: query?.trim() || null,
      p_from: from || null,
      p_to: to || null,
      p_category_id: categoryId || null,
      p_min_amount: minAmount != null ? Number(minAmount) : null,
      p_max_amount: maxAmount != null ? Number(maxAmount) : null,
      p_transaction_type: transactionType || null,
      p_type: type || null,
    };
    const summary = await supabase.rpc('search_transactions_summary', filters);
    if (!summary.error) {
      totals = ((summary.data ?? []) as MonthTotal[]).map((t) => ({
        month: t.month,
        count: Number(t.count),
        sum_expense: Number(t.sum_expense),
        sum_income: Number(t.sum_income),
      }));
    } else {
      // Sin la migración de búsqueda anual: totales viejos (sin ingresos).
      const { data: old, error: totalsError } = await supabase.rpc('search_transactions_month_totals', filters);
      if (totalsError) {
        return NextResponse.json(
          { error: 'No pudimos obtener los totales. Intenta de nuevo.' },
          { status: 500 },
        );
      }
      totals = ((old ?? []) as { month: string; count: number; sum_gastos: number }[]).map((t) => ({
        month: t.month,
        count: Number(t.count),
        sum_expense: Number(t.sum_gastos),
        sum_income: 0,
      }));
    }
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

  return NextResponse.json({ rows: enriched, totals: cursorDate ? null : totals, hidden: await countHidden(), historyStart });
}
