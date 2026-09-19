'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { formatMonthRange } from '@/lib/transactions/reclassify';

const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function fmtShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const monthIdx = Number(parts[1]) - 1;
  return `${Number(parts[2])} ${MONTHS_SHORT[monthIdx]}`;
}

interface MatchItem {
  id: string;
  description: string | null;
  date: string;
  amount: string | number;
  category_source: string;
}

interface ReclassifySheetProps {
  open: boolean;
  merchantName: string;
  newCategoryName: string;
  matches: MatchItem[];
  defaultSelectedIds: string[];
  truncated: boolean;
  saving: boolean;
  onConfirm: (selectedIds: string[], remember: boolean) => void;
  onSingleOnly: (remember: boolean) => void;
  onClose: () => void;
  fmt: (amount: number) => string;
}

export function ReclassifySheet({
  open,
  merchantName,
  newCategoryName,
  matches,
  defaultSelectedIds,
  truncated,
  saving,
  onConfirm,
  onSingleOnly,
  onClose,
  fmt,
}: ReclassifySheetProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelectedIds));
  const [showList, setShowList] = useState(false);
  const [remember, setRemember] = useState(false);

  const monthRange = useMemo(
    () => formatMonthRange(matches.map((m) => m.date)),
    [matches],
  );

  const selectedCount = selected.size;

  function toggleId(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedCount === matches.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(matches.map((m) => m.id)));
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 pt-2 pb-1">
        <h2
          className="font-serif text-2xl outline-none"
          tabIndex={-1}
        >
          ¿Cambiar también los demás de {merchantName}?
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        <p className="text-sm text-ink-600 leading-relaxed">
          Hay{' '}
          <span className="font-semibold">{matches.length}</span>{' '}
          {matches.length === 1 ? 'gasto' : 'gastos'} más de{' '}
          <span className="font-semibold">{merchantName}</span>{' '}
          {monthRange} que no están en{' '}
          <span className="font-semibold">{newCategoryName}</span>.
          {truncated && ' (mostrando los primeros 500)'}
        </p>

        {/* Expandable list */}
        <button
          type="button"
          onClick={() => setShowList(!showList)}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-electric hover:text-electric-dark"
        >
          Ver cuáles
          {showList
            ? <ChevronUp className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />
          }
        </button>

        {showList && (
          <div className="mt-2 space-y-0">
            {/* Select all */}
            <button
              type="button"
              onClick={toggleAll}
              className="w-full flex items-center gap-3 px-3 py-2 text-left text-xs font-semibold text-ink-500"
            >
              <span
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  selectedCount === matches.length
                    ? 'bg-electric border-electric'
                    : 'border-ink-300 bg-white'
                }`}
              >
                {selectedCount === matches.length && (
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                )}
              </span>
              {selectedCount === matches.length
                ? 'Deseleccionar todo'
                : 'Seleccionar todo'}
            </button>

            <div className="max-h-[32vh] overflow-y-auto rounded-xl border border-ink-100 divide-y divide-ink-50 bg-white">
              {matches.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-tint transition-colors"
                  >
                    <span
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked
                          ? 'bg-electric border-electric'
                          : 'border-ink-300 bg-white'
                      }`}
                    >
                      {checked && (
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleId(m.id)}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900 truncate">
                        {m.description || 'Sin descripción'}
                      </p>
                      <p className="text-xs text-ink-400">
                        {fmtShortDate(m.date)}
                      </p>
                    </div>
                    <span className="text-sm font-outfit tabular-nums text-ink-700 flex-shrink-0">
                      {fmt(Number(m.amount))}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Remember switch */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-700 leading-tight">
            Recordar <span className="font-semibold">{merchantName}</span> como{' '}
            <span className="font-semibold">{newCategoryName}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={remember}
            onClick={() => setRemember(!remember)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full flex-shrink-0 transition-colors ${
              remember ? 'bg-electric' : 'bg-ink-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                remember ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-ink-100 flex-none space-y-2">
        <button
          type="button"
          onClick={() => onConfirm(Array.from(selected), remember)}
          disabled={saving || selectedCount === 0}
          className="w-full h-[52px] rounded-[14px] bg-electric text-white font-semibold text-base disabled:bg-ink-200 disabled:text-ink-400 disabled:cursor-not-allowed hover:bg-electric-dark transition-colors"
        >
          {saving
            ? 'Guardando...'
            : `Cambiar ${selectedCount} ${selectedCount === 1 ? 'gasto' : 'gastos'}`}
        </button>
        <button
          type="button"
          onClick={() => onSingleOnly(remember)}
          disabled={saving}
          className="w-full h-[44px] rounded-[14px] text-electric font-semibold text-sm hover:bg-electric-ghost/20 transition-colors disabled:opacity-50"
        >
          Solo este
        </button>
      </div>
    </BottomSheet>
  );
}
