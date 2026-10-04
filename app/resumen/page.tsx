'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { addMonths, analyzeMonth, longMonth, monthSaved, monthTitle, verdictSaved } from '@/lib/como-te-fue';
import { categoryPlan, monthName, subAmountFromMonthly } from '@/lib/plan-del-mes';
import {
  capListText, capPlanChanges, DEFAULT_CAPS, horizonMonths, projection,
  type CapKey, type Horizon,
} from '@/lib/recomendaciones';
import { DELETE_UNDO_MS } from '@/lib/transactions/undo-delete';
import { AppShell } from '@/components/layout/AppShell';
import { NavCard, NavRow } from '@/components/layout/NavRow';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { UndoToast } from '@/components/transactions/UndoToast';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { useComoTeFue } from '@/components/resumen/useComoTeFue';
import { MonthPill } from '@/components/resumen/MonthPill';
import { Highlights, Veredicto } from '@/components/resumen/Veredicto';
import { Oportunidades } from '@/components/resumen/Oportunidades';
import { Proyeccion } from '@/components/resumen/Proyeccion';
import { BucketsChart, FixedVarChart } from '@/components/resumen/Graficas';
import { CapSheet } from '@/components/resumen/CapSheet';
import { CARD } from '@/components/resumen/ctf-ui';
import type { BudgetSubItem } from '@/types';

export default function ResumenPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <ComoTeFue />
    </Suspense>
  );
}

