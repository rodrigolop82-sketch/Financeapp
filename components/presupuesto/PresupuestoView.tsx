'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { getUserHousehold } from '@/lib/household';
import { localMonth } from '@/lib/dates';
import { monthRange } from '@/lib/movimientos';
import { getEmoji } from '@/lib/categories-ui';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { DELETE_UNDO_MS } from '@/lib/transactions/undo-delete';
import {
  allocateReceived, categoryPlan, expenseStatus, incomeAmountFromMonthly, incomeMonthly, incomeStatus,
  inferIncomeCategory, monthName, planSummary, previousMonth, subAmountFromMonthly, subMonthly,
  type RowStatus,
} from '@/lib/plan-del-mes';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { UndoToast } from '@/components/transactions/UndoToast';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';
import { TEXT_MUTED } from '@/components/movimientos/ui';
import { PlanSummaryCard } from '@/components/presupuesto/PlanSummaryCard';
import { PlanGroups, type PlanGroupVM, type PlanRowVM } from '@/components/presupuesto/PlanGroups';
import { EditPlanSheet, type EditPlanTarget, type PlanDraft } from '@/components/presupuesto/EditPlanSheet';
import { daysLeftInMonth, isCounted, totalCountedIncome } from '@/lib/inicio-de-mes';
import { MonthStartNotice } from '@/components/inicio-de-mes/MonthStartNotice';
import { useMonthStart } from '@/components/inicio-de-mes/useMonthStart';
import { planItems } from '@/lib/como-te-fue';
import {
  capListText, categoryCapKeys, planByCapKey, planOverCaps, resolveCaps, type CapKey,
} from '@/lib/recomendaciones';
import type { BudgetCategory, BudgetSubItem, IncomeEntry } from '@/types';
import { SkeletonRows } from '@/components/motion/PageSkeleton';

interface MonthTx {
  category_id: string | null;
  budget_sub_item_id?: string | null;
  amount: number | string;
  type: 'expense' | 'income';
  date: string;
}

/** Lo que se está editando en la hoja. `id: null` es uno nuevo. */
type ItemRef =
  | { kind: 'category' | 'goal'; id: string }
  | { kind: 'part'; id: string | null; categoryId: string }
  | { kind: 'income'; id: string | null };

interface Undo {
  title: string;
  run: () => PromiseLike<unknown>;
}

const EXPENSE_GROUPS = [
  { bucket: 'needs', title: 'Lo básico', hint: 'no puedes dejar de pagarlo' },
  { bucket: 'wants', title: 'Gustos', hint: 'podrías recortarlo' },
  { bucket: 'savings', title: 'Para tus metas', hint: 'lo apartas cada mes' },
] as const;

const FLASH_MS = 1600;

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Totales por clave de una lista de movimientos. */
function sumBy(rows: MonthTx[], type: MonthTx['type'], key: (t: MonthTx) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const t of rows) {
    if (t.type !== type) continue;
    const k = key(t);
    if (k) out[k] = (out[k] ?? 0) + Number(t.amount);
  }
  return out;
}

