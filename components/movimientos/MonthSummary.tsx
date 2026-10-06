'use client';

import { CARD_BG, DIVIDER, TEXT_MUTED, TEXT_STRONG } from './ui';

interface MonthSummaryProps {
  spent: string | null;
  received: string | null;
  /** "Gastaste" o "Gastaste en 2026". */
  spentLabel?: string;
}

/** Tarjeta "Gastaste / Ingresos recibidos" del periodo elegido. */
export function MonthSummary({ spent, received, spentLabel = 'Gastaste' }: MonthSummaryProps) {
  return (
    <div className={`grid grid-cols-2 rounded-2xl overflow-hidden border border-navy/[0.08] dark:border-white/[0.06] ${CARD_BG}`}>
      <div className={`flex flex-col px-4 py-3.5 border-r ${DIVIDER}`}>
        <span className={`text-[13px] ${TEXT_MUTED}`}>{spentLabel}</span>
        <span className={`font-outfit font-bold text-[21px] leading-tight ${TEXT_STRONG}`}>{spent ?? '—'}</span>
      </div>
      <div className="flex flex-col px-4 py-3.5">
        <span className={`text-[13px] ${TEXT_MUTED}`}>Ingresos recibidos</span>
        <span className="font-outfit font-bold text-[21px] leading-tight text-success-dark">{received ?? '—'}</span>
      </div>
    </div>
  );
}