interface Undo {
  title: string;
  subtitle?: string;
  run: () => Promise<void>;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ComoTeFue() {
  const fmt = useFormatMoney();
  const { supabase, data, reload, month, current, isCurrent, canPrev, canNext, goTo } = useComoTeFue();

  const [capsOverride, setCapsOverride] = useState<Partial<Record<CapKey, number>>>({});
  const [picked, setPicked] = useState<Partial<Record<CapKey, boolean>>>({});
  const [horizon, setHorizon] = useState<Horizon | null>(null);
  const [capSheet, setCapSheet] = useState<{ key: CapKey; n: number } | null>(null);
  const [savingCap, setSavingCap] = useState(false);
  const [applying, setApplying] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  // Cada mes empieza con sus recomendaciones variables elegidas.
  useEffect(() => { setPicked({}); }, [month]);

  const caps = useMemo(() => ({ ...(data?.caps ?? DEFAULT_CAPS), ...capsOverride }), [data, capsOverride]);
  const a = useMemo(() => (data ? analyzeMonth(data, month, caps, fmt) : null), [data, month, caps, fmt]);

  const selected = useMemo(() => new Set(
    (a?.recs.over ?? []).filter((r) => picked[r.key] ?? r.kind === 'variable').map((r) => r.key),
  ), [a, picked]);

  const canYear = horizonMonths(month, 'year').length > 0;
  const effHorizon: Horizon = horizon === '12' || !canYear ? '12' : 'year';
  const extra = (a?.recs.over ?? []).filter((r) => selected.has(r.key)).reduce((s, r) => s + r.saving, 0);
  const proj = useMemo(
    () => projection(a ? monthSaved(a.current) : 0, extra, horizonMonths(month, effHorizon)),
    [a, extra, month, effHorizon],
  );

  const planMonthName = monthName(current);
  const closeCapSheet = useCallback(() => setCapSheet(null), []);
  const dismissUndo = useCallback(() => setUndo(null), []);
  const clearMessage = useCallback(() => setMessage(null), []);

  if (!data || !a) return <PageSkeleton variant="detail" />;

  const title = monthTitle(month, current);
  const pill = (
    <MonthPill
      label={title}
      canPrev={canPrev}
      canNext={canNext}
      onPrev={() => goTo(addMonths(month, -1))}
      onNext={() => goTo(addMonths(month, 1))}
    />
  );

  // ── Topes ─────────────────────────────────────────

  async function saveCap(key: CapKey, pct: number) {
    if (!data) return;
    setSavingCap(true);
    const { error } = await supabase
      .from('spending_caps')
      .upsert({ household_id: data.householdId, cap_key: key, pct, updated_at: new Date().toISOString() }, { onConflict: 'household_id,cap_key' });
    setSavingCap(false);
    if (error) { setMessage({ text: 'No se pudo guardar el tope. Intenta de nuevo.', tone: 'error' }); return; }
    setCapsOverride((c) => ({ ...c, [key]: pct }));
    setCapSheet(null);
    setMessage({ text: `Tu tope de ${capListText([key])} ahora es ${pct}%`, tone: 'ok' });
  }

  // ── Aplicar a mi plan ─────────────────────────────

  async function applyToPlan() {
    if (!data || !a || applying) return;
    const keys = a.recs.over.filter((r) => selected.has(r.key)).map((r) => r.key);
    const changes = capPlanChanges(a.planItems, keys, a.planIncome, caps);
    if (changes.length === 0) {
      setMessage({ text: `Tu plan de ${planMonthName} ya respeta esos topes.`, tone: 'ok' });
      return;
    }
    setUndo(null);
    setApplying(true);
    const subById = new Map(data.subs.map((s) => [s.id, s]));
    const catIds = Array.from(new Set(changes.map((c) => c.categoryId)));
    const prevCats = catIds.map((id) => {
      const c = data.categories.find((x) => x.id === id)!;
      return { id, budgeted_amount: c.budgeted_amount };
    });
    const prevParts = changes.filter((c) => c.kind === 'part').map((c) => ({ id: c.id, amount: subById.get(c.id)!.amount }));

    const restore = async () => {
      for (const p of prevParts) await supabase.from('budget_sub_items').update({ amount: p.amount }).eq('id', p.id);
      for (const c of prevCats) await supabase.from('budget_categories').update({ budgeted_amount: c.budgeted_amount }).eq('id', c.id);
    };

    let failed = false;
    const newSubs: BudgetSubItem[] = data.subs.map((s) => ({ ...s }));
    for (const ch of changes) {
      if (ch.kind === 'part') {
        const sub = newSubs.find((s) => s.id === ch.id)!;
        sub.amount = subAmountFromMonthly(ch.toMonthly, sub.recurrence);
        const { error } = await supabase.from('budget_sub_items').update({ amount: sub.amount }).eq('id', ch.id);
        if (error) { failed = true; break; }
      } else {
        const { error } = await supabase.from('budget_categories').update({ budgeted_amount: ch.toMonthly }).eq('id', ch.id);
        if (error) { failed = true; break; }
      }
    }
    // Las categorías con partes guardan la suma de sus partes (Inicio la usa).
    if (!failed) {
      for (const id of catIds) {
        if (!changes.some((c) => c.kind === 'part' && c.categoryId === id)) continue;
        const cat = data.categories.find((x) => x.id === id)!;
        const amount = Math.round(categoryPlan(cat, newSubs) * 100) / 100;
        const { error } = await supabase.from('budget_categories').update({ budgeted_amount: amount }).eq('id', id);
        if (error) { failed = true; break; }
      }
    }
    if (failed) {
      await restore();
      setApplying(false);
      setMessage({ text: 'No se pudo cambiar tu plan. Intenta de nuevo.', tone: 'error' });
      return;
    }
    const total = changes.reduce((s, c) => s + (c.fromMonthly - c.toMonthly), 0);
    const applied = Array.from(new Set(changes.map((c) => a.planItems.find((i) => i.categoryId === c.categoryId)?.key)))
      .filter((k): k is CapKey => !!k);
    setApplying(false);
    setUndo({
      title: `Bajaste tu plan de ${planMonthName} ${fmt(total)}`,
      subtitle: `${capitalize(capListText(applied))} ${applied.length === 1 ? 'queda' : 'quedan'} en su tope`,
      run: restore,
    });
    reload();
  }

  async function runUndo() {
    const u = undo;
    setUndo(null);
    if (!u) return;
    try { await u.run(); } catch { setMessage({ text: 'No se pudo deshacer. Intenta de nuevo.', tone: 'error' }); }
    reload();
  }

  // ── Vista ─────────────────────────────────────────

  const cur = a.current;
  const topNames = (kind: 'fijo' | 'variable') => Object.values(a.spend)
    .filter((s) => a.kindOf[s.id] === kind && s.spent > 0)
    .sort((x, y) => y.spent - x.spent)
    .slice(0, 3)
    .map((s) => s.name.replace(/\s*\(.*\)\s*/, '').trim());

  return (
    <AppShell
      title="Cómo te fue"
      currentPath="/resumen"
      hideMobileBar
      headerRight={<div className="self-center">{pill}</div>}
      userName={data.userName}
      householdName={data.householdName}
    >
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        {/* Encabezado móvil */}
        <div className="-mx-4 flex flex-col items-start gap-0.5 px-5 pt-[env(safe-area-inset-top)] lg:hidden">
          <Link href="/mas" className="flex h-11 items-center text-[15px] font-semibold text-electric">‹ Más</Link>
          <div className="flex w-full items-center justify-between gap-2">
            <h1 className="font-serif text-[30px] leading-[1.15] text-ink-900 dark:text-ink-100">Cómo te fue</h1>
            {pill}
          </div>
        </div>

        {!cur.hasData ? (
          <div className={`mt-3.5 flex flex-col gap-1.5 p-5 ${CARD}`}>
            <span className={`text-[17px] font-bold ${TEXT_STRONG}`}>Aún no hay movimientos en {longMonth(month)}</span>
            <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
              Cuando registres tus gastos e ingresos recibidos, aquí verás cuánto ahorraste y dónde puedes ajustar.
            </span>
          </div>
        ) : (
          <div key={month} className="flex flex-col zafi-stagger">
            <Veredicto
              monthName={longMonth(month)}
              isCurrent={isCurrent}
              income={cur.income}
              spent={cur.spent}
              saved={verdictSaved(cur)}
              savedPct={a.savedPct}
              hasRecs={a.recs.over.length > 0}
              fmt={fmt}
            />
            <Highlights good={a.highlights.good} bad={a.highlights.bad} />
            <Oportunidades
              over={a.recs.over}
              ok={a.recs.ok}
              potential={a.recs.potential}
              selected={selected}
              planAlert={a.planAlert}
              planMonthName={planMonthName}
              noIncome={!(cur.income > 0)}
              onToggle={(key) => setPicked((p) => ({ ...p, [key]: !selected.has(key) }))}
              onEditCap={(key) => setCapSheet({ key, n: Date.now() })}
              fmt={fmt}
            />
            {a.recs.over.length > 0 && (
              <Proyeccion
                horizon={effHorizon}
                canYear={canYear}
                onHorizon={setHorizon}
                proj={proj}
                selCount={selected.size}
                planMonthName={planMonthName}
                applying={applying}
                onApply={() => void applyToPlan()}
                fmt={fmt}
              />
            )}
            <BucketsChart series={a.series} fmt={fmt} />
            <FixedVarChart series={a.series} fixedNames={topNames('fijo')} variableNames={topNames('variable')} fmt={fmt} />
            <Link
              href={`/resumen/categoria?mes=${month}`}
              className={`mt-3 flex min-h-[52px] items-center justify-between px-4 py-3.5 transition-transform duration-150 active:scale-[0.98] ${CARD}`}
            >
              <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>Ver detalle por categoría</span>
              <span aria-hidden className="font-bold text-electric">›</span>
            </Link>
            <div className="mt-3">
              <NavCard>
                <NavRow href="/health-score" emoji="💚" name="Tu salud financiera" description="Tu puntaje Zafi y cómo mejorarlo" last />
              </NavCard>
            </div>
          </div>
        )}
      </div>

      <BottomSheet themed open={!!capSheet} onClose={closeCapSheet} label="Cambiar tope">
        {capSheet && (
          <CapSheet
            key={capSheet.n}
            capKey={capSheet.key}
            initial={caps[capSheet.key]}
            income={cur.income}
            saving={savingCap}
            onSave={(pct) => void saveCap(capSheet.key, pct)}
            fmt={fmt}
          />
        )}
      </BottomSheet>

      <UndoToast
        key={undo?.title}
        visible={!!undo}
        title={undo?.title ?? ''}
        subtitle={undo?.subtitle}
        onUndo={() => void runUndo()}
        onDismiss={dismissUndo}
        duration={DELETE_UNDO_MS}
      />
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  );
}
