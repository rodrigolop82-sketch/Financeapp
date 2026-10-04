'use client';

import {
  bucketShares, bucketsInsight, fixedVarInsight, fixedVarShares, shortMonth, type MonthTotals,
} from '@/lib/como-te-fue';
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { AMBER_TEXT, CARD_LG, NAVY_BG, SECTION_TITLE } from './ctf-ui';

/** Debajo de este % el segmento es muy bajo para que quepa la etiqueta. */
const MIN_LABEL_PCT = 9;

interface Segment {
  key: string;
  pct: number;
  className: string;
  label: string;
}

function Column({ month, segments, current, height = 100, top }: {
  month: string; segments: Segment[]; current: boolean; height?: number; top?: string;
}) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
      <div className="flex w-full flex-1 flex-col items-center justify-end gap-1">
        {top && <span className={`text-[10.5px] font-bold ${TEXT_MUTED}`}>{top}</span>}
        <div
          className={`flex w-full flex-col overflow-hidden rounded-md ${current ? 'ring-2 ring-ink-900 ring-offset-1 ring-offset-[var(--zafi-card)] dark:ring-ink-100' : ''}`}
          style={{ height: `${height}%` }}
        >
          {segments.map((s) => (
            <div
              key={s.key}
              className={`flex items-center justify-center text-[10.5px] font-bold ${s.className}`}
              style={{ flexGrow: s.pct, flexBasis: 0 }}
              title={`${s.label} ${s.pct}%`}
            >
              {s.pct >= MIN_LABEL_PCT ? `${s.pct}%` : ''}
            </div>
          ))}
        </div>
      </div>
      <span className={`text-[11.5px] font-semibold ${current ? TEXT_STRONG : TEXT_MUTED}`}>{shortMonth(month)}</span>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-ink-700 dark:text-ink-200">
      <span aria-hidden className={`h-[9px] w-[9px] flex-none rounded-[3px] ${className}`} />
      {label}
    </span>
  );
}

const NEEDS = `${NAVY_BG} text-white`;
const WANTS = 'bg-electric-pale text-ink-900';
const SAVE = 'bg-success-dark text-white';

