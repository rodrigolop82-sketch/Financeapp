'use client';

import type { BudgetCategory } from '@/types';

const CATEGORY_EMOJI: Record<string, string> = {
  'Vivienda/alquiler': '🏠',
  'Alimentación': '🛒',
  'Transporte': '🚗',
  'Salud/medicinas': '💊',
  'Servicios': '💡',
  'Educación': '📚',
  'Restaurantes y salidas': '🍽️',
  'Ropa': '👕',
  'Entretenimiento': '🎬',
  'Suscripciones': '📱',
  'Varios personales': '🛍️',
  'Fondo de emergencia': '🛡️',
  'Ahorro para metas': '🎯',
  'Pago extra de deudas': '💳',
};

function getEmoji(cat: BudgetCategory): string {
  if (cat.icon) return cat.icon;
  return (
    CATEGORY_EMOJI[cat.name] ||
    (cat.bucket === 'needs' ? '📦' : cat.bucket === 'wants' ? '✨' : '💰')
  );
}

interface CategoryGridProps {
  categories: BudgetCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CategoryGrid({
  categories,
  selectedId,
  onSelect,
}: CategoryGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map((cat) => {
        const active = cat.id === selectedId;
        return (
          <label key={cat.id} className="relative cursor-pointer">
            <input
              type="radio"
              name="category"
              value={cat.id}
              checked={active}
              onChange={() => onSelect(cat.id)}
              className="sr-only peer"
            />
            <span
              className={`flex flex-col items-center justify-center gap-1 h-[78px] px-1 rounded-[14px] border text-center text-xs font-medium leading-tight transition-colors ${
                active
                  ? 'border-electric bg-electric-ghost/30 font-bold'
                  : 'border-ink-200 bg-white hover:border-ink-400'
              } peer-focus-visible:ring-2 peer-focus-visible:ring-electric-pale peer-focus-visible:ring-offset-2`}
            >
              <span className="text-[22px]" aria-hidden="true">
                {getEmoji(cat)}
              </span>
              <span className="truncate w-full">{cat.name}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
