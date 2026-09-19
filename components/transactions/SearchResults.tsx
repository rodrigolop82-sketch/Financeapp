'use client';

import { Receipt, Loader2 } from 'lucide-react';
import type { SearchTransaction, SearchMonthTotal } from '@/types';
import { highlightMatch } from '@/lib/transactions/highlight';

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function fmtShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const monthIdx = Number(parts[1]) - 1;
  return `${Number(parts[2])} ${MONTHS_SHORT[monthIdx]}`;
}

interface MonthGroup {
  key: string;
  label: string;
  total: number;
  items: SearchTransaction[];
}

function groupByMonth(
  results: SearchTransaction[],
  totals: SearchMonthTotal[],
): MonthGroup[] {
  const totalsMap = new Map(totals.map((t) => [t.month, t]));
  const groups = new Map<string, SearchTransaction[]>();
  const order: string[] = [];

  for (const tx of results) {
    const key = tx.date.slice(0, 7);
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
      order.push(key);
    }
    arr.push(tx);
  }

  return order.map((key) => {
    const [y, m] = key.split('-');
    const monthIdx = Number(m) - 1;
    const total = totalsMap.get(key);
    return {
      key,
      label: `${MONTHS_ES[monthIdx]} ${y}`,
      total: total?.sum_gastos ?? 0,
      items: groups.get(key)!,
    };
  });
}

interface SearchResultsProps {
  results: SearchTransaction[];
  totals: SearchMonthTotal[];
  query: string;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelect: (tx: SearchTransaction) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  fmt: (amount: number) => string;
}

export function SearchResults({
  results,
  totals,
  query,
  loading,
  hasMore,
  onLoadMore,
  onSelect,
  onClearFilters,
  hasActiveFilters,
  fmt,
}: SearchResultsProps) {
  const trimmed = query.trim();
  const groups = groupByMonth(results, totals);
  const totalMonths = totals.length;
  const totalAmount = totals.reduce((s, t) => s + Number(t.sum_gastos), 0);
  const totalCount = totals.reduce((s, t) => s + Number(t.count), 0);

  if (loading && results.length === 0) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 text-electric-light animate-spin" />
      </div>
    );
  }

  if (results.length === 0 && !loading) {
    return (
      <div className="py-10 text-center">
        <Receipt className="w-10 h-10 text-ink-200 mx-auto mb-3" />
        <p className="font-medium text-ink-700 text-body-lg">
          {trimmed
            ? `Sin resultados para «${trimmed}»`
            : 'Sin gastos con estos filtros'}
        </p>
        <p className="text-sm text-ink-400 mt-1">
          Prueba con menos letras
          {hasActiveFilters ? ' o quita los filtros.' : '.'}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 text-sm font-semibold text-electric hover:text-electric-dark"
          >
            Quitar filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Summary line */}
      <div
        className="flex items-center justify-between px-1 py-1.5 text-xs text-ink-400"
        role="status"
        aria-live="polite"
      >
        <span>
          {trimmed
            ? `${totalCount} ${totalCount === 1 ? 'resultado' : 'resultados'} en ${totalMonths} ${totalMonths === 1 ? 'mes' : 'meses'}`
            : `${totalCount} ${totalCount === 1 ? 'movimiento' : 'movimientos'}`}
        </span>
        <span className="font-outfit tabular-nums">{fmt(totalAmount)}</span>
      </div>

      {/* Grouped results */}
      {groups.map((group) => (
        <div key={group.key} className="mb-1">
          {/* Sticky month header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-1 py-2.5 bg-surface-bg border-b border-ink-100">
            <span className="text-xs font-semibold text-ink-500">
              {group.label}
            </span>
            <span className="text-xs font-semibold text-ink-500 font-outfit tabular-nums">
              {fmt(group.total)}
            </span>
          </div>

          {/* Transaction rows */}
          <div className="bg-white rounded-xl border border-ink-100 divide-y divide-ink-50 overflow-hidden">
            {group.items.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => onSelect(tx)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-tint transition-colors"
              >
                <div className="w-11 h-11 rounded-[14px] bg-surface-bg flex items-center justify-center flex-shrink-0 text-xl">
                  {tx.category_icon || (
                    <Receipt className="w-5 h-5 text-ink-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-ink-900 truncate">
                    {highlightMatch(tx.description, trimmed)}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-ink-400">
                    <span>{fmtShortDate(tx.date)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{tx.category_name}</span>
                    {tx.category_source === 'manual' && (
                      <>
                        <span aria-hidden="true">&middot;</span>
                        <span className="text-electric font-semibold">
                          corregida por ti
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span className="font-outfit font-semibold text-[15px] tabular-nums text-ink-900 flex-shrink-0">
                  {fmt(Number(tx.amount))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Load more */}
      {hasMore && (
        <div className="py-4 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="text-sm font-semibold text-electric hover:text-electric-dark disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando...
              </span>
            ) : (
              'Cargar más'
            )}
          </button>
        </div>
      )}
    </>
  );
}
