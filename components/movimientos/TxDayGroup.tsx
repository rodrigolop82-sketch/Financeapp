'use client';

import type { ReactNode } from 'react';
import { TEXT_MUTED } from './ui';

interface TxDayGroupProps {
  label: string;
  /** Total de gastos del día ya formateado. */
  total: string;
  children: ReactNode;
}

/** Encabezado de día ("Hoy", "Ayer", "Lunes 29") y sus filas. */
export function TxDayGroup({ label, total, children }: TxDayGroupProps) {
  return (
    <section className="flex flex-col gap-[5px]">
      <h2 className={`flex justify-between px-1 pb-0.5 text-[13px] font-semibold ${TEXT_MUTED}`}>
        <span>{label}</span>
        <span>{total}</span>
      </h2>
      {children}
    </section>
  );
}
