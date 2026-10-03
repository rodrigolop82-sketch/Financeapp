'use client';

import { Search, X } from 'lucide-react';
import { BORDER, CARD_BG, TEXT_BODY, TEXT_STRONG } from './ui';

export type TypeFilter = 'all' | 'expense' | 'income';

const CHIPS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
];

interface MovimientosSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  type: TypeFilter;
  onTypeChange: (t: TypeFilter) => void;
}

/** Búsqueda por nombre o categoría y chips Todo / Gastos / Ingresos. */
export function MovimientosSearch({ query, onQueryChange, type, onTypeChange }: MovimientosSearchProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className={`flex items-center gap-2 h-[46px] pl-4 pr-2 rounded-full border ${BORDER} ${CARD_BG}`}>
        <Search size={16} className="flex-none text-ink-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar “super”, “uber”…"
          aria-label="Buscar movimientos"
          enterKeyHint="search"
          className={`flex-1 min-w-0 h-full bg-transparent outline-none text-[15px] placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden ${TEXT_STRONG}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Borrar búsqueda"
            className="flex-none flex items-center justify-center w-[30px] h-[30px] rounded-full text-ink-400 hover:bg-[var(--zafi-hover)]"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label="Tipo de movimiento" className="flex gap-1.5">
        {CHIPS.map((c) => {
          const active = c.value === type;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onTypeChange(c.value)}
              className={`h-9 px-[15px] rounded-full text-[13.5px] font-semibold border transition-colors ${
                active ? 'bg-navy border-navy text-white dark:bg-electric dark:border-electric' : `${CARD_BG} ${BORDER} ${TEXT_BODY}`
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
