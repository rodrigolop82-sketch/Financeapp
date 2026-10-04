'use client';

import type { BarTone, RowStatus, Tone } from '@/lib/plan-del-mes';
import { CARD_BG, DIVIDER, TEXT_BODY, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';

export interface PlanPartVM {
  key: string;
  name: string;
  fixed: boolean;
  amount: string;
  status: RowStatus;
  onClick: () => void;
}

export interface PlanRowVM {
  key: string;
  emoji: string;
  name: string;
  fixed: boolean;
  amount: string;
  status: RowStatus;
  /** Las metas no llevan barra. */
  hasBar: boolean;
  onClick: () => void;
  /** Solo categorías con partes. */
  parts?: PlanPartVM[];
  open?: boolean;
  onAddPart?: () => void;
  /** Resalta la fila recién guardada. */
  flash?: boolean;
}

export interface PlanGroupVM {
  key: string;
  title: string;
  hint: string;
  total: string;
  rows: PlanRowVM[];
  /** "+ Agregar ingreso" al final del grupo. */
  onAdd?: () => void;
  addLabel?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  muted: TEXT_MUTED,
  danger: 'text-danger-text dark:text-[#FCA5A5]',
  warning: 'text-warning-text dark:text-warning',
};

const BAR_CLASS: Record<BarTone, string> = {
  normal: 'bg-electric',
  warning: 'bg-warning',
  danger: 'bg-danger',
  income: 'bg-success',
};

function FixedChip({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`flex-none rounded-full bg-[var(--zafi-border-light)] font-bold text-[#475569] dark:text-ink-200 ${
        small ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-[7px] py-0.5 text-[11px]'
      }`}
    >
      Fijo
    </span>
  );
}

function Bar({ status, height, className = '' }: { status: RowStatus; height: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block overflow-hidden rounded bg-[var(--zafi-border-light)] ${className}`}
      style={{ height }}
    >
      <span
        className={`block h-full rounded transition-[width] duration-[400ms] ease-out ${BAR_CLASS[status.bar]}`}
        style={{ width: `${status.pct}%` }}
      />
    </span>
  );
}

function PlanRow({ row, last }: { row: PlanRowVM; last: boolean }) {
  const hasParts = !!row.parts;
  return (
    <div className={`flex flex-col ${last ? '' : `border-b ${DIVIDER}`} ${row.flash ? 'animate-row-flash' : ''}`}>
      <button
        type="button"
        onClick={row.onClick}
        aria-expanded={hasParts ? !!row.open : undefined}
        className="flex w-full flex-col gap-2 py-3 text-left"
      >
        <span className="flex w-full items-center gap-2.5">
          <span aria-hidden className="w-[26px] flex-none text-center text-xl leading-none">{row.emoji}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{row.name}</span>
              {row.fixed && <FixedChip />}
            </span>
            <span className={`text-[13px] ${TONE_CLASS[row.status.tone]}`}>{row.status.text}</span>
          </span>
          <span className={`flex-none font-outfit text-base font-bold ${TEXT_STRONG}`}>{row.amount}</span>
          <span
            aria-hidden
            className={`inline-block flex-none text-lg transition-transform duration-200 ease-out ${TEXT_FAINT}`}
            style={{ transform: hasParts && row.open ? 'rotate(90deg)' : 'none' }}
          >
            ›
          </span>
        </span>
        {row.hasBar && <Bar status={row.status} height={6} className="ml-9" />}
      </button>

      {hasParts && row.open && (
        <div className="mb-2 ml-9 flex flex-col border-l-2 border-[var(--zafi-border-light)] pl-3">
          {row.parts!.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={p.onClick}
              className="flex w-full flex-col gap-1.5 border-b border-[var(--zafi-bg)] py-2.5 text-left"
            >
              <span className="flex w-full items-center gap-2">
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate text-sm font-semibold ${TEXT_STRONG}`}>{p.name}</span>
                    {p.fixed && <FixedChip small />}
                  </span>
                  <span className={`text-[12.5px] ${TONE_CLASS[p.status.tone]}`}>{p.status.text}</span>
                </span>
                <span className={`flex-none font-outfit text-[14.5px] font-bold ${TEXT_BODY}`}>{p.amount}</span>
                <span aria-hidden className={`flex-none text-base ${TEXT_FAINT}`}>›</span>
              </span>
              <Bar status={p.status} height={4} />
            </button>
          ))}
          <button
            type="button"
            onClick={row.onAddPart}
            className="h-10 self-start text-sm font-semibold text-electric"
          >
            + Agregar parte
          </button>
        </div>
      )}
    </div>
  );
}

/** Grupos del Plan del mes: Ingresos, Lo básico, Gustos y Para tus metas. */
export function PlanGroups({ groups }: { groups: PlanGroupVM[] }) {
  return (
    <>
      {groups.map((g) => (
        <section key={g.key} aria-label={g.title} className="mt-[18px] flex flex-col gap-2">
          <div className="flex items-baseline gap-2 px-1">
            <h2 className={`text-[15px] font-bold ${TEXT_STRONG}`}>{g.title}</h2>
            <span className={`flex-1 text-[12.5px] ${TEXT_MUTED}`}>{g.hint}</span>
            <span className={`font-outfit text-sm font-bold ${TEXT_BODY}`}>{g.total}</span>
          </div>
          {g.rows.length > 0 && (
            <div className={`rounded-2xl border border-[rgba(30,58,95,0.08)] px-4 py-0.5 dark:border-white/10 ${CARD_BG}`}>
              {g.rows.map((r, i) => <PlanRow key={r.key} row={r} last={i === g.rows.length - 1} />)}
            </div>
          )}
          {g.onAdd && (
            <button type="button" onClick={g.onAdd} className="h-10 self-start px-1 text-sm font-semibold text-electric">
              {g.addLabel}
            </button>
          )}
        </section>
      ))}
    </>
  );
}
