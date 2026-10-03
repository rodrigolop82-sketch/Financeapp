'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEmoji } from '@/lib/categories-ui';
import {
  computeReserve, fixedLeaves, initialChoices, itemsFromChoices, leafSpent, monthStartSummary,
  type MonthChoices, type Reserve,
} from '@/lib/inicio-de-mes';
import { EMPTY_MONTH_START, loadMonthStart, saveMonthStart, type MonthStartState } from '@/lib/month-start-data';
import { incomeMonthly, monthName } from '@/lib/plan-del-mes';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import type { BudgetCategory, BudgetSubItem, IncomeEntry } from '@/types';
import { MonthStartSheet } from './MonthStartSheet';

interface UseMonthStartOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  householdId: string;
  /** 'YYYY-MM' en curso. */
  month: string;
  /** Todas las categorías (incluye las de ingreso, para el emoji). */
  categories: BudgetCategory[];
  subItems: BudgetSubItem[];
  incomes: IncomeEntry[];
  /** Gasto del mes por categoría y por parte. */
  spentByCategory: Record<string, number>;
  spentBySub: Record<string, number>;
  /** Lo recibido este mes por ingreso. */
  received: Record<string, number>;
  /** Categoría de ingreso de cada ingreso (para el emoji). */
  incomeCategoryOf: Record<string, string | null>;
  /** Básico + gustos y lo gastado (para la vista previa). */
  planSpend: number;
  spent: number;
  daysLeft: number;
  fmt: (n: number) => string;
  /** Después de guardar: la página recarga y muestra el toast. */
  onSaved: (toast: string) => void;
  onError: (text: string) => void;
}

/**
 * Estado del inicio de mes y la hoja "Empieza {mes}". Lo usan Inicio y
 * Plan del mes; `element` va una vez en la página.
 */
export function useMonthStart(o: UseMonthStartOptions) {
  const { supabase, householdId, month } = o;
  const [state, setState] = useState<MonthStartState>(EMPTY_MONTH_START);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!householdId) return;
    setState(await loadMonthStart(supabase, householdId, month));
    setLoaded(true);
  }, [supabase, householdId, month]);

  useEffect(() => { void reload(); }, [reload]);

  const planCats = useMemo(() => o.categories.filter((c) => c.bucket !== 'income' && !c.archived_at), [o.categories]);
  const leaves = useMemo(() => fixedLeaves(planCats, o.subItems), [planCats, o.subItems]);
  const fixedIncomes = o.incomes.filter((e) => e.is_fixed ?? true);

  const choices: MonthChoices | null = state.done ? state.current : null;
  const reserve: Reserve = computeReserve(leaves, choices, o.spentByCategory, o.spentBySub);

  const openSheet = useCallback(() => { setSheetKey((k) => k + 1); setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);

  async function save(next: MonthChoices, remind: boolean, reserved: number) {
    setSaving(true);
    const items = itemsFromChoices(leaves, fixedIncomes.map((e) => e.id), next);
    const { error } = await saveMonthStart(supabase, householdId, month, items, remind);
    setSaving(false);
    if (error) { o.onError('No se pudo guardar tu inicio de mes. Intenta de nuevo.'); return; }
    setOpen(false);
    await reload();
    o.onSaved(reserved > 0 ? `Listo. Apartaste ${o.fmt(reserved)} para tus fijos.` : 'Listo. Empezaste el mes.');
  }

  const catById = (id: string) => o.categories.find((c) => c.id === id);
  const leafRows = leaves.map((l) => {
    const cat = catById(l.categoryId);
    const sub = l.id === l.categoryId ? null : o.subItems.find((s) => s.id === l.id);
    return {
      id: l.id,
      emoji: cat ? getEmoji(cat) : '📦',
      name: sub ? sub.name : cat?.name ?? '',
      plan: l.plan,
      spent: leafSpent(l, o.spentByCategory, o.spentBySub),
      day: l.expectedDay,
    };
  });
  const incomeRows = fixedIncomes.map((e) => {
    const cat = o.incomeCategoryOf[e.id] ? catById(o.incomeCategoryOf[e.id]!) : undefined;
    return {
      id: e.id,
      emoji: cat ? getEmoji(cat) : '💰',
      name: e.source || 'Ingreso',
      amount: incomeMonthly(e),
      received: o.received[e.id] ?? 0,
      day: e.expected_day ?? null,
    };
  });

  const element = (
    <BottomSheet themed open={open} onClose={close} label={`Empieza ${monthName(month)}`}>
      {open && (
        <MonthStartSheet
          key={sheetKey}
          monthName={monthName(month)}
          done={state.done}
          incomes={incomeRows}
          leaves={leafRows}
          initialChoices={initialChoices(leaves, fixedIncomes.map((e) => e.id), state.current, state.previous)}
          initialRemind={state.remind}
          planSpend={o.planSpend}
          spent={o.spent}
          daysLeft={o.daysLeft}
          fmt={o.fmt}
          saving={saving}
          onSave={(c, r, reserved) => { void save(c, r, reserved); }}
        />
      )}
    </BottomSheet>
  );

  return {
    loaded,
    done: state.done,
    choices,
    reserve,
    summary: monthStartSummary(reserve, o.fmt),
    open: openSheet,
    reload,
    element,
  };
}
