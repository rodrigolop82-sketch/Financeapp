'use client';

import { CARD_BG, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';

interface MonthStartNoticeProps {
  /** Inicio usa "Empieza {mes}"; Plan del mes, "Inicio de mes pendiente". */
  variant: 'home' | 'plan';
  monthName: string;
  done: boolean;
  /** "Apartaste Q x para n pagos que faltan" (solo hecho). */
  summary?: string;
  onOpen: () => void;
}

/** Aviso azul de inicio de mes pendiente, o tarjeta blanca cuando ya está hecho. */
export function MonthStartNotice({ variant, monthName, done, summary, onOpen }: MonthStartNoticeProps) {
  if (done) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`mt-3 flex w-full items-center gap-3 rounded-2xl border border-[rgba(30,58,95,0.08)] px-4 py-3.5 text-left dark:border-white/10 ${CARD_BG}`}
      >
        <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#DCFCE7] text-sm font-bold text-[#166534]">
          ✓
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <b className={`text-[14.5px] ${TEXT_STRONG}`}>Inicio de mes hecho</b>
          <span className={`text-[13.5px] ${TEXT_MUTED}`}>{summary}</span>
        </span>
        <span className="flex-none text-sm font-semibold text-electric">Revisar ›</span>
      </button>
    );
  }
  const home = variant === 'home';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-electric-ghost px-4 py-3.5 text-left dark:bg-electric/20"
    >
      <span aria-hidden className="text-[22px] leading-none">🗓️</span>
      <span className="flex flex-1 flex-col gap-0.5 text-navy dark:text-ink-100">
        <b className="text-[14.5px]">{home ? `Empieza ${monthName}` : 'Inicio de mes pendiente'}</b>
        <span className="text-[13.5px] leading-[1.4]">
          {home
            ? 'Aparta tus gastos fijos para ver lo que de verdad puedes gastar.'
            : 'Tus fijos sin pagar todavía cuentan como disponibles.'}
        </span>
      </span>
      <span className="flex-none text-sm font-semibold text-electric-dark dark:text-electric-pale">Hacer ›</span>
    </button>
  );
}
