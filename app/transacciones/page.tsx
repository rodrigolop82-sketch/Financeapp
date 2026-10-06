'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { localToday } from '@/lib/dates';
import type { BudgetCategory, SearchTransaction } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { getUserHousehold } from '@/lib/household';
import {
  groupByMonth, monthLabel, periodInText, periodLabel, periodRange, yearMonths, type Period,
} from '@/lib/movimientos';
import { StatementImportFlow } from '@/components/statement-import/StatementImportFlow';
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
import { GroupTitle, PillButton } from '@/components/layout/Pantalla';
import { CARD, GREEN_TEXT } from '@/components/resumen/ctf-ui';
import { Calendar, Receipt, ChevronDown, X } from 'lucide-react';
import { PageSkeleton, SkeletonRows } from '@/components/motion/PageSkeleton';
import { IMPORT_BANNER_EVENT } from '@/components/statement-import/StatementImportFlow';
import { importBannerText, parseImportBanner, type ImportBanner } from '@/lib/motion';
import { ApplePaySheet } from '@/components/movimientos/ApplePaySheet';

const PAGE_SIZE = 40;
const SWIPE_HINT_KEY = 'zafi:swipe-hint';

function readSwipeCount(): number {
  try { return Number(localStorage.getItem(SWIPE_HINT_KEY)) || 0; } catch { return 0; }
}

/** "Oct", "Oct 25" (si es de otro año) o "2026" (todo el año). */
function shortPeriod(period: Period, today: string): string {
  if (period === 'year') return today.slice(0, 4);
  const [name, year] = monthLabel(period, today).split(' ');
  return year ? `${name.slice(0, 3)} ${year.slice(2)}` : name.slice(0, 3);
}

/** Totales por mes de la búsqueda (de /api/transactions/search). */
interface MonthTotal {
  month: string;
  count: number;
  sum_expense: number;
  sum_income: number;
}

