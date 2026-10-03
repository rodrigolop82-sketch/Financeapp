'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { localToday } from '@/lib/dates';
import type { BudgetCategory, SearchTransaction } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { getUserHousehold } from '@/lib/household';
import { groupByDay, monthLabel, monthRange, recentMonths } from '@/lib/movimientos';
import { AppShell } from '@/components/layout/AppShell';
import { openAddSheet } from '@/components/dashboard/BottomNav';
import { TRANSACTIONS_CHANGED_EVENT, type TxChangedDetail } from '@/components/add/AddSheet';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { MonthSummary } from '@/components/movimientos/MonthSummary';
import { MovimientosSearch, type TypeFilter } from '@/components/movimientos/MovimientosSearch';
import { TxDayGroup } from '@/components/movimientos/TxDayGroup';
import { SwipeRow, txRowData } from '@/components/movimientos/SwipeRow';
import { OptionSheet } from '@/components/movimientos/OptionSheet';
import { useTxSheets } from '@/components/movimientos/useTxSheets';
import { BORDER, CARD_BG, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { Loader2, Receipt, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 50;
const SWIPE_HINT_KEY = 'zafi:swipe-hint';

function readSwipeCount(): number {
  try { return Number(localStorage.getItem(SWIPE_HINT_KEY)) || 0; } catch { return 0; }
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
  const [swipeCount, setSwipeCount] = useState(3);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);

  const reload = useCallback(() => setReloadGen((g) => g + 1), []);
  const sheets = useTxSheets({ rows, setRows, categories, fmt, today, onChanged: reload, loading });

  useEffect(() => { setSwipeCount(readSwipeCount()); }, []);

  // ?q= (por ejemplo desde la alerta de Inicio) es la búsqueda inicial.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) { setQuery(q); setDebouncedQuery(q); }
  }, []);

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
        const pendingId = sheets.getPendingDeleteId();
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
        sheets.showMessage({ text: 'No pudimos cargar tus movimientos. Intenta de nuevo.', tone: 'error' });
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
      const pendingId = sheets.getPendingDeleteId();
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.filter((r) => !seen.has(r.id) && r.id !== pendingId)];
      });
      setHasMore(page.length === PAGE_SIZE);
      const last = page[page.length - 1];
      if (last) cursor.current = { date: last.date, id: last.id };
    } catch {
      sheets.showMessage({ text: 'No pudimos cargar más movimientos.', tone: 'error' });
    }
    setLoadingMore(false);
  }, [hasMore, loadingMore, loading, fetchPage, sheets]);

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

  // Movimientos agregados desde el botón +: recarga y resalta el nuevo.
  const { flash } = sheets;
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

  function markSwiped() {
    const next = swipeCount + 1;
    setSwipeCount(next);
    try { localStorage.setItem(SWIPE_HINT_KEY, String(next)); } catch { /* sin almacenamiento */ }
  }

  const groups = groupByDay(rows, today);
  const filtered = !!searchQuery || typeFilter !== 'all';

  const monthPill = (
    <button
      type="button"
      onClick={() => setMonthSheetOpen(true)}
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

        {sheets.deleteError && (
          <div role="alert" className="mt-3 p-3 bg-danger-light rounded-xl text-sm text-danger-text">
            {sheets.deleteError}
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
                  {g.rows.map((tx) => (
                    <SwipeRow
                      key={tx.id}
                      row={txRowData(tx, fmt)}
                      isOpen={openRowId === tx.id}
                      anyOpen={openRowId !== null}
                      flash={sheets.flashId === tx.id}
                      onOpenChange={(open) => setOpenRowId(open ? tx.id : null)}
                      onSelect={() => { setOpenRowId(null); sheets.openDetail(tx.id); }}
                      onChange={() => { setOpenRowId(null); sheets.openCategory(tx.id); }}
                      onDelete={() => { setOpenRowId(null); sheets.deleteTx(tx); }}
                      onSwiped={markSwiped}
                    />
                  ))}
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

      <BottomSheet themed open={monthSheetOpen} onClose={() => setMonthSheetOpen(false)} label="Elegir mes">
        {monthSheetOpen && (
          <OptionSheet
            title="¿Qué mes quieres ver?"
            options={recentMonths(today, 12).map((m) => ({ value: m, label: monthLabel(m, today) }))}
            selected={month}
            onSelect={(m) => { setMonth(m); setMonthSheetOpen(false); }}
          />
        )}
      </BottomSheet>

      {sheets.element}
    </AppShell>
  );
}
