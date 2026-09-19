'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { BudgetCategory, SearchTransaction } from '@/types';
import { BottomSheet } from './BottomSheet';
import { CategoryGrid } from './CategoryGrid';

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function fmtLongDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const day = Number(parts[2]);
  const monthIdx = Number(parts[1]) - 1;
  return `${day} de ${MONTHS_ES[monthIdx]} de ${parts[0]}`;
}

interface EditSheetProps {
  open: boolean;
  transaction: SearchTransaction | null;
  categories: BudgetCategory[];
  onSave: (categoryId: string) => void;
  onClose: () => void;
  saving: boolean;
  fmt: (amount: number) => string;
}

export function EditSheet({
  open,
  transaction,
  categories,
  onSave,
  onClose,
  saving,
  fmt,
}: EditSheetProps) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open && transaction) {
      setDraft(transaction.category_id);
    }
  }, [open, transaction?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!transaction) return null;

  const hasChanged = draft !== transaction.category_id;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex justify-between items-start gap-3 px-5 pt-2">
        <h2
          className="font-serif text-2xl text-ink-900 outline-none"
          tabIndex={-1}
        >
          Editar transacción
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-ink-400 hover:bg-ink-50"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {/* Transaction card */}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border border-ink-100 bg-surface-tint mb-5">
          <div className="min-w-0">
            <p className="font-bold text-base text-ink-900 truncate">
              {transaction.description || 'Sin descripción'}
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              {fmtLongDate(transaction.date)}
            </p>
          </div>
          <span className="font-outfit font-bold text-[22px] tabular-nums text-ink-900 flex-shrink-0">
            {fmt(Number(transaction.amount))}
          </span>
        </div>

        {/* Category grid */}
        <fieldset>
          <legend className="text-sm font-semibold text-ink-700 mb-2.5">
            Categoría{' '}
            <span className="text-ink-400 font-normal">
              · ahora: {transaction.category_name}
            </span>
          </legend>
          <CategoryGrid
            categories={categories}
            selectedId={draft}
            onSelect={setDraft}
          />
        </fieldset>
      </div>

      <div className="px-5 py-4 border-t border-ink-100 flex-none">
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={!hasChanged || saving}
          className="w-full h-[52px] rounded-[14px] bg-electric text-white font-semibold text-base disabled:bg-ink-200 disabled:text-ink-400 disabled:cursor-not-allowed hover:bg-electric-dark transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambio'}
        </button>
      </div>
    </BottomSheet>
  );
}
