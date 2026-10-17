'use client';

import { CARD_BG, DIVIDER, TEXT_MUTED, TEXT_STRONG } from './ui';

interface MonthSummaryProps {
  spent: string | null;
  received: string | null;
  /** El periodo no tiene ingresos registrados: "Falta registrar". */
  missingIncome?: boolean;
  /** Lo que se fue a Ahorro y deudas (fuera de "Gastaste"). */
  apartado?: number;
  onRegisterIncome?: () => void;
  /** "Gastaste" o "Gastaste en 2026". */
  spentLabel?: string;
  fmt?: (n: number) => string;
}

/** Tarjeta "Gastaste / Ingresos recibidos" del periodo elegido (lib/metricas-mes). */
export function MonthSummary({ spent, received, missingIncome = false, apartado = 0, onRegisterIncome, spentLabel = 'Gastaste', fmt }: MonthSummaryProps) {
  return (
    <div className={`rounded-2xl overflow-hidden border border-navy/[0.08] dark:border-white/[0.06] ${CARD_BG}`}>
      <div className="grid grid-cols-2">
        <div className={`flex flex-col px-4 py-3.5 border-r ${DIVIDER}`}>
          <span className={`text-[13px] ${TEXT_MUTED}`}>{spentLabel}</span>
          <span className={`font-outfit font-bold text-[21px] leading-tight ${TEXT_STRONG}`}>{spent ?? '—'}</span>
        </div>
        <div className="flex flex-col px-4 py-3.5">
          <span className={`text-[13px] ${TEXT_MUTED}`}>Ingresos recibidos</span>
          <span className="font-outfit font-bold text-[21px] leading-tight text-success-dark">{received ?? '—'}</span>
          {missingIncome && (
            onRegisterIncome ? (
              <button type="button" onClick={onRegisterIncome} className="mt-0.5 self-start text-[12.5px] font-semibold text-warning-text dark:text-warning">
                Falta registrar · <span className="text-electric">Registrar ingreso ›</span>
              </button>
            ) : (
              <span className="mt-0.5 text-[12.5px] font-semibold text-warning-text dark:text-warning">Falta registrar</span>
            )
          )}
        </div>
      </div>
      {apartado > 0 && fmt && (
        <div className={`flex items-center justify-between border-t px-4 py-2.5 text-[13px] ${DIVIDER}`}>
          <span className={TEXT_MUTED}>A ahorro y deudas (no cuenta como gasto)</span>
          <span className={`font-outfit font-bold ${TEXT_STRONG}`}>{fmt(apartado)}</span>
        </div>
      )}
    </div>
  );
}
