'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { localMonth } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { BudgetCategory, BudgetSubItem } from '@/types';
import type { IncomeEntry } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { TransactionPreview } from '@/components/voice/TransactionPreview';
import type { VoiceExtractionResult } from '@/types';
import { IncomeSection } from '@/components/presupuesto/IncomeSection';
import { BudgetHealthHero } from '@/components/presupuesto/BudgetHealthHero';
import { BudgetDefinition } from '@/components/presupuesto/BudgetDefinition';
import { BudgetComparativo } from '@/components/presupuesto/BudgetComparativo';

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  mensual: 1,
  quincenal: 2,
  semanal: 4.33,
  anual: 1 / 12,
};

export default function PresupuestoPage() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [subItems, setSubItems] = useState<BudgetSubItem[]>([]);
  const [income, setIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [householdId, setHouseholdId] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({});
  const [comparativoMonth, setComparativoMonth] = useState<string>(() => localMonth());
  const [loadingComparativo, setLoadingComparativo] = useState(false);

  const [definitionLevel, setDefinitionLevel] = useState<0 | 1 | 2>(0);
  const [comparativoLevel, setComparativoLevel] = useState<0 | 1 | 2>(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: hh } = await supabase
        .from('households')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single();

      if (!hh) { router.push('/onboarding'); return; }
      setHouseholdId(hh.id);

      const [{ data: cats }, { data: fp }, { data: subs }, { data: entries }] = await Promise.all([
        supabase.from('budget_categories').select('*').eq('household_id', hh.id),
        supabase.from('financial_profiles').select('total_income').eq('household_id', hh.id).limit(1).single(),
        supabase.from('budget_sub_items').select('*').eq('household_id', hh.id).order('created_at', { ascending: true }),
        supabase.from('income_entries').select('*').eq('household_id', hh.id).order('created_at', { ascending: true }),
      ]);

      setCategories((cats || []) as BudgetCategory[]);
      setSubItems((subs || []) as BudgetSubItem[]);

      const loadedEntries = (entries || []) as IncomeEntry[];
      setIncomeEntries(loadedEntries);
      if (loadedEntries.length > 0) {
        const total = loadedEntries.reduce((s, e) => s + Number(e.amount) * (FREQUENCY_MULTIPLIER[e.frequency] || 1), 0);
        setIncome(Math.round(total * 100) / 100);
      } else {
        setIncome(fp ? Number(fp.total_income) : 0);
      }
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!householdId) return;
    async function loadComparativo() {
      setLoadingComparativo(true);
      const [y, m] = comparativoMonth.split('-').map(Number);
      const from = `${comparativoMonth}-01`;
      const to = `${comparativoMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
      const { data: txs } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('household_id', householdId)
        .gte('date', from)
        .lte('date', to);
      const spent: Record<string, number> = {};
      (txs || []).forEach((tx: { category_id: string; amount: number }) => {
        spent[tx.category_id] = (spent[tx.category_id] || 0) + Number(tx.amount);
      });
      setSpentByCategory(spent);
      setLoadingComparativo(false);
    }
    loadComparativo();
  }, [householdId, comparativoMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  function recalcAndSyncIncome(entries: IncomeEntry[]) {
    const total = entries.reduce((s, e) => s + Number(e.amount) * (FREQUENCY_MULTIPLIER[e.frequency] || 1), 0);
    const rounded = Math.round(total * 100) / 100;
    setIncome(rounded);
    if (householdId) {
      void supabase.from('financial_profiles').update({ total_income: rounded }).eq('household_id', householdId);
    }
  }

  async function addIncomeEntry(source?: string) {
    if (!householdId) return;
    const { data } = await supabase
      .from('income_entries')
      .insert({ household_id: householdId, source: source || '', member: 'Persona 1', amount: 0, frequency: 'mensual' })
      .select()
      .single();
    if (data) {
      const updated = [...incomeEntries, data as IncomeEntry];
      setIncomeEntries(updated);
      recalcAndSyncIncome(updated);
    }
  }

  function updateIncomeEntry(id: string, field: string, value: string | number) {
    const updated = incomeEntries.map(e => e.id === id ? { ...e, [field]: value } : e);
    setIncomeEntries(updated);
    recalcAndSyncIncome(updated);
    void supabase.from('income_entries').update({ [field]: value }).eq('id', id);
  }

  async function deleteIncomeEntry(id: string) {
    await supabase.from('income_entries').delete().eq('id', id);
    const updated = incomeEntries.filter(e => e.id !== id);
    setIncomeEntries(updated);
    recalcAndSyncIncome(updated);
  }

  function monthlyAmount(amount: number, freq: string): number {
    if (freq === 'trimestral') return amount / 3;
    if (freq === 'anual') return amount / 12;
    return amount;
  }

  const getCategoryTotal = useCallback((catId: string): number => {
    const catSubs = subItems.filter(s => s.category_id === catId);
    if (catSubs.length > 0) {
      return catSubs.reduce((s, sub) => s + monthlyAmount(Number(sub.amount), sub.recurrence || 'mensual'), 0);
    }
    const cat = categories.find(c => c.id === catId);
    return cat ? Number(cat.budgeted_amount) : 0;
  }, [subItems, categories]);

  const bucketTotals = {
    needs: categories.filter(c => c.bucket === 'needs').reduce((s, c) => s + getCategoryTotal(c.id), 0),
    wants: categories.filter(c => c.bucket === 'wants').reduce((s, c) => s + getCategoryTotal(c.id), 0),
    savings: categories.filter(c => c.bucket === 'savings').reduce((s, c) => s + getCategoryTotal(c.id), 0),
  };
  const totalBudgeted = bucketTotals.needs + bucketTotals.wants + bucketTotals.savings;
  const remaining = income - totalBudgeted;

  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleGroup(bucket: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket); else next.add(bucket);
      return next;
    });
  }

  function updateAmount(id: string, amount: number) {
    setCategories(cats => cats.map(c => c.id === id ? { ...c, budgeted_amount: amount } : c));
    setSaved(false);
  }

  function updateSubAmount(id: string, amount: number) {
    setSubItems(items => items.map(s => s.id === id ? { ...s, amount } : s));
    setSaved(false);
  }

  async function saveAll() {
    setSaving(true);
    const promises = categories.map(cat =>
      supabase.from('budget_categories')
        .update({ budgeted_amount: getCategoryTotal(cat.id) })
        .eq('id', cat.id)
    );
    for (const sub of subItems) {
      const updateData: Record<string, unknown> = { amount: sub.amount };
      if (sub.recurrence && sub.recurrence !== 'mensual') {
        updateData.recurrence = sub.recurrence;
      }
      promises.push(
        supabase.from('budget_sub_items')
          .update(updateData)
          .eq('id', sub.id)
      );
    }
    await Promise.all(promises);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function deleteCategory(id: string) {
    await supabase.from('budget_categories').delete().eq('id', id);
    setCategories(cats => cats.filter(c => c.id !== id));
    setSubItems(items => items.filter(s => s.category_id !== id));
  }

  async function addSubItem(categoryId: string, name: string, amount: number, isFixed: boolean, payment: BudgetSubItem['payment_method'], recurrence: BudgetSubItem['recurrence']) {
    const baseData = {
      category_id: categoryId,
      household_id: householdId,
      name,
      amount,
      is_fixed: isFixed,
    };

    let result = await supabase
      .from('budget_sub_items')
      .insert({ ...baseData, payment_method: payment, recurrence })
      .select()
      .single();

    if (result.error) {
      result = await supabase
        .from('budget_sub_items')
        .insert({ ...baseData, payment_method: payment })
        .select()
        .single();
    }
    if (result.error) {
      result = await supabase
        .from('budget_sub_items')
        .insert(baseData)
        .select()
        .single();
    }

    if (result.data) {
      setSubItems(prev => [...prev, result.data as BudgetSubItem]);
      setSaved(false);
    }
  }

  async function updateSubPayment(id: string, method: BudgetSubItem['payment_method']) {
    await supabase.from('budget_sub_items').update({ payment_method: method }).eq('id', id);
    setSubItems(items => items.map(s => s.id === id ? { ...s, payment_method: method } : s));
  }

  async function updateSubRecurrence(id: string, recurrence: BudgetSubItem['recurrence']) {
    await supabase.from('budget_sub_items').update({ recurrence }).eq('id', id);
    setSubItems(items => items.map(s => s.id === id ? { ...s, recurrence } : s));
    setSaved(false);
  }

  async function addCategoryToBucket(bucket: 'needs' | 'wants' | 'savings', name: string) {
    const { data } = await supabase
      .from('budget_categories')
      .insert({ household_id: householdId, name, bucket, budgeted_amount: 0, is_custom: true })
      .select()
      .single();
    if (data) {
      setCategories(prev => [...prev, data as BudgetCategory]);
    }
  }

  async function deleteSubItem(id: string) {
    await supabase.from('budget_sub_items').delete().eq('id', id);
    setSubItems(items => items.filter(s => s.id !== id));
    setSaved(false);
  }

  async function toggleSubFixed(id: string) {
    const sub = subItems.find(s => s.id === id);
    if (!sub) return;
    const newFixed = !sub.is_fixed;
    await supabase.from('budget_sub_items').update({ is_fixed: newFixed }).eq('id', id);
    setSubItems(items => items.map(s => s.id === id ? { ...s, is_fixed: newFixed } : s));
  }

  function distributeByRule() {
    if (remaining <= 0 || income <= 0) return;
    const targets = { needs: 0.5, wants: 0.3, savings: 0.2 };
    const gaps: Record<string, number> = {};
    let sumGaps = 0;
    for (const bucket of ['needs', 'wants', 'savings'] as const) {
      const target = income * targets[bucket];
      const assigned = bucketTotals[bucket];
      const gap = Math.max(0, target - assigned);
      gaps[bucket] = gap;
      sumGaps += gap;
    }
    if (sumGaps <= 0) return;
    const ratio = Math.min(1, remaining / sumGaps);

    const updatedCategories = [...categories];
    for (const bucket of ['needs', 'wants', 'savings'] as const) {
      const bucketGap = gaps[bucket] * ratio;
      if (bucketGap <= 0) continue;
      const bucketCats = updatedCategories.filter(c => c.bucket === bucket);
      if (bucketCats.length === 0) continue;
      const totalWeight = bucketCats.reduce((s, c) => s + getCategoryTotal(c.id), 0);
      for (const cat of bucketCats) {
        const catSubs = subItems.filter(s => s.category_id === cat.id);
        if (catSubs.length > 0) continue;
        const weight = totalWeight > 0 ? getCategoryTotal(cat.id) / totalWeight : 1 / bucketCats.length;
        const addition = bucketGap * weight;
        cat.budgeted_amount = Math.round((Number(cat.budgeted_amount) + addition) * 100) / 100;
      }
    }
    setCategories(updatedCategories);
    setSaved(false);
  }

  async function saveVoiceTransactions(transactions: VoiceExtractionResult['transactions']) {
    if (!householdId) return;
    await supabase.from('transactions').insert(
      transactions.map(tx => ({
        household_id: householdId,
        category_id: tx.category_id ?? null,
        amount: tx.amount,
        description: tx.description,
        date: tx.date,
        source: 'voice',
        voice_raw_text: voiceResult?.raw_text ?? null,
      }))
    );
    setVoiceResult(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric-light animate-spin" />
      </div>
    );
  }

  return (
    <AppShell
      title="Presupuesto"
      currentPath="/presupuesto"
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VoiceButton
            mode="expense"
            onExtraction={(result) => { setVoiceResult(result); setVoiceError(null); }}
            onError={(err) => setVoiceError(err)}
          />
          <Button onClick={saveAll} disabled={saving} style={{
            background: '#2563EB', color: '#fff', borderRadius: 10,
            padding: '8px 18px', fontSize: 13, fontWeight: 600,
          }}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-4 h-4 mr-2" style={{ color: '#10B981' }} />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saved ? 'Guardado' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Subtitle */}
        <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 20px' }}>
          Ingreso mensual: {fmt(income)}
        </p>

        {/* Voice error/preview */}
        {voiceError && (
          <div style={{
            marginBottom: 16, padding: 12, borderRadius: 12,
            background: '#FEF2F2', border: '1px solid #FECACA',
            fontSize: 13, color: '#DC2626',
          }}>
            {voiceError}
          </div>
        )}
        {voiceResult && (
          <div style={{ marginBottom: 20 }}>
            <TransactionPreview
              result={voiceResult}
              onConfirm={saveVoiceTransactions}
              onCancel={() => setVoiceResult(null)}
            />
          </div>
        )}

        {/* Ingresos */}
        <IncomeSection
          income={income}
          incomeEntries={incomeEntries}
          onAddIncomeEntry={addIncomeEntry}
          onUpdateIncomeEntry={updateIncomeEntry}
          onDeleteIncomeEntry={deleteIncomeEntry}
          fmt={fmt}
        />

        {/* Hero: Salud de tu presupuesto */}
        <BudgetHealthHero
          income={income}
          bucketTotals={bucketTotals}
          categories={categories}
          spentByCategory={spentByCategory}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onDistribute={distributeByRule}
          getCategoryTotal={getCategoryTotal}
          fmt={fmt}
        />

        {/* Definición del presupuesto */}
        <BudgetDefinition
          level={definitionLevel}
          onSetLevel={setDefinitionLevel}
          income={income}
          incomeEntries={incomeEntries}
          categories={categories}
          subItems={subItems}
          bucketTotals={bucketTotals}
          totalBudgeted={totalBudgeted}
          expandedCats={expandedCats}
          onToggleCat={toggleCat}
          onUpdateAmount={updateAmount}
          onUpdateSubAmount={updateSubAmount}
          onDeleteCategory={deleteCategory}
          onDeleteSubItem={deleteSubItem}
          onToggleSubFixed={toggleSubFixed}
          onUpdateSubPayment={updateSubPayment}
          onUpdateSubRecurrence={updateSubRecurrence}
          onAddSubItem={addSubItem}
          onAddCategory={addCategoryToBucket}
          onAddIncomeEntry={addIncomeEntry}
          onUpdateIncomeEntry={updateIncomeEntry}
          onDeleteIncomeEntry={deleteIncomeEntry}
          getCategoryTotal={getCategoryTotal}
          monthlyAmount={monthlyAmount}
          fmt={fmt}
        />

        {/* Comparativo */}
        <BudgetComparativo
          level={comparativoLevel}
          onSetLevel={setComparativoLevel}
          month={comparativoMonth}
          onMonthChange={setComparativoMonth}
          categories={categories}
          spentByCategory={spentByCategory}
          totalBudgeted={totalBudgeted}
          loading={loadingComparativo}
          getCategoryTotal={getCategoryTotal}
          fmt={fmt}
        />
      </div>
    </AppShell>
  );
}
