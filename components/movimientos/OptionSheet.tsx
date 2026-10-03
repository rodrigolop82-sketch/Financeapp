'use client';

import { dayLabel, recentDays } from '@/lib/movimientos';
import { BORDER, DIVIDER, SHEET_TITLE, TEXT_STRONG } from './ui';

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionSheetProps<T extends string> {
  title: string;
  options: Option<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  /** Fila extra al final de la lista (por ejemplo "Otra fecha…"). */
  footer?: React.ReactNode;
}

/** Contenido de hoja: lista simple con ✓ en la opción elegida. */
export function OptionSheet<T extends string>({ title, options, selected, onSelect, footer }: OptionSheetProps<T>) {
  return (
    <div className="flex flex-col gap-3.5 px-5 pt-1.5 pb-[calc(30px+env(safe-area-inset-bottom))] overflow-y-auto">
      <h2 tabIndex={-1} className={SHEET_TITLE}>{title}</h2>
      <div role="listbox" aria-label={title} className={`rounded-2xl border overflow-hidden ${BORDER}`}>
        {options.map((o) => {
          const active = o.value === selected;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(o.value)}
              className={`flex w-full items-center px-4 h-14 border-b last:border-b-0 text-left ${DIVIDER} ${
                active ? 'bg-[#EFF6FF] dark:bg-electric/15' : 'hover:bg-[var(--zafi-hover)]'
              }`}
            >
              <span className={`flex-1 font-semibold text-[15px] ${TEXT_STRONG}`}>{o.label}</span>
              {active && <span aria-hidden className="text-electric font-bold text-base">✓</span>}
            </button>
          );
        })}
        {footer}
      </div>
    </div>
  );
}

interface DateSheetProps {
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  title?: string;
}

/** Los últimos 7 días y "Otra fecha…", que abre el selector nativo. */
export function DateSheet({ today, selected, onSelect, title = '¿Qué día fue?' }: DateSheetProps) {
  const days = recentDays(today, 7);
  const options = days.map((d) => ({ value: d, label: dayLabel(d, today) }));
  const isOther = !days.includes(selected);
  return (
    <OptionSheet
      title={title}
      options={options}
      selected={isOther ? null : selected}
      onSelect={onSelect}
      footer={
        // El input cubre toda la fila para que el selector nativo abra al
        // tocar en cualquier navegador (iOS no soporta showPicker en todas
        // las versiones).
        <label className={`relative flex w-full items-center px-4 h-14 cursor-pointer ${
          isOther ? 'bg-[#EFF6FF] dark:bg-electric/15' : 'hover:bg-[var(--zafi-hover)]'
        }`}>
          <span className={`flex-1 font-semibold text-[15px] ${TEXT_STRONG}`}>
            {isOther ? dayLabel(selected, today) : 'Otra fecha…'}
          </span>
          {isOther && <span aria-hidden className="text-electric font-bold text-base">✓</span>}
          <input
            type="date"
            aria-label="Otra fecha"
            max={today}
            value={selected}
            onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      }
    />
  );
}
