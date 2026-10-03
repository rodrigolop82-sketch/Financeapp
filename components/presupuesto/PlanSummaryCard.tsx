'use client';

import { stackedWidths, unassignedCopy, type PlanSummary } from '@/lib/plan-del-mes';

interface PlanSummaryCardProps {
  summary: PlanSummary;
  fmt: (n: number) => string;
  /** Sin categoría de destino (Fondo de emergencia) no se muestra el botón. */
  onSendToCushion?: () => void;
}

const SEGMENTS = [
  { key: 'needs', label: 'Básico', color: '#3B82F6' },
  { key: 'wants', label: 'Gustos', color: '#93C5FD' },
  { key: 'savings', label: 'Metas', color: '#22C55E' },
] as const;

/** Tarjeta navy del Plan del mes: sin asignar, barra apilada y fijos/variables. */
export function PlanSummaryCard({ summary, fmt, onSendToCushion }: PlanSummaryCardProps) {
  const un = summary.unassigned;
  const copy = unassignedCopy(un);
  const widths = stackedWidths(summary);

  return (
    <section
      aria-label="Resumen del plan"
      className="mt-3 flex flex-col gap-1.5 rounded-[20px] text-white"
      style={{ background: 'var(--zafi-hero)', padding: '20px 22px' }}
    >
      <div className="flex justify-between text-sm text-[#CBD8E8]">
        <span>Te entra al mes</span>
        <span className="font-outfit font-bold text-white">{fmt(summary.income)}</span>
      </div>
      <span className="mt-2 text-[15px] text-[#CBD8E8]">{copy.label}</span>
      <span
        className="font-outfit font-extrabold text-[46px] leading-none tracking-[-0.02em]"
        style={{ color: un < 0 ? '#FCA5A5' : '#FFFFFF' }}
      >
        {fmt(Math.abs(un))}
      </span>
      <span className="text-sm leading-[1.45] text-[#9FB3CB] [text-wrap:pretty]">{copy.hint}</span>

      <div
        className="mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-[5px] bg-[#2A4A6E]"
        role="img"
        aria-label={`Básico ${fmt(summary.needs)}, Gustos ${fmt(summary.wants)}, Metas ${fmt(summary.savings)}`}
      >
        {SEGMENTS.map((s) => (
          <span
            key={s.key}
            className="block h-full transition-[width] duration-[400ms] ease-out"
            style={{ width: `${widths[s.key]}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-[#CBD8E8]">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.label} {fmt(summary[s.key])}
          </span>
        ))}
      </div>

      <div className="mb-1 mt-3 h-px bg-white/[0.08]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-[#9FB3CB]">Gastos fijos</span>
          <span className="font-outfit font-bold text-[19px]">{fmt(summary.fixed)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-[#9FB3CB]">Gastos variables</span>
          <span className="font-outfit font-bold text-[19px]">{fmt(summary.variable)}</span>
        </div>
      </div>
      <span className="text-[13px] leading-[1.45] text-[#9FB3CB] [text-wrap:pretty]">
        Lo variable es donde puedes ajustar para ahorrar.
      </span>

      {un > 0 && onSendToCushion && (
        <button
          type="button"
          onClick={onSendToCushion}
          className="mt-3 h-[46px] rounded-xl bg-[rgba(96,165,250,0.2)] text-[14.5px] font-semibold text-white"
        >
          Mandar {fmt(un)} al Colchón
        </button>
      )}
    </section>
  );
}
