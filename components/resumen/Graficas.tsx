'use client';

import { useState } from 'react';
import {
  bucketShares, bucketsInsight, fixedVarInsight, fixedVarShares, longMonth, monthLeftover, monthSaved, shortMonth,
  type MonthTotals,
} from '@/lib/como-te-fue';
import { DIVIDER, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { AMBER_TEXT, CARD_LG, GREEN_TEXT, GROUP_LABEL, NAVY_BG, SECTION_TITLE } from './ctf-ui';

/** Debajo de este % el segmento es muy bajo para que quepa la etiqueta. */
const MIN_LABEL_PCT = 9;

interface Segment {
  key: string;
  pct: number;
  className: string;
  label: string;
}

function Column({ month, segments, current, height = 100, top, onPick }: {
  month: string; segments: Segment[]; current: boolean; height?: number; top?: string; onPick?: () => void;
}) {
  const Tag = onPick ? 'button' : 'div';
  return (
    <Tag
      {...(onPick ? { type: 'button' as const, onClick: onPick, 'aria-pressed': current, 'aria-label': `Ver ${longMonth(month)}` } : {})}
      className="flex h-full min-w-0 flex-1 flex-col items-center gap-1"
    >
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
      <span className={`text-[11.5px] ${current ? `font-extrabold ${TEXT_STRONG}` : `font-semibold ${TEXT_MUTED}`}`}>{shortMonth(month)}</span>
    </Tag>
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

function DetailRow({ label, value, valueClass = TEXT_STRONG }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className={TEXT_MUTED}>{label}</span>
      <span className={`flex-none font-outfit font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * "¿A dónde se va tu dinero?": barras 100 % de 6 meses con 50/30/20 y, al
 * tocar una barra, el detalle del ahorro de ese mes (plegado).
 */
export function BucketsChart({ series, fmt }: { series: MonthTotals[]; fmt: (n: number) => string }) {
  const [selIdx, setSelIdx] = useState(series.length - 1);
  const [open, setOpen] = useState(false);
  const sel = series[Math.min(selIdx, series.length - 1)];
  const now = bucketShares(sel);
  const saved = monthSaved(sel);
  const selName = longMonth(sel.month);
  const ideal = [
    { key: 'needs', label: 'Lo básico', className: NAVY_BG, value: now?.needs ?? 0, ideal: 50, bad: () => false },
    { key: 'wants', label: 'Gustos', className: 'bg-electric-pale', value: now?.wants ?? 0, ideal: 30, bad: () => false },
    { key: 'savings', label: 'Ahorro', className: 'bg-success-dark', value: now?.savings ?? 0, ideal: 20, bad: (v: number) => v < 20 },
  ];
  const described = series.map((t) => {
    const s = bucketShares(t);
    return s ? `${shortMonth(t.month)}: lo básico ${s.needs}%, gustos ${s.wants}%, ahorro ${s.savings}%` : `${shortMonth(t.month)}: sin datos`;
  }).join('; ');
  const apartLabel = sel.savingsNames.length ? `Apartaste · ${sel.savingsNames.join(', ')}` : 'Apartaste';

  return (
    <section aria-label="¿A dónde se va tu dinero?" className={`mt-[22px] flex flex-col gap-3 px-4 py-[18px] ${CARD_LG}`}>
      <div className="flex flex-col gap-0.5">
        <h2 className={SECTION_TITLE}>¿A dónde se va tu dinero?</h2>
        <p className={`text-sm leading-[1.4] [text-wrap:pretty] ${TEXT_MUTED}`}>{bucketsInsight(series)}</p>
      </div>
      <div className="flex h-[150px] gap-2.5" role="group" aria-label={described}>
        {series.map((t, i) => {
          const s = bucketShares(t);
          return (
            <Column
              key={t.month}
              month={t.month}
              current={t.month === sel.month}
              onPick={() => setSelIdx(i)}
              height={s ? 100 : 0}
              segments={s ? [
                { key: 'savings', pct: s.savings, className: SAVE, label: 'Ahorro' },
                { key: 'wants', pct: s.wants, className: WANTS, label: 'Gustos' },
                { key: 'needs', pct: s.needs, className: NEEDS, label: 'Lo básico' },
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

      <div className={`border-t ${DIVIDER}`} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="-my-2 flex h-11 w-full items-center justify-between gap-2"
      >
        <span className={`${GROUP_LABEL} ${TEXT_MUTED}`}>Tu ahorro de {selName}</span>
        <span className="flex items-center gap-2">
          <span className={`font-outfit text-base font-extrabold ${GREEN_TEXT}`}>{fmt(saved)}</span>
          <span aria-hidden className={`inline-block text-sm font-bold transition-transform duration-[250ms] ${TEXT_FAINT} ${open ? 'rotate-90' : ''}`}>›</span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          <DetailRow label="Ingresos recibidos" value={fmt(sel.income)} />
          <DetailRow label="Gastaste (lo básico + gustos)" value={fmt(sel.spent)} />
          <DetailRow label={apartLabel} value={`+ ${fmt(sel.savingsBucket)}`} valueClass={GREEN_TEXT} />
          <DetailRow label="Te sobró sin apartar" value={fmt(monthLeftover(sel))} />
          <div className={`flex items-baseline justify-between border-t pt-1.5 ${DIVIDER}`}>
            <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>Ahorro del mes</span>
            <span className={`font-outfit text-[19px] font-extrabold ${GREEN_TEXT}`}>{fmt(saved)}</span>
          </div>
        </div>
      )}
      {sel.hasData && !(sel.income > 0) && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning-light px-3.5 py-3 dark:bg-warning/15">
          <span aria-hidden className="text-base leading-[1.3]">⚠️</span>
          <span className={`text-[13.5px] leading-[1.4] [text-wrap:pretty] ${AMBER_TEXT}`}>
            <b>No hay ingresos recibidos en {selName}.</b> El % se calcula sobre lo que gastaste y apartaste. Registra tu salario para verlo completo.
          </span>
        </div>
      )}
      {series.length > 1 && <span className={`text-[12.5px] ${TEXT_MUTED}`}>Toca un mes para ver su detalle.</span>}
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
