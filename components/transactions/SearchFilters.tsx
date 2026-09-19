'use client';

import type { BudgetCategory } from '@/types';

interface SearchFiltersProps {
  period: string;
  onPeriodChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  amount: string;
  onAmountChange: (v: string) => void;
  categories: BudgetCategory[];
  periodHighlighted: boolean;
}

export function SearchFilters({
  period,
  onPeriodChange,
  category,
  onCategoryChange,
  amount,
  onAmountChange,
  categories,
  periodHighlighted,
}: SearchFiltersProps) {
  const base =
    'h-10 appearance-none rounded-full border bg-white pl-3.5 pr-8 text-sm font-medium text-ink-700 focus:outline-none focus:ring-2 focus:ring-electric-pale focus:border-electric-pale flex-none';
  const normal = 'border-ink-200';
  const active = 'border-electric-pale bg-electric-ghost/30';

  const chevron =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%2394A3B8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E\")";

  const selectStyle = {
    backgroundImage: chevron,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  } as const;

  return (
    <div
      className="flex gap-2 overflow-x-auto py-2 -mx-1 px-1"
      style={{ scrollbarWidth: 'none' }}
    >
      <style>{`.search-filters::-webkit-scrollbar{display:none}`}</style>
      <select
        aria-label="Periodo"
        value={period}
        onChange={(e) => onPeriodChange(e.target.value)}
        className={`search-filters ${base} ${periodHighlighted ? active : normal}`}
        style={selectStyle}
      >
        <option value="month">Este mes</option>
        <option value="3m">Últimos 3 meses</option>
        <option value="6m">Últimos 6 meses</option>
        <option value="all">Todos los meses</option>
      </select>
      <select
        aria-label="Categoría"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className={`${base} ${category !== 'all' ? active : normal}`}
        style={selectStyle}
      >
        <option value="all">Todas las categorías</option>
        <optgroup label="Necesidades">
          {categories
            .filter((c) => c.bucket === 'needs')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="Gustos">
          {categories
            .filter((c) => c.bucket === 'wants')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="Ahorro/Deudas">
          {categories
            .filter((c) => c.bucket === 'savings')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
        </optgroup>
      </select>
      <select
        aria-label="Monto"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        className={`${base} ${amount !== 'any' ? active : normal}`}
        style={selectStyle}
      >
        <option value="any">Cualquier monto</option>
        <option value="lt100">Menos de Q 100</option>
        <option value="mid">Q 100 a Q 500</option>
        <option value="gt500">Más de Q 500</option>
      </select>
    </div>
  );
}
