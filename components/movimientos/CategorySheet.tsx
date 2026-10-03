'use client';

import { useState } from 'react';
import type { BudgetCategory } from '@/types';
import { CategoryGrid } from '@/components/transactions/CategoryGrid';
import { BUCKET_GROUPS, categoryQuestion } from '@/lib/categories-ui';
import { BORDER, PRIMARY_BUTTON, SHEET_TITLE, SOFT_BG, TEXT_BODY, TEXT_MUTED, TEXT_STRONG } from './ui';

interface CategorySheetProps {
  categories: BudgetCategory[];
  /** Tipo actual del movimiento: decide qué grupos se muestran. */
  type: 'expense' | 'income';
  /** Línea bajo el título, por ejemplo "Uber · Q 38.00". */
  subtitle: string;
  initialCategoryId: string | null;
  /** Cuántos otros movimientos del mismo comercio cambiarían (0 oculta el interruptor). */
  othersCount?: (categoryId: string) => number;
  merchantName?: string;
  saving?: boolean;
  error?: string | null;
  /** Se llama con la categoría elegida, el tipo que implica y si aplica a los otros. */
  onSave: (categoryId: string, type: 'expense' | 'income', applyToOthers: boolean) => void;
}

/** Contenido de hoja: cuadrícula de categorías agrupadas por bucket. */
export function CategorySheet({
  categories,
  type,
  subtitle,
  initialCategoryId,
  othersCount,
  merchantName,
  saving,
  error,
  onSave,
}: CategorySheetProps) {
  const [draft, setDraft] = useState<string | null>(initialCategoryId);
  const [showType, setShowType] = useState<'expense' | 'income'>(type);
  const [applyAll, setApplyAll] = useState(true);

  const draftCat = categories.find((c) => c.id === draft);
  const draftType: 'expense' | 'income' = draftCat ? (draftCat.bucket === 'income' ? 'income' : 'expense') : type;
  const groups = BUCKET_GROUPS.filter((g) => (showType === 'income') === (g.bucket === 'income'))
    .map((g) => ({ ...g, items: categories.filter((c) => c.bucket === g.bucket && !c.archived_at) }))
    .filter((g) => g.items.length > 0);
  const n = draft && othersCount ? othersCount(draft) : 0;

  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5 pb-[calc(30px+env(safe-area-inset-bottom))] overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        <h2 tabIndex={-1} className={SHEET_TITLE}>{categoryQuestion(showType)}</h2>
        {subtitle && <p className={`text-sm ${TEXT_MUTED}`}>{subtitle}</p>}
      </div>

      {groups.map((g) => (
        <section key={g.bucket} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className={`font-bold text-sm ${TEXT_STRONG}`}>{g.title}</h3>
            <span className={`text-[12.5px] ${TEXT_MUTED}`}>{g.hint}</span>
          </div>
          <CategoryGrid themed name="category-sheet" categories={g.items} selectedId={draft ?? ''} onSelect={setDraft} />
        </section>
      ))}

      <button
        type="button"
        onClick={() => setShowType(showType === 'income' ? 'expense' : 'income')}
        className="self-start text-sm font-semibold text-electric min-h-[44px]"
      >
        {showType === 'income' ? '¿Era un gasto?' : '¿Era un ingreso?'}
      </button>

      {n > 0 && (
        <button
          type="button"
          role="switch"
          aria-checked={applyAll}
          onClick={() => setApplyAll(!applyAll)}
          className={`flex items-center gap-3 p-3.5 rounded-[14px] border text-left ${SOFT_BG} ${BORDER}`}
        >
          <span className={`flex-1 text-sm leading-snug ${TEXT_BODY}`}>
            Cambiar también los otros <b>{n} de “{merchantName}”</b>
          </span>
          <span
            aria-hidden
            className={`relative flex-none w-[46px] h-7 rounded-full transition-colors ${applyAll ? 'bg-electric' : 'bg-ink-200 dark:bg-white/20'}`}
          >
            <span
              className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-[left]"
              style={{ left: applyAll ? 21 : 3 }}
            />
          </span>
        </button>
      )}

      {error && <p role="alert" className="text-sm text-danger-text bg-danger-light rounded-xl px-3 py-2">{error}</p>}

      <button
        type="button"
        disabled={!draft || saving}
        onClick={() => draft && onSave(draft, draftType, n > 0 && applyAll)}
        className={PRIMARY_BUTTON}
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}
