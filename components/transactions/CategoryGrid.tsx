'use client';

import type { ReactNode } from 'react';
import type { BudgetCategory } from '@/types';
import { getEmoji } from '@/lib/categories-ui';

interface CategoryGridProps {
  categories: BudgetCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Nombre del grupo de radios; usa el mismo en grillas que comparten selección. */
  name?: string;
  /** Casilla extra al final (por ejemplo "··· Más"). */
  trailing?: ReactNode;
  /** Colores según el tema; por defecto asume una hoja blanca. */
  themed?: boolean;
}

export const CATEGORY_TILE_CLASS =
  'flex flex-col items-center justify-center gap-[3px] h-[72px] px-0.5 rounded-[14px] border-[1.5px] text-center transition-colors';

export function CategoryGrid({
  categories,
  selectedId,
  onSelect,
  name = 'category',
  trailing,
  themed = false,
}: CategoryGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map((cat) => {
        const active = cat.id === selectedId;
        return (
          <label key={cat.id} className="relative cursor-pointer min-w-0">
            <input
              type="radio"
              name={name}
              value={cat.id}
              checked={active}
              onChange={() => onSelect(cat.id)}
              onClick={() => { if (active) onSelect(cat.id); }}
              className="sr-only peer"
            />
            <span
              className={`${CATEGORY_TILE_CLASS} ${
                active
                  ? themed
                    ? 'border-electric bg-[#EFF6FF] dark:bg-electric/20'
                    : 'border-electric bg-[#EFF6FF]'
                  : themed
                    ? 'border-ink-100 dark:border-white/10 bg-[var(--zafi-card)] hover:border-ink-400'
                    : 'border-ink-100 bg-white hover:border-ink-400'
              } peer-focus-visible:ring-2 peer-focus-visible:ring-electric-pale peer-focus-visible:ring-offset-2`}
            >
              <span className="text-[21px] leading-none" aria-hidden="true">
                {getEmoji(cat)}
              </span>
              <span className={`truncate w-full text-[11.5px] font-semibold ${themed ? 'text-ink-700 dark:text-ink-200' : 'text-ink-700'}`}>{cat.name}</span>
            </span>
          </label>
        );
      })}
      {trailing}
    </div>
  );
}
