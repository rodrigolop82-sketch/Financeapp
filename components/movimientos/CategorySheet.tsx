'use client';

import { useState } from 'react';
import type { BudgetCategory } from '@/types';
import { CategoryGrid } from '@/components/transactions/CategoryGrid';
import { BUCKET_GROUPS, categoryQuestion } from '@/lib/categories-ui';
import { SubItemPicker, type SubItemOption } from './SubItemPicker';
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
  /** Partes del Plan del mes: si la categoría elegida tiene, hay que elegir una. */
  subItems?: SubItemOption[];
  initialSubItemId?: string | null;
  /** Se intentó guardar sin elegir la parte. */
  onMissingSubItem?: () => void;
  /** Se llama con la categoría elegida, el tipo que implica, si aplica a los otros y la parte. */
  onSave: (categoryId: string, type: 'expense' | 'income', applyToOthers: boolean, subItemId: string | null) => void;
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
  subItems = [],
  initialSubItemId = null,
  onMissingSubItem,
  onSave,
}: CategorySheetProps) {
  const [draft, setDraft] = useState<string | null>(initialCategoryId);
  const [subDraft, setSubDraft] = useState<string | null>(initialSubItemId);
  const [showType, setShowType] = useState<'expense' | 'income'>(type);
  const [applyAll, setApplyAll] = useState(true);

  const draftCat = categories.find((c) => c.id === draft);
  const draftType: 'expense' | 'income' = draftCat ? (draftCat.bucket === 'income' ? 'income' : 'expense') : type;
  const groups = BUCKET_GROUPS.filter((g) => (showType === 'income') === (g.bucket === 'income'))
    .map((g) => ({ ...g, items: categories.filter((c) => c.bucket === g.bucket && !c.archived_at) }))
    .filter((g) => g.items.length > 0);
  const n = draft && othersCount ? othersCount(draft) : 0;
  const parts = draft ? subItems.filter((p) => p.category_id === draft) : [];
  const sub = parts.some((p) => p.id === subDraft) ? subDraft : null;
  const missingSub = parts.length > 0 && !sub;

  function pickCategory(id: string) {
    setDraft(id);
    if (id !== draft) setSubDraft(null);
  }

  function save() {
    if (!draft) return;
    if (missingSub) { onMissingSubItem?.(); return; }
    onSave(draft, draftType, n > 0 && applyAll, sub);
  }

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
          <CategoryGrid themed name="category-sheet" categories={g.items} selectedId={draft ?? ''} onSelect={pickCategory} />
        </section>
      ))}

      <SubItemPicker variant="section" options={parts} selectedId={sub} onSelect={setSubDraft} />

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
        aria-disabled={missingSub}
        onClick={save}
        className={missingSub
          ? 'h-[54px] w-full rounded-[14px] font-semibold text-base bg-ink-100 text-ink-400 dark:bg-white/10'
          : PRIMARY_BUTTON}
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}
