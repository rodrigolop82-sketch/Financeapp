'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { localToday } from '@/lib/dates';
import { cleanTransactionName } from '@/lib/format';
import { getEmoji } from '@/lib/categories-ui';
import { monthRange } from '@/lib/movimientos';
import {
  analyzeMonth, longMonth, merchantGroups, timesText, vsPlanText,
} from '@/lib/como-te-fue';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton, SkeletonRows } from '@/components/motion/PageSkeleton';
import { TxRow, type SwipeRowData } from '@/components/movimientos/SwipeRow';
import { useTxSheets } from '@/components/movimientos/useTxSheets';
import { BORDER, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { useComoTeFue } from '@/components/resumen/useComoTeFue';
import { CARD } from '@/components/resumen/ctf-ui';
import type { BudgetCategory, SearchTransaction } from '@/types';

export default function CategoriaDetallePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <CategoriaDetalle />
    </Suspense>
  );
}

const SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const OTHERS = '__otros__';

function dayLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${SHORT[m - 1]}`;
}

function CategoriaDetalle() {
  const fmt = useFormatMoney();
  const router = useRouter();
  const params = useParams();
  const categoryId = params.categoryId as string;
  const today = localToday();
  const { supabase, data, reload, month } = useComoTeFue();

  const [rows, setRows] = useState<SearchTransaction[]>([]);
  const [rowsFor, setRowsFor] = useState<string | null>(null);
  const [rowsGen, setRowsGen] = useState(0);
  const [subFilter, setSubFilter] = useState<string | null>(null);

  const categories = useMemo(
    () => ((data?.categories ?? []) as unknown as BudgetCategory[]).filter((c) => !c.archived_at),
    [data],
  );
  const onChanged = useCallback(() => { reload(); setRowsGen((g) => g + 1); }, [reload]);
  const sheets = useTxSheets({ rows, setRows, categories, fmt, today, onChanged, loading: rowsFor !== `${month}:${rowsGen}` });
  const { getPendingDeleteId } = sheets;

  // Movimientos completos del mes en esta categoría (para el detalle y "Cambiar categoría").
  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(month);
    supabase
      .from('transactions')
      .select('*, budget_categories(name, bucket, icon)')
      .eq('category_id', categoryId)
      .eq('type', 'expense')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data: txs }: { data: unknown[] | null }) => {
        if (cancelled) return;
        const pending = getPendingDeleteId();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRows(((txs ?? []) as any[]).filter((t) => t.id !== pending).map((t) => ({
          ...t,
          category_name: t.budget_categories?.name ?? 'Sin categoría',
          category_bucket: t.budget_categories?.bucket ?? 'needs',
          category_icon: t.budget_categories?.icon ?? null,
        })));
        setRowsFor(`${month}:${rowsGen}`);
      });
    return () => { cancelled = true; };
  }, [supabase, categoryId, month, rowsGen, getPendingDeleteId]);

  useEffect(() => { setSubFilter(null); }, [categoryId, month]);

  const a = useMemo(() => (data ? analyzeMonth(data, month, data.caps, fmt) : null), [data, month, fmt]);
  const cat = data?.categories.find((c) => c.id === categoryId) ?? null;

  useEffect(() => {
    if (data && !cat) router.push(`/resumen/categoria?mes=${month}`);
  }, [data, cat, router, month]);

  if (!data || !a || !cat) return <PageSkeleton variant="detail" />;

  const emoji = getEmoji(cat);
  const subName = new Map(data.subs.filter((s) => s.category_id === cat.id).map((s) => [s.id, s.name]));
  const partOf = (t: SearchTransaction) => (t.budget_sub_item_id && subName.has(t.budget_sub_item_id) ? t.budget_sub_item_id : OTHERS);
  const loaded = rowsFor !== null;
  const spent = rows.reduce((s, t) => s + Number(t.amount), 0);
  const total = a.current.spent;
  const income = a.current.income;
  const key = a.capKeyOf[cat.id];
  const cap = key ? data.caps[key] : null;
  const pctInc = income > 0 ? (spent / income) * 100 : null;
  // Ámbar si su tope (el grupo, p. ej. alimentación + restaurantes) se pasó.
  const capOver = !!key && a.recs.over.some((r) => r.key === key);
  const plan = a.planOf[cat.id] ?? 0;
  const vs = vsPlanText(spent, plan, fmt);
  const fixed = a.kindOf[cat.id] === 'fijo';

  // Subcategorías: las partes del Plan del mes con gasto (y "Otros" sin parte).
  const bySub = new Map<string, number>();
  for (const t of rows) bySub.set(partOf(t), (bySub.get(partOf(t)) ?? 0) + Number(t.amount));
  const chips = Array.from(bySub.entries())
    .sort((x, y) => y[1] - x[1])
    .map(([id, amount]) => ({ id, name: id === OTHERS ? 'Otros' : subName.get(id)!, amount }));
  const shown = subFilter ? rows.filter((t) => partOf(t) === subFilter) : rows;
  const merchants = merchantGroups(shown, cleanTransactionName);
  const maxM = Math.max(1, ...merchants.map((m) => m.total));

  const rowData = (t: SearchTransaction): SwipeRowData => ({
    id: t.id,
    emoji,
    name: t.description || cat.name,
    sub: `${dayLabel(t.date)} · ${partOf(t) === OTHERS ? cat.name : subName.get(partOf(t))}`,
    amountLabel: fmt(Number(t.amount)),
    isIncome: false,
  });

  const chip = (on: boolean) => `flex h-[34px] items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-semibold transition-colors duration-200 ${
    on ? 'border-electric bg-electric-ghost text-ink-900 dark:bg-electric/20 dark:text-ink-100' : `${BORDER} bg-[var(--zafi-card)] ${TEXT_STRONG}`
  }`;

  return (
    <AppShell title={cat.name} currentPath="/resumen" hideMobileBar userName={data.userName} householdName={data.householdName}>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <div className="-mx-4 flex flex-col items-start gap-0.5 px-5 pt-[env(safe-area-inset-top)]">
          <Link href={`/resumen/categoria?mes=${month}`} className="flex h-11 items-center text-[15px] font-semibold text-electric">‹ Por categoría</Link>
          <h1 className="font-serif text-[30px] leading-[1.15] text-ink-900 dark:text-ink-100 lg:hidden">{emoji} {cat.name}</h1>
        </div>

        <div className="flex flex-col zafi-stagger">
          {/* Hero */}
          <section
            aria-label={`Gasto en ${cat.name}`}
            className="mt-3.5 flex flex-col gap-2.5 rounded-[20px] px-5 py-[18px] text-white"
            style={{ background: 'var(--zafi-hero)' }}
          >
            <div className="flex items-end justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-[#9FB3CB]">Gastaste en {longMonth(month)}</span>
                <span className="font-outfit text-[40px] font-extrabold leading-none">{loaded ? fmt(spent) : '—'}</span>
              </div>
              <span className="flex-none rounded-full bg-white/10 px-[11px] py-[5px] text-[13px] font-semibold">
                {fixed ? 'Gasto fijo' : 'Gasto variable'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-px">
                <span className="text-xs text-[#9FB3CB]">De tus gastos</span>
                <span className="font-outfit text-[17px] font-bold">{total > 0 ? `${Math.round((spent / total) * 100)}%` : '—'}</span>
              </div>
              <div className="flex flex-col gap-px">
                <span className="text-xs text-[#9FB3CB]">De tus ingresos</span>
                <span className={`font-outfit text-[17px] font-bold ${capOver ? 'text-warning' : ''}`}>
                  {pctInc === null ? '—' : `${Math.round(pctInc)}%${cap !== null ? ` / ${cap}%` : ''}`}
                </span>
              </div>
              <div className="flex flex-col gap-px">
                <span className="text-xs text-[#9FB3CB]">Vs plan</span>
                <span className={`font-outfit text-[17px] font-bold ${plan > 0 ? (vs.over ? 'text-warning' : 'text-success') : ''}`}>
                  {plan > 0 ? vs.text : 'Sin plan'}
                </span>
              </div>
            </div>
          </section>

          {/* ¿En qué exactamente? */}
          {loaded && rows.length > 0 && (
            <section aria-label="¿En qué exactamente?" className="mt-[18px] flex flex-col gap-2">
              <h2 className={`px-1 text-[15px] font-bold ${TEXT_STRONG}`}>¿En qué exactamente?</h2>
              {chips.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={!subFilter} onClick={() => setSubFilter(null)} className={chip(!subFilter)}>Todo</button>
                  {chips.map((c) => (
                    <button key={c.id} type="button" aria-pressed={subFilter === c.id} onClick={() => setSubFilter(c.id)} className={chip(subFilter === c.id)}>
                      {c.name} <span className={`font-outfit ${TEXT_MUTED}`}>{fmt(c.amount)}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className={`flex flex-col gap-2.5 px-4 py-3 ${CARD}`}>
                {merchants.map((m) => (
                  <div key={m.name} className="flex flex-col gap-[5px]">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className={`truncate font-semibold ${TEXT_STRONG}`}>{m.name}</span>
                      <span className={`flex-none ${TEXT_MUTED}`}>
                        <b className={`font-outfit ${TEXT_STRONG}`}>{fmt(m.total)}</b> · {timesText(m.count)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-[var(--zafi-border-light)]">
                      <div className="h-full rounded bg-electric" style={{ width: `${(m.total / maxM) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Movimientos */}
          <section aria-label="Movimientos" className="mt-[18px] flex flex-col gap-2">
            <h2 className={`px-1 text-[15px] font-bold ${TEXT_STRONG}`}>Movimientos{loaded ? ` (${shown.length})` : ''}</h2>
            {!loaded ? (
              <SkeletonRows count={4} />
            ) : shown.length === 0 ? (
              <div className={`p-5 text-sm ${CARD} ${TEXT_MUTED}`}>No hay movimientos de esta categoría en {longMonth(month)}.</div>
            ) : (
              <div className="flex flex-col gap-[5px]">
                {shown.map((t) => (
                  <TxRow key={t.id} row={rowData(t)} flash={sheets.flashFor(t.id)} onSelect={() => sheets.openDetail(t.id)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {sheets.element}
    </AppShell>
  );
}