export default function MovimientosPage() {
  const router = useRouter();
  const fmt = useFormatMoney();
  const supabase = useMemo(() => createClient(), []);
  const today = localToday();

  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [ready, setReady] = useState(false);
  const [householdId, setHouseholdId] = useState('');
  const [importing, setImporting] = useState(false);

  // Lo que se mira sin buscar: un mes o todo el año.
  const [month, setMonth] = useState<Period>(() => today.slice(0, 7));
  // Dónde busca: al empezar a buscar pasa a todo el año.
  const [searchScope, setSearchScope] = useState<Period>('year');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const [rows, setRows] = useState<SearchTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [reloadGen, setReloadGen] = useState(0);
  const cursor = useRef<{ date: string; id: string } | null>(null);
  const [totals, setTotals] = useState<MonthTotal[] | null>(null);
  const [summary, setSummary] = useState<{ spent: number; received: number } | null>(null);

  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [swipeCount, setSwipeCount] = useState(3);
  const [periodSheet, setPeriodSheet] = useState<'browse' | 'search' | null>(null);

  const reload = useCallback(() => setReloadGen((g) => g + 1), []);
  const sheets = useTxSheets({ rows, setRows, categories, fmt, today, onChanged: reload, loading });

  useEffect(() => { setSwipeCount(readSwipeCount()); }, []);

  // ?q= (por ejemplo desde la alerta de Inicio) es la búsqueda inicial.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) { setQuery(q); setDebouncedQuery(q); }
  }, []);

  // ?importar=1 (la ruta vieja /importar) abre el flujo de importar.
  const [wantsImport, setWantsImport] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('importar') !== '1') return;
    url.searchParams.delete('importar');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    setWantsImport(true);
  }, []);

  // ?applepay={id}: el push de Apple Pay abre la hoja para confirmar la categoría.
  const [applePayId, setApplePayId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('applepay');
    if (id) setApplePayId(id);
  }, []);
  const closeApplePay = useCallback(() => {
    setApplePayId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('applepay')) {
      url.searchParams.delete('applepay');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);
  const { showMessage } = sheets;
  const showError = useCallback((text: string) => showMessage({ text, tone: 'error' }), [showMessage]);

  // Banner verde después de importar un estado de cuenta (?importados=&banco=&mes=).
  const [banner, setBanner] = useState<ImportBanner | null>(null);
  useEffect(() => {
    function show(b: ImportBanner) {
      setBanner(b);
      if (b.month) setMonth(b.month);
    }
    const url = new URL(window.location.href);
    const fromUrl = parseImportBanner(url.searchParams);
    if (fromUrl) {
      show(fromUrl);
      for (const k of ['importados', 'banco', 'mes']) url.searchParams.delete(k);
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    const onBanner = (e: Event) => show((e as CustomEvent<ImportBanner>).detail);
    window.addEventListener(IMPORT_BANNER_EVENT, onBanner);
    return () => window.removeEventListener(IMPORT_BANNER_EVENT, onBanner);
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
      setHouseholdId(hh.id as string);
      setReady(true);
    })();
  }, [supabase, router]);

  useEffect(() => {
    if (wantsImport && householdId) { setImporting(true); setWantsImport(false); }
  }, [wantsImport, householdId]);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const searchQuery = debouncedQuery.length >= 2 ? debouncedQuery : '';
  const searching = !!searchQuery;
  const scope = searching ? searchScope : month;
  const { from, to } = periodRange(scope, today);
  const browseRange = periodRange(month, today);

  // Cada búsqueda nueva empieza en todo el año, sin importar el mes que se miraba.
  const wasSearching = useRef(false);
  useEffect(() => {
    if (searching && !wasSearching.current) setSearchScope('year');
    wasSearching.current = searching;
  }, [searching]);

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
    return { rows: (data.rows ?? []) as SearchTransaction[], totals: (data.totals ?? null) as MonthTotal[] | null };
  }, [searchQuery, from, to, typeFilter]);

  // Primera página: al entrar, al cambiar un filtro y después de cada cambio.
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading((was) => was || rows.length === 0);
    fetchPage(null, controller.signal)
      .then(({ rows: page, totals: t }) => {
        const pendingId = sheets.getPendingDeleteId();
        setRows(pendingId ? page.filter((r) => r.id !== pendingId) : page);
        setTotals(t);
        setHasMore(page.length === PAGE_SIZE);
        const last = page[page.length - 1];
        cursor.current = last ? { date: last.date, id: last.id } : null;
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setRows([]);
        setTotals(null);
        setHasMore(false);
        setLoading(false);
        sheets.showMessage({ text: 'No pudimos cargar tus movimientos. Intenta de nuevo.', tone: 'error' });
      });
    return () => controller.abort();
  }, [ready, fetchPage, reloadGen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Totales del periodo: no dependen de la búsqueda ni de las filas cargadas.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    supabase.rpc('transactions_month_summary', { p_from: browseRange.from, p_to: browseRange.to }).then(({ data }) => {
      if (cancelled) return;
      const r = Array.isArray(data) ? data[0] : data;
      setSummary({ spent: Number(r?.sum_expense ?? 0), received: Number(r?.sum_income ?? 0) });
    });
    return () => { cancelled = true; };
  }, [ready, supabase, browseRange.from, browseRange.to, reloadGen]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !cursor.current) return;
    setLoadingMore(true);
    try {
      const { rows: page } = await fetchPage(cursor.current);
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

  // Movimientos agregados desde el botón +: recarga y resalta el nuevo.
  const { flash } = sheets;
  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<TxChangedDetail | undefined>).detail;
      if (detail?.date) setMonth(detail.date.slice(0, 7));
      if (detail?.id) flash(detail.id, true);
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

  const byMonth = scope === 'year';
  const monthGroups = groupByMonth(rows, today);
  const filtered = searching || typeFilter !== 'all';
  const year = today.slice(0, 4);
  const totalCount = totals ? totals.reduce((n, t) => n + t.count, 0) : null;
  const remaining = totalCount !== null ? Math.max(0, totalCount - rows.length) : null;
  const totalOf = (m: string) => totals?.find((t) => t.month === m);

  const periodOptions = (current: Period) => [
    { value: 'year', label: `Todo ${year}` },
    ...yearMonths(today).map((m, i) => ({ value: m, label: monthLabel(m, today) + (i === 0 ? ' (este mes)' : '') })),
    // Un mes de otro año (p. ej. tras importar un estado de cuenta viejo) sigue en la lista.
    ...(current !== 'year' && !current.startsWith(year) ? [{ value: current, label: monthLabel(current, today) }] : []),
  ];

  const monthPill = (
    <button
      type="button"
      onClick={() => setPeriodSheet('browse')}
      aria-label={`Periodo: ${periodLabel(month, today)}. Cambiar`}
      className={`flex-none flex items-center gap-1 h-9 px-3.5 rounded-full border text-sm font-semibold text-navy dark:text-ink-100 transition-opacity ${searching ? 'opacity-50' : ''} ${BORDER} ${CARD_BG}`}
    >
      {/* En pantallas angostas, "Oct": deja lugar para "Importar" junto al título. */}
      <span className="min-[430px]:hidden">{shortPeriod(month, today)}</span>
      <span className="hidden min-[430px]:inline">{periodLabel(month, today)}</span>
      <ChevronDown size={14} aria-hidden />
    </button>
  );

  // Resumen de búsqueda: total de gastos (o de ingresos si solo hay ingresos).
  const found = totals ?? [];
  const foundSpent = found.reduce((s, t) => s + t.sum_expense, 0);
  const foundReceived = found.reduce((s, t) => s + t.sum_income, 0);
  const foundMonths = found.filter((t) => t.count > 0).length || 1;
  const onlyIncome = foundSpent === 0 && foundReceived > 0;
  const searchSummary = (
    <div className={`flex flex-col gap-1 p-4 ${CARD}`}>
      <span className={`text-[13px] ${TEXT_MUTED}`}>“{searchQuery}” en {periodInText(searchScope, today)}</span>
      <span className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-outfit text-[30px] font-extrabold tracking-[-0.02em] ${onlyIncome ? GREEN_TEXT : TEXT_STRONG}`}>
          {totals ? (onlyIncome ? `+${fmt(foundReceived)}` : fmt(foundSpent)) : '—'}
        </span>
        {totalCount !== null && (
          <span className={`text-sm ${TEXT_MUTED}`}>{totalCount} {totalCount === 1 ? 'movimiento' : 'movimientos'}</span>
        )}
      </span>
      {searchScope === 'year' && foundSpent > 0 && (
        <span className={`text-[13px] ${TEXT_MUTED}`}>Promedio {fmt(foundSpent / foundMonths)} al mes</span>
      )}
    </div>
  );

  const scopeChip = searching ? (
    <button
      type="button"
      onClick={() => setPeriodSheet('search')}
      className="flex h-8 flex-none items-center gap-1.5 rounded-full bg-electric-ghost px-3 text-[13px] font-bold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft"
    >
      <Calendar size={14} aria-hidden />
      En {searchScope === 'year' ? `todo ${year}` : periodInText(searchScope, today)} ▾
    </button>
  ) : undefined;

  const headerActions = (
    <div className="flex flex-none items-center gap-1.5">
      <button
        type="button"
        onClick={() => setImporting(true)}
        disabled={!householdId}
        className="flex-none flex items-center h-9 px-3.5 rounded-full bg-navy text-white text-sm font-semibold dark:bg-electric"
      >
        Importar
      </button>
      {monthPill}
    </div>
  );

  if (!ready) return <PageSkeleton variant="list" />;

  const bannerText = banner ? importBannerText(banner, today) : null;

  return (
    <AppShell title="Movimientos" currentPath="/transacciones" titleRight={headerActions} headerRight={headerActions}>
      <div className="max-w-3xl flex flex-col zafi-stagger">
        <div className="mt-3.5">
          {searching ? searchSummary : (
            <MonthSummary
              spent={summary ? fmt(summary.spent) : null}
              received={summary ? fmt(summary.received) : null}
              spentLabel={month === 'year' ? `Gastaste en ${year}` : 'Gastaste'}
            />
          )}
        </div>

        {bannerText && (
          <div role="status" className="mt-3 flex items-center gap-2.5 rounded-[14px] bg-success-light dark:bg-[var(--zafi-success-bg)] px-3.5 py-3 animate-fade-up">
            <span aria-hidden className="text-lg leading-none">✅</span>
            <span className="flex-1 text-sm text-success-text dark:text-[var(--zafi-success-text)]">
              <b>{bannerText.strong}</b> {bannerText.rest}
            </span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              aria-label="Cerrar aviso"
              className="flex-none -my-2 -mr-2 flex h-11 w-11 items-center justify-center text-success-text dark:text-[var(--zafi-success-text)]"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        )}

        <div className="mt-3">
          <MovimientosSearch
            query={query}
            onQueryChange={(q) => { setQuery(q); setOpenRowId(null); }}
            type={typeFilter}
            onTypeChange={(t) => { setTypeFilter(t); setOpenRowId(null); }}
            placeholder={`Buscar en ${searching ? (searchScope === 'year' ? `todo ${year}` : periodInText(searchScope, today)) : `todo ${year}`}…`}
            scope={scopeChip}
          />
        </div>

        {sheets.deleteError && (
          <div role="alert" className="mt-3 p-3 bg-danger-light rounded-xl text-sm text-danger-text">
            {sheets.deleteError}
          </div>
        )}

        <div className="pt-3.5 flex flex-col gap-3.5">
          {loading ? (
            <SkeletonRows count={6} />
          ) : rows.length === 0 ? (
            <div className={`rounded-2xl px-6 py-10 text-center ${CARD_BG}`}>
              {filtered ? (
                <>
                  <p className={`font-semibold ${TEXT_STRONG}`}>
                    {searching ? `Nada con “${searchQuery}” en ${periodInText(searchScope, today)}` : 'Nada por aquí'}
                  </p>
                  {searching && searchScope !== 'year' ? (
                    <div className="mt-2 flex justify-center">
                      <PillButton onClick={() => setSearchScope('year')}>Buscar en todo {year}</PillButton>
                    </div>
                  ) : (
                    <p className={`text-sm mt-1 ${TEXT_MUTED}`}>Prueba con otra palabra o quita el filtro.</p>
                  )}
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
              {monthGroups.map((mg) => {
                const t = totalOf(mg.month);
                return (
                  <section key={mg.month} className="flex flex-col gap-3.5">
                    {byMonth && (
                      <div className="flex items-baseline justify-between pr-1 pt-1.5">
                        <GroupTitle className="">{monthLabel(mg.month, today)}</GroupTitle>
                        {t && (
                          <span className={`text-[13px] ${TEXT_MUTED}`}>
                            {t.count} mov. · <b className={`font-outfit ${TEXT_STRONG}`}>{fmt(t.sum_expense)}</b>
                          </span>
                        )}
                      </div>
                    )}
                    {mg.days.map((g) => (
                      <TxDayGroup key={g.date} label={g.label} total={fmt(g.expenseTotal)}>
                        {g.rows.map((tx) => (
                          <SwipeRow
                            key={tx.id}
                            row={txRowData(tx, fmt)}
                            isOpen={openRowId === tx.id}
                            anyOpen={openRowId !== null}
                            flash={sheets.flashFor(tx.id)}
                            onOpenChange={(open) => setOpenRowId(open ? tx.id : null)}
                            onSelect={() => { setOpenRowId(null); sheets.openDetail(tx.id); }}
                            onChange={() => { setOpenRowId(null); sheets.openCategory(tx.id); }}
                            onDelete={() => { setOpenRowId(null); sheets.deleteTx(tx); }}
                            onSwiped={markSwiped}
                          />
                        ))}
                      </TxDayGroup>
                    ))}
                  </section>
                );
              })}
              {loadingMore ? (
                <SkeletonRows count={2} />
              ) : hasMore && (
                <button type="button" onClick={() => void loadMore()} className="btn-outline w-full">
                  Ver más{remaining ? ` (${remaining})` : ''}
                </button>
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

      {importing && householdId && (
        <StatementImportFlow
          householdId={householdId}
          onDone={() => setImporting(false)}
          onChanged={reload}
        />
      )}

      <BottomSheet themed open={!!periodSheet} onClose={() => setPeriodSheet(null)} label={periodSheet === 'search' ? 'Dónde buscar' : 'Elegir periodo'}>
        {periodSheet === 'browse' && (
          <OptionSheet
            title="¿Qué periodo quieres ver?"
            options={periodOptions(month)}
            selected={month}
            onSelect={(m) => { setMonth(m); setPeriodSheet(null); }}
          />
        )}
        {periodSheet === 'search' && (
          <OptionSheet
            title="¿Dónde buscar?"
            options={periodOptions(searchScope)}
            selected={searchScope}
            onSelect={(m) => { setSearchScope(m); setPeriodSheet(null); }}
          />
        )}
      </BottomSheet>

      {sheets.element}

      <ApplePaySheet
        txId={applePayId}
        householdId={householdId}
        categories={categories}
        onClose={closeApplePay}
        onError={showError}
        onSaved={({ id, date }) => {
          setMonth(date.slice(0, 7));
          flash(id, true);
          reload();
        }}
      />
    </AppShell>
  );
}
