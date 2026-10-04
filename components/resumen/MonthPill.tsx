'use client';

import { BORDER, TEXT_STRONG } from '@/components/movimientos/ui';

interface MonthPillProps {
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** Selector de mes "‹ Septiembre ›". */
export function MonthPill({ label, canPrev, canNext, onPrev, onNext }: MonthPillProps) {
  const arrow = 'flex h-11 w-9 items-center justify-center text-lg font-bold disabled:text-ink-200 dark:disabled:text-white/20 text-ink-500 dark:text-ink-400';
  return (
    <div className={`flex flex-none items-center rounded-full border bg-[var(--zafi-card)] px-0.5 ${BORDER}`}>
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="Mes anterior" className={arrow}>‹</button>
      <span aria-live="polite" className={`min-w-[84px] text-center text-sm font-semibold ${TEXT_STRONG}`}>{label}</span>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label="Mes siguiente" className={arrow}>›</button>
    </div>
  );
}
