'use client';

import { BORDER, TEXT_BODY, TEXT_MUTED } from './ui';

export interface SubItemOption {
  id: string;
  category_id: string;
  name: string;
}

interface SubItemPickerProps {
  /** Partes de la categoría elegida. */
  options: SubItemOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Estilo del título: el de un campo (13px gris) o el de una sección (14px negrita). */
  variant?: 'field' | 'section';
}

/** "¿De qué parte?": pills con las partes de la categoría (Plan del mes). */
export function SubItemPicker({ options, selectedId, onSelect, variant = 'field' }: SubItemPickerProps) {
  if (options.length === 0) return null;
  return (
    <div role="radiogroup" aria-label="¿De qué parte?" className="flex flex-col gap-2">
      <span
        className={variant === 'section'
          ? 'font-bold text-sm text-ink-900 dark:text-ink-100'
          : `text-[13px] font-semibold ${TEXT_MUTED}`}
      >
        ¿De qué parte?
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.id === selectedId;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(o.id)}
              className={`h-10 px-3.5 rounded-full border-[1.5px] text-sm font-semibold transition-[color,background-color,border-color,transform] [transition-duration:250ms] ease-spring active:scale-[0.96] ${
                on
                  ? 'border-electric bg-[#EFF6FF] text-electric-dark dark:bg-electric/20 dark:text-electric-pale motion-safe:scale-[1.05]'
                  : `${BORDER} bg-[var(--zafi-card)] ${TEXT_BODY}`
              }`}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