/** "¿A dónde se va tu dinero?": barras 100 % de 6 meses con 50/30/20. */
export function BucketsChart({ series }: { series: MonthTotals[] }) {
  const last = series[series.length - 1];
  const now = bucketShares(last);
  const ideal = [
    { key: 'needs', label: 'Necesidades', className: NAVY_BG, value: now?.needs ?? 0, ideal: 50, bad: () => false },
    { key: 'wants', label: 'Gustos', className: 'bg-electric-pale', value: now?.wants ?? 0, ideal: 30, bad: () => false },
    { key: 'savings', label: 'Ahorro', className: 'bg-success-dark', value: now?.savings ?? 0, ideal: 20, bad: (v: number) => v < 20 },
  ];
  const described = series.map((t) => {
    const s = bucketShares(t);
    return s ? `${shortMonth(t.month)}: necesidades ${s.needs}%, gustos ${s.wants}%, ahorro ${s.savings}%` : `${shortMonth(t.month)}: sin datos`;
  }).join('; ');

  return (
    <section aria-label="¿A dónde se va tu dinero?" className={`mt-[22px] flex flex-col gap-3 px-4 py-[18px] ${CARD_LG}`}>
      <div className="flex flex-col gap-0.5">
        <h2 className={SECTION_TITLE}>¿A dónde se va tu dinero?</h2>
        <p className={`text-sm leading-[1.4] [text-wrap:pretty] ${TEXT_MUTED}`}>{bucketsInsight(series)}</p>
      </div>
      <div className="flex h-[150px] gap-2.5" role="img" aria-label={described}>
        {series.map((t, i) => {
          const s = bucketShares(t);
          return (
            <Column
              key={t.month}
              month={t.month}
              current={i === series.length - 1}
              height={s ? 100 : 0}
              segments={s ? [
                { key: 'savings', pct: s.savings, className: SAVE, label: 'Ahorro' },
                { key: 'wants', pct: s.wants, className: WANTS, label: 'Gustos' },
                { key: 'needs', pct: s.needs, className: NEEDS, label: 'Necesidades' },
              ] : []}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ideal.map((x) => (
          <div key={x.key} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-[var(--zafi-bg)] p-2.5">
            <Legend className={x.className} label={x.label} />
            <span className={`font-outfit text-[17px] font-bold ${x.bad(x.value) ? AMBER_TEXT : TEXT_STRONG}`}>{now ? `${x.value}%` : '—'}</span>
            <span className={`text-[11.5px] ${TEXT_MUTED}`}>ideal {x.ideal}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "Fijos vs variables": barras de 6 meses con % adentro y total arriba. */
export function FixedVarChart({ series, fixedNames, variableNames, fmt }: {
  series: MonthTotals[];
  /** Categorías fijas y variables con más gasto del mes (para las tarjetas). */
  fixedNames: string[];
  variableNames: string[];
  fmt: (n: number, o?: { compact?: boolean }) => string;
}) {
  const last = series[series.length - 1];
  const max = Math.max(1, ...series.map((t) => t.spent));
  const now = fixedVarShares(last);
  const described = series.map((t) => {
    const s = fixedVarShares(t);
    return s ? `${shortMonth(t.month)}: ${fmt(t.spent)}, fijos ${s.fixed}%, variables ${s.variable}%` : `${shortMonth(t.month)}: sin gastos`;
  }).join('; ');
  const list = (names: string[]) => (names.length ? ` · ${names.map((n) => n.toLowerCase()).join(', ')}` : '');

  return (
    <section aria-label="Fijos vs variables" className={`mt-3 flex flex-col gap-3 px-4 py-[18px] ${CARD_LG}`}>
      <div className="flex flex-col gap-0.5">
        <h2 className={SECTION_TITLE}>Fijos vs variables</h2>
        <p className={`text-sm leading-[1.4] [text-wrap:pretty] ${TEXT_MUTED}`}>{fixedVarInsight(series, fmt)}</p>
      </div>
      <div className="flex h-[150px] gap-2.5" role="img" aria-label={described}>
        {series.map((t) => {
          const s = fixedVarShares(t);
          return (
            <Column
              key={t.month}
              month={t.month}
              current={false}
              height={s ? (t.spent / max) * 82 : 0}
              top={s ? fmt(t.spent, { compact: true }).replace(' ', '') : undefined}
              segments={s ? [
                { key: 'variable', pct: s.variable, className: 'bg-warning text-ink-900', label: 'Variables' },
                { key: 'fixed', pct: s.fixed, className: NEEDS, label: 'Fijos' },
              ] : []}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-warning-light px-3 py-2.5 dark:bg-warning/15">
          <span className="flex items-center gap-1.5 text-[12.5px] text-warning-text dark:text-warning">
            <span aria-hidden className="h-[9px] w-[9px] rounded-[3px] bg-warning" />Variables
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className={`font-outfit text-lg font-bold ${TEXT_STRONG}`}>{fmt(last.variable)}</span>
            <span className={`font-outfit text-sm font-bold ${AMBER_TEXT}`}>{now ? `${now.variable}%` : ''}</span>
          </span>
          <span className="text-xs text-warning-text dark:text-warning">del total{list(variableNames)}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-[var(--zafi-bg)] px-3 py-2.5">
          <Legend className={NAVY_BG} label="Fijos" />
          <span className="flex items-baseline gap-1.5">
            <span className={`font-outfit text-lg font-bold ${TEXT_STRONG}`}>{fmt(last.fixed)}</span>
            <span className={`font-outfit text-sm font-bold ${TEXT_MUTED}`}>{now ? `${now.fixed}%` : ''}</span>
          </span>
          <span className={`text-xs ${TEXT_MUTED}`}>del total{list(fixedNames)}</span>
        </div>
      </div>
    </section>
  );
}
