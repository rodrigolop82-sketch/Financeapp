'use client';

import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import type { DailySpend } from '@/lib/resumen/daily-spend';
import { CARD } from './ctf-ui';

/** F10: gasto promedio por día y días sin gasto (solo días completos). */
export function GastoDiario({ data, fmt }: { data: DailySpend; fmt: (n: number) => string }) {
  if (!data.enough) {
    return (
      <section aria-label="Gasto por día" className={`mt-3 px-4 py-3.5 ${CARD}`}>
        <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Aún no hay suficientes días para calcularlo</span>
      </section>
    );
  }
  const days = data.daysWithoutSpend;
  return (
    <section aria-label="Gasto por día" className="mt-3 grid grid-cols-2 gap-3">
      <div className={`flex flex-col gap-1 px-4 py-3.5 ${CARD}`}>
        <span className={`text-[13px] ${TEXT_MUTED}`}>Gastas en promedio</span>
        <span className={`font-outfit text-[22px] font-bold leading-tight ${TEXT_STRONG}`}>{fmt(data.avgPerDay)}</span>
        <span className={`text-[13px] ${TEXT_MUTED}`}>al día</span>
      </div>
      <div className={`flex flex-col gap-1 px-4 py-3.5 ${CARD}`}>
        <span className={`text-[13px] ${TEXT_MUTED}`}>{days === 1 ? 'Día sin gastar' : 'Días sin gastar'}</span>
        <span className={`font-outfit text-[22px] font-bold leading-tight ${TEXT_STRONG}`}>{days}</span>
        <span className={`text-[13px] ${TEXT_MUTED}`}>de {data.completeDays} días completos</span>
      </div>
    </section>
  );
}
