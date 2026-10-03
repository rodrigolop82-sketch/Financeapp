'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { localToday } from '@/lib/dates';
import type { BudgetCategory, SearchTransaction } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { getUserHousehold } from '@/lib/household';
import { useReclassifyFlow } from '@/lib/transactions/useReclassifyFlow';
import { useUndoableDelete } from '@/lib/transactions/useUndoableDelete';
import { DELETE_UNDO_MS } from '@/lib/transactions/undo-delete';
import { deriveTransactionType } from '@/lib/transactions/transaction-type';
import { getEmoji, PAYMENT_OPTIONS, type PaymentMethod } from '@/lib/categories-ui';
import { groupByDay, monthLabel, monthRange, recentMonths, sameMerchantOthers } from '@/lib/movimientos';
import { AppShell } from '@/components/layout/AppShell';
import { openAddSheet } from '@/components/dashboard/BottomNav';
import { TRANSACTIONS_CHANGED_EVENT, type TxChangedDetail } from '@/components/add/AddSheet';
import { UndoToast } from '@/components/transactions/UndoToast';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { MonthSummary } from '@/components/movimientos/MonthSummary';
import { MovimientosSearch, type TypeFilter } from '@/components/movimientos/MovimientosSearch';
import { TxDayGroup } from '@/components/movimientos/TxDayGroup';
import { SwipeRow } from '@/components/movimientos/SwipeRow';
import { TxDetailSheet } from '@/components/movimientos/TxDetailSheet';
import { CategorySheet } from '@/components/movimientos/CategorySheet';
import { DateSheet, OptionSheet } from '@/components/movimientos/OptionSheet';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';
import { BORDER, CARD_BG, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { Loader2, Receipt, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 50;
const SWIPE_HINT_KEY = 'zafi:swipe-hint';
const FLASH_MS = 1600;

type SheetView = 'detail' | 'category' | 'date' | 'payment' | 'month';

interface SheetState {
  view: SheetView;
  txId: string | null;
  /** Vista a la que vuelven "Escape" o tocar fuera (null cierra la hoja). */
  back: SheetView | null;
}

const SHEET_LABEL: Record<SheetView, string> = {
  detail: 'Detalle del movimiento',
  category: 'Elegir categoría',
  date: 'Elegir fecha',
  payment: 'Forma de pago',
  month: 'Elegir mes',
};

function readSwipeCount(): number {
  try { return Number(localStorage.getItem(SWIPE_HINT_KEY)) || 0; } catch { return 0; }
}

function byDateDesc(a: SearchTransaction, b: SearchTransaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

export default function MovimientosPage() {
  const router = useRouter();
  const fmt = useFormatMoney();
  const supabase = useMemo(() => createClient(), []);
  const today = localToday();

  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [ready, setReady] = useState(false);

  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const [rows, setRows] = useState<SearchTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [reloadGen, setReloadGen] = useState(0);
  const cursor = useRef<{ date: string; id: string } | null>(null);
  const [summary, setSummary] = useState<{ spent: number; received: number } | null>(null);

  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [swipeCount, setSwipeCount] = useState(3);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const reload = useCallback(() => setReloadGen((g) => g + 1), []);
  const flow = useReclassifyFlow(categories, reload);
  const deletion = useUndoableDelete(setRows);

  useEffect(() => { setSwipeCount(readSwipeCount()); }, []);

  // Hogar y categorías
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const hh = await getUserHousehold(supabase, user.id);
      if (!hh) { router.push('/onboarding'); return; }
      const { data: cats } = await supabase.from('budget_categories').select('*').eq('household_id', hh.id);
      setCategories((cats ?? []) as BudgetCategory[]);
      setReady(true);
    })();
  }, [supabase, router]);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { from, to } = monthRange(month);
  const searchQuery = debouncedQuery.length >= 2 ? debouncedQuery : '';

  const fetchPage = useCallback(async (after: { date: string; id: string } | null, signal?: AbortSignal) => {
    const res = await fetch('/api/transactions/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery || undefined,
        from,
        to,
        type: typeFilter === 'all' ? undefined : typeFilter,
        limit: PAGE_SIZE,
        cursorDate: after?.date,
        cursorId: after?.id,
      }),
      signal,
    });
    if (!res.ok) throw new Error('search');
    const data = await res.json();
    return (data.rows ?? []) as SearchTransaction[];
  }, [searchQuery, from, to, typeFilter]);

  // Primera página: al entrar, al cambiar un filtro y después de cada cambio.
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading((was) => was || rows.length === 0);
    fetchPage(null, controller.signal)
      .then((page) => {
        const pendingId = deletion.getPendingId();
        setRows(pendingId ? page.filter((r) => r.id !== pendingId) : page);
        setHasMore(page.length === PAGE_SIZE);
        const last = page[page.length - 1];
        cursor.current = last ? { date: last.date, id: last.id } : null;
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setRows([]);
        setHasMore(false);
        setLoading(false);
        setMessage({ text: 'No pudimos cargar tus movimientos. Intenta de nuevo.', tone: 'error' });
      });
    return () => controller.abort();
  }, [ready, fetchPage, reloadGen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Totales del mes: no dependen de la búsqueda ni de las filas cargadas.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    supabase.rpc('transactions_month_summary', { p_from: from, p_to: to }).then(({ data }) => {
      if (cancelled) return;
      const r = Array.isArray(data) ? data[0] : data;
      setSummary({ spent: Number(r?.sum_expense ?? 0), received: Number(r?.sum_income ?? 0) });
    });
    return () => { cancelled = true; };
  }, [ready, supabase, from, to, reloadGen]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !cursor.current) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor.current);
      const pendingId = deletion.getPendingId();
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.filter((r) => !seen.has(r.id) && r.id !== pendingId)];
      });
      setHasMore(page.length === PAGE_SIZE);
      const last = page[page.length - 1];
      if (last) cursor.current = { date: last.date, id: last.id };
    } catch {
      setMessage({ text: 'No pudimos cargar más movimientos.', tone: 'error' });
    }
    setLoadingMore(false);
  }, [hasMore, loadingMore, loading, fetchPage, deletion]);

  // Scroll infinito
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((id: string) => {
    setFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), FLASH_MS);
  }, []);

  // Movimientos agregados desde el botón +: recarga y resalta el nuevo.
  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<TxChangedDetail | undefined>).detail;
      if (detail?.date) setMonth(detail.date.slice(0, 7));
      if (detail?.id) flash(detail.id);
      reload();
    }
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onChanged);
  }, [reload, flash]);

  const selected = sheet?.txId ? rows.find((r) => r.id === sheet.txId) ?? null : null;

  // Si el movimiento abierto desaparece (se borró o cambió de filtro), se cierra la hoja.
  useEffect(() => {
    if (sheet?.txId && !loading && !selected) setSheet(null);
  }, [sheet, selected, loading]);

  // ── Acciones ───────────────────────────────────

  function closeSheet() {
    setSheet((s) => (s?.back ? { ...s, view: s.back, back: null } : null));
    flow.clearError();
  }

  function openDetail(id: string) {
    setOpenRowId(null);
    setSheet({ view: 'detail', txId: id, back: null });
  }

  function openCategory(id: string, fromDetail: boolean) {
    setOpenRowId(null);
    flow.clearError();
    setSheet({ view: 'category', txId: id, back: fromDetail ? 'detail' : null });
  }

  function deleteTx(tx: SearchTransaction) {
    const index = rows.findIndex((r) => r.id === tx.id);
    if (index === -1) return;
    setSheet(null);
    setOpenRowId(null);
    if (flow.undoVisible) flow.dismissUndo();
    deletion.remove(tx, index);
  }

  /** Cambio optimista de un campo; si Supabase falla, se revierte. */
  async function updateTx(id: string, patch: Partial<Pick<SearchTransaction, 'date' | 'payment_method' | 'description' | 'note'>>) {
    const prev = rows.find((r) => r.id === id);
    if (!prev) return;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)).sort(byDateDesc));
    const { error } = await supabase.from('transactions').update(patch).eq('id', id);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === id ? prev : r)).sort(byDateDesc));
      setMessage({ text: 'No se pudo guardar el cambio. Intenta de nuevo.', tone: 'error' });
      return;
    }
    flash(id);
  }

  async function saveCategory(tx: SearchTransaction, categoryId: string, type: 'expense' | 'income', applyToOthers: boolean) {
    if (categoryId === tx.category_id && type === tx.type) {
      setSheet({ view: 'detail', txId: tx.id, back: null });
      return;
    }
    if (flow.undoVisible) flow.dismissUndo();
    const ok = await flow.reclassifyDirect(tx, categoryId, type, applyToOthers);
    if (!ok) return;
    const cat = categories.find((c) => c.id === categoryId);
    setRows((rs) => rs.map((r) => (r.id === tx.id ? {
      ...r,
      category_id: categoryId,
      category_name: cat?.name ?? r.category_name,
      category_bucket: (cat?.bucket ?? r.category_bucket) as SearchTransaction['category_bucket'],
      category_icon: cat?.icon ?? null,
      type,
      transaction_type: deriveTransactionType(type, cat?.bucket),
    } : r)));
    flash(tx.id);
    setSheet({ view: 'detail', txId: tx.id, back: null });
  }

  function markSwiped() {
    const next = swipeCount + 1;
    setSwipeCount(next);
    try { localStorage.setItem(SWIPE_HINT_KEY, String(next)); } catch { /* sin almacenamiento */ }
  }

  // ── Vista ─────────────────────────────────────

  const groups = groupByDay(rows, today);
  const filtered = !!searchQuery || typeFilter !== 'all';

  const monthPill = (
    <button
      type="button"
      onClick={() => setSheet({ view: 'month', txId: null, back: null })}
      aria-label={`Mes: ${monthLabel(month, today)}. Cambiar mes`}
      className={`flex-none flex items-center gap-1 h-9 px-3.5 rounded-full border text-sm font-semibold text-navy dark:text-ink-100 ${BORDER} ${CARD_BG}`}
    >
      {monthLabel(month, today)}
      <ChevronDown size={14} aria-hidden />
    </button>
  );

  return (
    <AppShell title="Movimientos" currentPath="/transacciones" titleRight={monthPill} headerRight={monthPill}>
      <div className="max-w-3xl flex flex-col">
        <div className="mt-3.5">
          <MonthSummary
            spent={summary ? fmt(summary.spent) : null}
            received={summary ? fmt(summary.received) : null}
          />
        </div>

        <div className="mt-3">
          <MovimientosSearch
            query={query}
            onQueryChange={(q) => { setQuery(q); setOpenRowId(null); }}
            type={typeFilter}
            onTypeChange={(t) => { setTypeFilter(t); setOpenRowId(null); }}
          />
        </div>

        {deletion.error && (
          <div role="alert" className="mt-3 p-3 bg-danger-light rounded-xl text-sm text-danger-text">
            {deletion.error}
          </div>
        )}

        <div className="pt-3.5 flex flex-col gap-3.5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-7 h-7 text-electric animate-spin" aria-label="Cargando" />
            </div>
          ) : rows.length === 0 ? (
            <div className={`rounded-2xl px-6 py-10 text-center ${CARD_BG}`}>
              {filtered ? (
                <>
                  <p className={`font-semibold ${TEXT_STRONG}`}>
                    {searchQuery ? `Nada con “${searchQuery}”` : 'Nada por aquí'}
                  </p>
                  <p className={`text-sm mt-1 ${TEXT_MUTED}`}>Prueba con otra palabra o quita el filtro.</p>
                </>
              ) : (
                <>
                  <Receipt className="w-10 h-10 text-ink-400 mx-auto mb-3" aria-hidden />
                  <p className={`font-semibold ${TEXT_STRONG}`}>Aún no hay movimientos</p>
                  <p className={`text-sm mt-1 mb-4 ${TEXT_MUTED}`}>Empieza a registrar tus gastos para llevar el control.</p>
                  <button type="button" onClick={openAddSheet} className="btn-primary" style={{ borderRadius: 14 }}>
                    Agregar el primero
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {groups.map((g) => (
                <TxDayGroup key={g.date} label={g.label} total={fmt(g.expenseTotal)}>
                  {g.rows.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const forex = tx.original_currency
                      ? ` · ${tx.original_currency === 'USD' ? '$' : tx.original_currency === 'EUR' ? '€' : `${tx.original_currency} `}${Number(tx.original_amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '';
                    return (
                      <SwipeRow
                        key={tx.id}
                        row={{
                          id: tx.id,
                          emoji: getEmoji({ name: tx.category_name, bucket: tx.category_bucket, icon: tx.category_icon }),
                          name: tx.description || tx.category_name || 'Sin nombre',
                          sub: (tx.category_name || 'Sin categoría') + forex,
                          amountLabel: `${isIncome ? '+' : ''}${fmt(Number(tx.amount))}`,
                          isIncome,
                        }}
                        isOpen={openRowId === tx.id}
                        anyOpen={openRowId !== null}
                        flash={flashId === tx.id}
                        onOpenChange={(open) => setOpenRowId(open ? tx.id : null)}
                        onSelect={() => openDetail(tx.id)}
                        onChange={() => openCategory(tx.id, false)}
                        onDelete={() => deleteTx(tx)}
                        onSwiped={markSwiped}
                      />
                    );
                  })}
                </TxDayGroup>
              ))}
              <div ref={sentinel} />
              {loadingMore && (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-5 h-5 text-electric animate-spin" aria-label="Cargando más" />
                </div>
              )}
              {swipeCount < 3 && (
                <p className="lg:hidden text-center text-[13px] px-4 text-ink-400">
                  Toca un movimiento para verlo · desliza a la izquierda para cambiar o borrar
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <BottomSheet themed open={!!sheet} onClose={closeSheet} label={sheet ? SHEET_LABEL[sheet.view] : undefined}>
        {sheet?.view === 'month' && (
          <OptionSheet
            title="¿Qué mes quieres ver?"
            options={recentMonths(today, 12).map((m) => ({ value: m, label: monthLabel(m, today) }))}
            selected={month}
            onSelect={(m) => { setMonth(m); setSheet(null); }}
          />
        )}
        {sheet?.view === 'detail' && selected && (
          <TxDetailSheet
            tx={selected}
            today={today}
            fmt={fmt}
            onOpenCategory={() => openCategory(selected.id, true)}
            onOpenDate={() => setSheet({ view: 'date', txId: selected.id, back: 'detail' })}
            onOpenPayment={() => setSheet({ view: 'payment', txId: selected.id, back: 'detail' })}
            onSaveText={(id, patch) => { void updateTx(id, patch); }}
            onDelete={() => deleteTx(selected)}
            onDone={() => setSheet(null)}
          />
        )}
        {sheet?.view === 'category' && selected && (
          <CategorySheet
            key={selected.id}
            categories={categories}
            type={selected.type}
            subtitle={`${selected.description || selected.category_name} · ${fmt(Number(selected.amount))}`}
            initialCategoryId={selected.category_id}
            othersCount={(catId) => sameMerchantOthers(rows, selected, catId).length}
            merchantName={selected.description ?? ''}
            saving={flow.saving}
            error={flow.error}
            onSave={(catId, type, applyAll) => { void saveCategory(selected, catId, type, applyAll); }}
          />
        )}
        {sheet?.view === 'date' && selected && (
          <DateSheet
            today={today}
            selected={selected.date}
            onSelect={(date) => {
              void updateTx(selected.id, { date });
              setSheet({ view: 'detail', txId: selected.id, back: null });
            }}
          />
        )}
        {sheet?.view === 'payment' && selected && (
          <OptionSheet<PaymentMethod>
            title={selected.type === 'income' ? '¿Cómo lo recibiste?' : '¿Con qué pagaste?'}
            options={PAYMENT_OPTIONS}
            selected={selected.payment_method}
            onSelect={(pm) => {
              void updateTx(selected.id, { payment_method: pm });
              setSheet({ view: 'detail', txId: selected.id, back: null });
            }}
          />
        )}
      </BottomSheet>

      <UndoToast
        visible={flow.undoVisible}
        title={flow.undoTitle}
        subtitle={flow.undoSubtitle || undefined}
        onUndo={flow.doUndo}
        onDismiss={flow.dismissUndo}
        duration={DELETE_UNDO_MS}
      />

      <UndoToast
        key={deletion.pending?.id}
        visible={!!deletion.pending}
        title={deletion.pending
          ? `Borraste ${deletion.pending.description || deletion.pending.category_name} · ${fmt(Number(deletion.pending.amount))}`
          : ''}
        onUndo={deletion.undo}
        onDismiss={deletion.commit}
        duration={DELETE_UNDO_MS}
      />

      <StatusToast message={message} onDone={() => setMessage(null)} />
    </AppShell>
  );
}