/** Plan del mes: cuerpo de la sección "Del mes" en /plan. Usa useSearchParams: va dentro de <Suspense>. */
export function PresupuestoView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const fmt = useFormatMoney();

  // Presente cuando se llega desde "Cerrar el mes" para confirmar los ingresos de ese mes.
  const confirmMonth = searchParams.get('confirmMonth');
  const month = localMonth();
  const prevMonth = previousMonth(month);

  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [subItems, setSubItems] = useState<BudgetSubItem[]>([]);
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [txs, setTxs] = useState<MonthTx[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<{ ref: ItemRef; target: EditPlanTarget; key: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [confirmingIncome, setConfirmingIncome] = useState(false);
  const [caps, setCaps] = useState<Record<CapKey, number>>(resolveCaps(null));
  // La alerta de topes aparece al guardar un cambio del plan.
  const [capAlertArmed, setCapAlertArmed] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const hh = await getUserHousehold(supabase, user.id);
    if (!hh) { router.push('/onboarding'); return; }
    const hid = hh.id as string;
    const from = monthRange(prevMonth).from;
    const to = monthRange(month).to;
    const [{ data: cats }, { data: subs }, { data: entries }, txRes, capsRes] = await Promise.all([
      supabase.from('budget_categories').select('*').eq('household_id', hid).order('created_at', { ascending: true }),
      supabase.from('budget_sub_items').select('*').eq('household_id', hid).order('created_at', { ascending: true }),
      supabase.from('income_entries').select('*').eq('household_id', hid).order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('category_id, budget_sub_item_id, amount, type, date')
        .eq('household_id', hid)
        .gte('date', from)
        .lte('date', to),
      // Sin la migración de topes falla y se usan los recomendados.
      supabase.from('spending_caps').select('cap_key, pct').eq('household_id', hid),
    ]);
    setCaps(resolveCaps(capsRes.error ? null : capsRes.data));
    let monthTx = txRes.data as MonthTx[] | null;
    // Sin la migración del Plan del mes no existe budget_sub_item_id: se carga sin partes.
    if (txRes.error) {
      const { data } = await supabase
        .from('transactions')
        .select('category_id, amount, type, date')
        .eq('household_id', hid)
        .gte('date', from)
        .lte('date', to);
      monthTx = data as MonthTx[] | null;
    }
    setHouseholdId(hid);
    setCategories(((cats ?? []) as BudgetCategory[]).filter((c) => !c.archived_at));
    setSubItems((subs ?? []) as BudgetSubItem[]);
    setIncomes((entries ?? []) as IncomeEntry[]);
    setTxs(monthTx ?? []);
    setLoading(false);
  }, [supabase, router, month, prevMonth]);

  useEffect(() => { void load(); }, [load]);

  // ── Datos derivados ─────────────────────────────

  const planCats = useMemo(() => categories.filter((c) => c.bucket !== 'income'), [categories]);
  const incomeCats = useMemo(() => categories.filter((c) => c.bucket === 'income'), [categories]);
  const monthName0 = monthName(month);
  const prevName = monthName(prevMonth);

  const derived = useMemo(() => {
    const inMonth = (m: string) => txs.filter((t) => t.date.startsWith(m));
    const cur = inMonth(month);
    const prev = inMonth(prevMonth);
    const incomeCat = (e: IncomeEntry) =>
      e.category_id ?? inferIncomeCategory(e.source, e.is_fixed ?? true, incomeCats)?.id ?? null;
    const incomeRows = incomes.map((e) => ({ ...e, categoryId: incomeCat(e) }));
    return {
      spentCat: sumBy(cur, 'expense', (t) => t.category_id),
      spentSub: sumBy(cur, 'expense', (t) => t.budget_sub_item_id),
      prevCat: sumBy(prev, 'expense', (t) => t.category_id),
      prevSub: sumBy(prev, 'expense', (t) => t.budget_sub_item_id),
      received: allocateReceived(incomeRows, sumBy(cur, 'income', (t) => t.category_id)),
      prevReceived: allocateReceived(incomeRows, sumBy(prev, 'income', (t) => t.category_id)),
      incomeCatOf: Object.fromEntries(incomeRows.map((e) => [e.id, e.categoryId])) as Record<string, string | null>,
    };
  }, [txs, incomes, incomeCats, month, prevMonth]);

  const subsOf = (catId: string) => subItems.filter((s) => s.category_id === catId);

  // ── Inicio de mes (Fase 6) ──────────────────────

  const baseSummary = planSummary(planCats, subItems, incomes);
  const spentPlan = planCats
    .filter((c) => c.bucket === 'needs' || c.bucket === 'wants')
    .reduce((a, c) => a + (derived.spentCat[c.id] ?? 0), 0);
  const monthStart = useMonthStart({
    supabase, householdId, month, categories, subItems, incomes,
    spentByCategory: derived.spentCat, spentBySub: derived.spentSub,
    received: derived.received, incomeCategoryOf: derived.incomeCatOf,
    planSpend: baseSummary.needs + baseSummary.wants,
    spent: spentPlan,
    daysLeft: daysLeftInMonth(new Date()),
    fmt,
    onSaved: (text) => { void load(); setMessage({ text, tone: 'ok' }); },
    onError: (text) => setMessage({ text, tone: 'error' }),
  });
  // "Ingresos del mes" cuenta solo los ingresos con los que cuentas este mes.
  const countedIncomeTotal = totalCountedIncome(incomes, derived.received, monthStart.choices);
  const summary = {
    ...baseSummary,
    income: countedIncomeTotal,
    unassigned: Math.round((countedIncomeTotal - baseSummary.assigned) * 100) / 100,
  };
  // Topes de "Cómo te fue" que este plan pasa (mismo motor que /resumen).
  const capAlert = useMemo(() => {
    const items = planItems(categories, subItems, categoryCapKeys(categories));
    return planOverCaps(planByCapKey(items), baseSummary.income, caps);
  }, [categories, subItems, baseSummary.income, caps]);

  const reservedLeaf = (id: string, day: number | null) =>
    monthStart.done && isCounted(monthStart.choices, 'expense', id) ? { day } : undefined;

  function flash(key: string) {
    setFlashKey(key);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashKey(null), FLASH_MS);
  }

  function lastOf(map: Record<string, number>, key: string) {
    return key in map ? { label: prevName, amount: Math.round(map[key]) } : null;
  }

  // ── Abrir la hoja ───────────────────────────────

  function openSheet(ref: ItemRef) {
    let target: EditPlanTarget;
    if (ref.kind === 'income') {
      const e = ref.id ? incomes.find((x) => x.id === ref.id) : undefined;
      const cat = e ? categories.find((c) => c.id === derived.incomeCatOf[e.id]) : undefined;
      const rec = e ? derived.received[e.id] ?? 0 : 0;
      target = {
        kind: 'income', isNew: !e, emoji: cat ? getEmoji(cat) : '💰',
        title: e ? 'Ingreso' : 'Nuevo ingreso',
        subtitle: rec ? `Te ha entrado ${fmt(rec)} este mes` : 'Nada recibido este mes',
        initial: e
          ? { name: e.source, amount: incomeMonthly(e), fixed: e.is_fixed ?? true, day: e.expected_day ?? null }
          : { name: '', amount: 0, fixed: false, day: null },
        spent: 0,
        last: e && derived.prevReceived[e.id] ? { label: prevName, amount: Math.round(derived.prevReceived[e.id]) } : null,
        canSplit: false,
        canRemove: !!e,
      };
    } else if (ref.kind === 'part') {
      const cat = categories.find((c) => c.id === ref.categoryId)!;
      const s = ref.id ? subItems.find((x) => x.id === ref.id) : undefined;
      const spent = s ? derived.spentSub[s.id] ?? 0 : 0;
      target = {
        kind: 'part', isNew: !s, emoji: getEmoji(cat), title: cat.name,
        subtitle: `${s ? 'Una parte' : 'Nueva parte'}${spent ? ` · llevas ${fmt(spent)}` : ''}`,
        initial: s
          ? { name: s.name, amount: subMonthly(s), fixed: s.is_fixed, day: s.expected_day ?? null }
          : { name: '', amount: 0, fixed: false, day: null },
        spent,
        last: s ? lastOf(derived.prevSub, s.id) : null,
        canSplit: false,
        canRemove: !!s,
      };
    } else {
      const cat = categories.find((c) => c.id === ref.id)!;
      const isGoal = ref.kind === 'goal';
      const spent = derived.spentCat[cat.id] ?? 0;
      target = {
        kind: ref.kind, isNew: false, emoji: getEmoji(cat), title: cat.name,
        subtitle: isGoal ? 'Para tu meta' : spent ? `Llevas ${fmt(spent)} este mes` : 'Nada gastado este mes',
        initial: {
          name: cat.name, amount: Number(cat.budgeted_amount) || 0,
          fixed: cat.pace_mode === 'fixed', day: cat.expected_day ?? null,
        },
        spent,
        last: lastOf(derived.prevCat, cat.id),
        canSplit: !isGoal,
        canRemove: false,
      };
    }
    setSheet({ ref, target, key: Date.now() });
  }

  const closeSheet = useCallback(() => setSheet(null), []);
  const dismissUndo = useCallback(() => setUndo(null), []);

  // ── Guardado inmediato con "Deshacer" ──────────

  async function syncIncomeTotal(entries: IncomeEntry[]) {
    const total = Math.round(entries.reduce((a, e) => a + incomeMonthly(e), 0) * 100) / 100;
    await supabase.from('financial_profiles').update({ total_income: total }).eq('household_id', householdId);
  }

  /** Recalcula `budgeted_amount` de la categoría con sus partes (Inicio lo usa). */
  async function syncCategoryAmount(catId: string, subs: BudgetSubItem[]) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const amount = Math.round(categoryPlan(cat, subs) * 100) / 100;
    await supabase.from('budget_categories').update({ budgeted_amount: amount }).eq('id', catId);
  }

  async function finish(title: string, run: Undo['run'] | null, flashOn?: string) {
    await load();
    setCapAlertArmed(true);
    setSheet(null);
    if (flashOn) flash(flashOn);
    if (run) setUndo({ title, run });
    else setMessage({ text: title, tone: 'ok' });
  }

  function fail() {
    setMessage({ text: 'No se pudo guardar el cambio. Intenta de nuevo.', tone: 'error' });
  }

  async function guarded(fn: () => Promise<void>) {
    if (saving) return;
    setUndo(null);
    setSaving(true);
    try { await fn(); } catch { fail(); }
    setSaving(false);
  }

  async function saveCategory(catId: string, isGoal: boolean, d: PlanDraft) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const prev = { budgeted_amount: cat.budgeted_amount, pace_mode: cat.pace_mode, expected_day: cat.expected_day };
    const patch = isGoal
      ? { budgeted_amount: d.amount }
      : { budgeted_amount: d.amount, pace_mode: d.fixed ? 'fixed' : 'linear', expected_day: d.fixed ? d.day : null };
    const { error } = await supabase.from('budget_categories').update(patch).eq('id', catId);
    if (error) { fail(); return; }
    await finish(`${cat.name}: ahora planeas ${fmt(d.amount)}`, () =>
      supabase.from('budget_categories').update(prev).eq('id', catId), catId);
  }

  async function savePart(categoryId: string, partId: string | null, d: PlanDraft) {
    const name = d.name.trim() || 'Otra parte';
    const fields = { name, is_fixed: d.fixed, expected_day: d.fixed ? d.day : null };
    const cat = categories.find((c) => c.id === categoryId);
    const prevCatAmount = cat?.budgeted_amount ?? 0;
    const restoreCat = () => supabase.from('budget_categories').update({ budgeted_amount: prevCatAmount }).eq('id', categoryId);

    if (!partId) {
      const { data, error } = await supabase
        .from('budget_sub_items')
        .insert({ ...fields, category_id: categoryId, household_id: householdId, amount: d.amount })
        .select()
        .single();
      if (error || !data) { fail(); return; }
      await syncCategoryAmount(categoryId, [...subItems, data as BudgetSubItem]);
      setExpanded((s) => new Set(s).add(categoryId));
      await finish(`${name}: ahora planeas ${fmt(d.amount)}`, async () => {
        await supabase.from('budget_sub_items').delete().eq('id', (data as BudgetSubItem).id);
        await restoreCat();
      }, (data as BudgetSubItem).id);
      return;
    }

    const s = subItems.find((x) => x.id === partId);
    if (!s) return;
    const prev = { name: s.name, amount: s.amount, is_fixed: s.is_fixed, expected_day: s.expected_day ?? null };
    const updated = { ...fields, amount: subAmountFromMonthly(d.amount, s.recurrence) };
    const { error } = await supabase.from('budget_sub_items').update(updated).eq('id', partId);
    if (error) { fail(); return; }
    await syncCategoryAmount(categoryId, subItems.map((x) => (x.id === partId ? { ...x, ...updated } : x)));
    await finish(`${name}: ahora planeas ${fmt(d.amount)}`, async () => {
      await supabase.from('budget_sub_items').update(prev).eq('id', partId);
      await restoreCat();
    }, partId);
  }

  async function saveIncome(id: string | null, d: PlanDraft) {
    if (!(d.amount > 0)) { setMessage({ text: 'Falta el monto.', tone: 'error' }); return; }
    const name = d.name.trim() || 'Otro ingreso';
    const existing = id ? incomes.find((e) => e.id === id) : undefined;
    const categoryId = existing?.category_id ?? inferIncomeCategory(name, d.fixed, incomeCats)?.id ?? null;
    const fields = { source: name, is_fixed: d.fixed, expected_day: d.fixed ? d.day : null, category_id: categoryId };
    const title = `${name}: esperas ${fmt(d.amount)} al mes`;

    if (!existing) {
      const { data, error } = await supabase
        .from('income_entries')
        .insert({ ...fields, household_id: householdId, member: 'Persona 1', amount: d.amount, frequency: 'mensual' })
        .select()
        .single();
      if (error || !data) { fail(); return; }
      const next = [...incomes, data as IncomeEntry];
      await syncIncomeTotal(next);
      await finish(title, async () => {
        await supabase.from('income_entries').delete().eq('id', (data as IncomeEntry).id);
        await syncIncomeTotal(incomes);
      }, (data as IncomeEntry).id);
      return;
    }

    const prev = {
      source: existing.source, amount: existing.amount, is_fixed: existing.is_fixed ?? true,
      expected_day: existing.expected_day ?? null, category_id: existing.category_id ?? null,
    };
    const updated = { ...fields, amount: incomeAmountFromMonthly(d.amount, existing.frequency) };
    const { error } = await supabase.from('income_entries').update(updated).eq('id', existing.id);
    if (error) { fail(); return; }
    await syncIncomeTotal(incomes.map((e) => (e.id === existing.id ? { ...e, ...updated } : e)));
    await finish(title, async () => {
      await supabase.from('income_entries').update(prev).eq('id', existing.id);
      await syncIncomeTotal(incomes);
    }, existing.id);
  }

  async function splitCategory(catId: string, d: PlanDraft) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const { data, error } = await supabase
      .from('budget_sub_items')
      .insert({
        category_id: catId, household_id: householdId, name: `${cat.name} en general`,
        amount: d.amount, is_fixed: d.fixed, expected_day: d.fixed ? d.day : null,
      })
      .select()
      .single();
    if (error || !data) { fail(); return; }
    // El gasto del mes de la categoría pasa a la parte nueva.
    const { from, to } = monthRange(month);
    await supabase
      .from('transactions')
      .update({ budget_sub_item_id: (data as BudgetSubItem).id })
      .eq('household_id', householdId)
      .eq('category_id', catId)
      .is('budget_sub_item_id', null)
      .gte('date', from)
      .lte('date', to);
    await supabase.from('budget_categories').update({ budgeted_amount: d.amount }).eq('id', catId);
    setExpanded((s) => new Set(s).add(catId));
    await load();
    flash((data as BudgetSubItem).id);
    // Abre la hoja de una parte nueva.
    setSheet({
      ref: { kind: 'part', id: null, categoryId: catId },
      key: Date.now(),
      target: {
        kind: 'part', isNew: true, emoji: getEmoji(cat), title: cat.name, subtitle: 'Nueva parte',
        initial: { name: '', amount: 0, fixed: false, day: null }, spent: 0, last: null,
        canSplit: false, canRemove: false,
      },
    });
  }

  async function removePart(partId: string) {
    const s = subItems.find((x) => x.id === partId);
    if (!s) return;
    const catId = s.category_id;
    const cat = categories.find((c) => c.id === catId);
    const prevCatAmount = cat?.budgeted_amount ?? 0;
    const { data: linked } = await supabase.from('transactions').select('id').eq('budget_sub_item_id', partId);
    const linkedIds = ((linked ?? []) as { id: string }[]).map((t) => t.id);
    // ON DELETE SET NULL deja sus movimientos sin parte.
    const { error } = await supabase.from('budget_sub_items').delete().eq('id', partId);
    if (error) { fail(); return; }
    const rest = subItems.filter((x) => x.id !== partId && x.category_id === catId);
    // Si era la última parte, su monto vuelve a la categoría.
    const catAmount = rest.length > 0 ? rest.reduce((a, x) => a + subMonthly(x), 0) : subMonthly(s);
    await supabase.from('budget_categories').update({ budgeted_amount: Math.round(catAmount * 100) / 100 }).eq('id', catId);
    await finish('Quitaste esa parte', async () => {
      const row: Record<string, unknown> = {
        id: s.id, category_id: s.category_id, household_id: s.household_id, name: s.name,
        amount: s.amount, is_fixed: s.is_fixed, expected_day: s.expected_day ?? null,
      };
      if (s.recurrence) row.recurrence = s.recurrence;
      if (s.payment_method) row.payment_method = s.payment_method;
      await supabase.from('budget_sub_items').insert(row);
      if (linkedIds.length) await supabase.from('transactions').update({ budget_sub_item_id: s.id }).in('id', linkedIds);
      await supabase.from('budget_categories').update({ budgeted_amount: prevCatAmount }).eq('id', catId);
    });
  }

  async function removeIncome(id: string) {
    const e = incomes.find((x) => x.id === id);
    if (!e) return;
    const { error } = await supabase.from('income_entries').delete().eq('id', id);
    if (error) { fail(); return; }
    await syncIncomeTotal(incomes.filter((x) => x.id !== id));
    await finish(`Quitaste ${e.source || 'ese ingreso'}`, async () => {
      const row: Record<string, unknown> = {
        id: e.id, household_id: householdId, source: e.source, member: e.member, amount: e.amount,
        frequency: e.frequency, is_fixed: e.is_fixed ?? true, expected_day: e.expected_day ?? null,
        category_id: e.category_id ?? null,
      };
      await supabase.from('income_entries').insert(row);
      await syncIncomeTotal(incomes);
    });
  }

  // "Mandar Q x al Colchón": suma lo sin asignar al Fondo de emergencia.
  const cushion = planCats.find((c) => c.bucket === 'savings' && norm(c.name) === 'fondo de emergencia')
    ?? planCats.find((c) => c.bucket === 'savings' && /emergencia|colchon/.test(norm(c.name)));

  async function sendToCushion() {
    if (!cushion) return;
    const un = summary.unassigned;
    const parts = subsOf(cushion.id);
    if (parts.length > 0) {
      const first = parts[0];
      const prevAmount = first.amount;
      const { error } = await supabase.from('budget_sub_items')
        .update({ amount: subAmountFromMonthly(subMonthly(first) + un, first.recurrence) }).eq('id', first.id);
      if (error) { fail(); return; }
      await syncCategoryAmount(cushion.id, subItems.map((x) => (x.id === first.id
        ? { ...x, amount: subAmountFromMonthly(subMonthly(first) + un, first.recurrence) } : x)));
      await finish(`Mandaste ${fmt(un)} al Colchón`, async () => {
        await supabase.from('budget_sub_items').update({ amount: prevAmount }).eq('id', first.id);
        await syncCategoryAmount(cushion.id, subItems);
      }, cushion.id);
      return;
    }
    const prev = Number(cushion.budgeted_amount) || 0;
    const next = Math.round((prev + un) * 100) / 100;
    const { error } = await supabase.from('budget_categories').update({ budgeted_amount: next }).eq('id', cushion.id);
    if (error) { fail(); return; }
    await finish(`Mandaste ${fmt(un)} al Colchón`, () =>
      supabase.from('budget_categories').update({ budgeted_amount: prev }).eq('id', cushion.id), cushion.id);
  }

  async function runUndo() {
    const u = undo;
    setUndo(null);
    if (!u) return;
    try { await u.run(); } catch { fail(); }
    await load();
  }

  async function confirmIncomeForMonth() {
    if (!confirmMonth || !householdId) return;
    setConfirmingIncome(true);
    await supabase.from('income_month_confirmations').upsert(
      { household_id: householdId, year_month: confirmMonth, confirmed: true, confirmed_at: new Date().toISOString() },
      { onConflict: 'household_id,year_month' },
    );
    setConfirmingIncome(false);
    router.push(`/cierre-mes?month=${confirmMonth}`);
  }

  // ── Vista ───────────────────────────────────────

  const goalStatus: RowStatus = { text: 'Se aparta cuando te pagan', tone: 'muted', pct: 0, bar: 'normal' };

  function incomeRowStatus(e: IncomeEntry, monthly: number, fixed: boolean): RowStatus {
    const rec = derived.received[e.id] ?? 0;
    const st = incomeStatus(monthly, rec, fixed, e.expected_day ?? null, fmt);
    // Fijo que apagaste en el inicio de mes y todavía no llega.
    if (fixed && rec === 0 && monthStart.choices?.income[e.id] === false) {
      return { ...st, text: 'No cuenta hasta que llegue', tone: 'warning' };
    }
    return st;
  }

  const incomeGroup: PlanGroupVM = {
    key: 'income',
    title: 'Ingresos',
    hint: 'tus ingresos',
    total: fmt(summary.income),
    onAdd: () => openSheet({ kind: 'income', id: null }),
    addLabel: '+ Agregar ingreso',
    rows: incomes.map((e) => {
      const cat = categories.find((c) => c.id === derived.incomeCatOf[e.id]);
      const monthly = incomeMonthly(e);
      const fixed = e.is_fixed ?? true;
      return {
        key: e.id,
        emoji: cat ? getEmoji(cat) : '💰',
        name: e.source || 'Ingreso',
        fixed,
        amount: fmt(monthly),
        status: incomeRowStatus(e, monthly, fixed),
        hasBar: true,
        onClick: () => openSheet({ kind: 'income', id: e.id }),
        flash: flashKey === e.id,
      };
    }),
  };

  const expenseGroups: PlanGroupVM[] = EXPENSE_GROUPS.map((g) => {
    const isGoal = g.bucket === 'savings';
    const cats = planCats.filter((c) => c.bucket === g.bucket);
    const rows: PlanRowVM[] = cats.map((c) => {
      const parts = subsOf(c.id);
      const plan = categoryPlan(c, subItems);
      const spent = derived.spentCat[c.id] ?? 0;
      if (parts.length === 0) {
        const fixed = !isGoal && c.pace_mode === 'fixed';
        return {
          key: c.id, emoji: getEmoji(c), name: c.name, fixed, amount: fmt(plan),
          status: isGoal ? goalStatus : expenseStatus(plan, spent, fixed, fmt, fixed ? reservedLeaf(c.id, c.expected_day ?? null) : undefined),
          hasBar: !isGoal,
          onClick: () => openSheet({ kind: isGoal ? 'goal' : 'category', id: c.id }),
          flash: flashKey === c.id,
        };
      }
      const st = isGoal ? goalStatus : expenseStatus(plan, spent, false, fmt);
      const open = expanded.has(c.id);
      return {
        key: c.id, emoji: getEmoji(c), name: c.name,
        fixed: !isGoal && parts.every((p) => p.is_fixed),
        amount: fmt(plan),
        status: { ...st, text: `${parts.length} ${parts.length === 1 ? 'parte' : 'partes'} · ${st.text}` },
        hasBar: !isGoal,
        open,
        onClick: () => setExpanded((s) => {
          const next = new Set(s);
          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
          return next;
        }),
        onAddPart: () => openSheet({ kind: 'part', id: null, categoryId: c.id }),
        flash: flashKey === c.id,
        parts: parts.map((p) => {
          const pp = subMonthly(p);
          return {
            key: p.id, name: p.name, fixed: !isGoal && p.is_fixed, amount: fmt(pp),
            status: isGoal ? goalStatus : expenseStatus(
              pp, derived.spentSub[p.id] ?? 0, p.is_fixed, fmt,
              p.is_fixed ? reservedLeaf(p.id, p.expected_day ?? null) : undefined,
            ),
            onClick: () => openSheet({ kind: 'part', id: p.id, categoryId: c.id }),
          };
        }),
      };
    });
    return {
      key: g.bucket, title: g.title, hint: g.hint,
      total: fmt(g.bucket === 'needs' ? summary.needs : g.bucket === 'wants' ? summary.wants : summary.savings),
      rows,
    };
  });

  function onSave(d: PlanDraft) {
    if (!sheet) return;
    const ref = sheet.ref;
    void guarded(async () => {
      if (ref.kind === 'income') await saveIncome(ref.id, d);
      else if (ref.kind === 'part') await savePart(ref.categoryId, ref.id, d);
      else await saveCategory(ref.id, ref.kind === 'goal', d);
    });
  }

  function onSplit(d: PlanDraft) {
    if (sheet?.ref.kind !== 'category') return;
    const id = sheet.ref.id;
    void guarded(() => splitCategory(id, d));
  }

  function onRemove() {
    if (!sheet) return;
    const ref = sheet.ref;
    if (ref.kind === 'part' && ref.id) void guarded(() => removePart(ref.id!));
    if (ref.kind === 'income' && ref.id) void guarded(() => removeIncome(ref.id!));
  }

  if (loading) return <SkeletonRows count={6} className="mt-3" />;

  return (
    <>
      <div className="flex max-w-2xl flex-col">
        <div className="flex flex-col zafi-stagger">
          {/* Llegaste desde "Cerrar el mes" a confirmar ingresos */}
          {confirmMonth && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--zafi-success-border)] bg-[var(--zafi-success-bg)] px-4 py-3.5">
              <span className="text-[13px] leading-normal text-[var(--zafi-success-text)]">
                Revisa que tus ingresos estén correctos y actualizados para este cierre de mes.
              </span>
              <button
                type="button"
                onClick={confirmIncomeForMonth}
                disabled={confirmingIncome}
                className="flex h-11 flex-none items-center gap-2 rounded-xl bg-success-dark px-4 text-[13px] font-semibold text-white"
              >
                {confirmingIncome ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Ya revisé, confirmar
              </button>
            </div>
          )}

          <PlanSummaryCard
            summary={summary}
            fmt={fmt}
            onSendToCushion={cushion ? () => void guarded(sendToCushion) : undefined}
          />

          {capAlertArmed && capAlert.length > 0 && (
            <div role="note" className="mt-3 flex items-start gap-2.5 rounded-[14px] bg-warning-light px-3.5 py-3 dark:bg-warning/15">
              <span aria-hidden className="text-lg leading-none">⚠️</span>
              <span className="text-[13.5px] leading-[1.4] text-warning-text [text-wrap:pretty] dark:text-warning">
                <b>Tu plan de {monthName0}</b> pasa tus topes en {capListText(capAlert)}.{' '}
                <Link href="/resumen" className="font-semibold underline">Ver en Cómo te fue</Link>
              </span>
            </div>
          )}

          {monthStart.loaded && (
            <MonthStartNotice
              variant="plan"
              monthName={monthName0}
              done={monthStart.done}
              summary={monthStart.summary}
              onOpen={monthStart.open}
            />
          )}

          <PlanGroups groups={[incomeGroup, ...expenseGroups]} />

          <p className={`mx-1 mt-3.5 text-center text-[13px] leading-normal [text-wrap:pretty] ${TEXT_MUTED}`}>
            Toca cualquier categoría para cambiar cuánto planeas.
          </p>

          <div className="mt-5">
            <Link
              href="/plan/retos"
              className={`flex min-h-[44px] items-center justify-center text-sm font-semibold text-electric`}
            >
              Retos del mes ›
            </Link>
          </div>
        </div>
      </div>

      <BottomSheet themed open={!!sheet} onClose={closeSheet} label="Editar plan">
        {sheet && (
          <EditPlanSheet
            key={sheet.key}
            target={sheet.target}
            month={monthName0}
            unassigned={summary.unassigned}
            fmt={fmt}
            saving={saving}
            onSave={onSave}
            onSplit={onSplit}
            onRemove={onRemove}
          />
        )}
      </BottomSheet>

      {monthStart.element}

      <UndoToast
        key={undo?.title}
        visible={!!undo}
        title={undo?.title ?? ''}
        onUndo={() => void runUndo()}
        onDismiss={dismissUndo}
        duration={DELETE_UNDO_MS}
      />
      <StatusToast message={message} onDone={() => setMessage(null)} />
    </>
  );
}
