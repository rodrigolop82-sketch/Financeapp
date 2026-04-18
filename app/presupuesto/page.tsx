'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { localMonthStart } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BudgetChart } from '@/components/charts/budget-chart';
import { BudgetCategory, BudgetSubItem } from '@/types';
import type { IncomeEntry } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  X,
} from 'lucide-react';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { TransactionPreview } from '@/components/voice/TransactionPreview';
import type { VoiceExtractionResult } from '@/types';
import { AppShell } from '@/components/layout/AppShell';

const INCOME_SUGGESTIONS = ['Salario', 'Bonos', 'Freelance', 'Alquiler', 'Negocio', 'Pensión', 'Remesas', 'Otros'];

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  mensual: 1,
  quincenal: 2,
  semanal: 4.33,
  anual: 1 / 12,
};

const BUCKET_LABELS = {
  needs: { label: 'Necesidades (50%)', color: 'bg-navy', textColor: 'text-electric-dark' },
  wants: { label: 'Gustos (30%)', color: 'bg-electric-light', textColor: 'text-electric-light' },
  savings: { label: 'Ahorro/Deudas (20%)', color: 'bg-electric-soft', textColor: 'text-electric-dark' },
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
  const [addingSubItem, setAddingSubItem] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState(0);
  const [newSubFixed, setNewSubFixed] = useState(false);
  const [newSubPayment, setNewSubPayment] = useState<'efectivo' | 'tarjeta' | 'cheque' | 'transferencia'>('efectivo');
  const [newSubFrequency, setNewSubFrequency] = useState<'mensual' | 'trimestral' | 'anual'>('mensual');
  const [addingCatBucket, setAddingCatBucket] = useState<'needs' | 'wants' | 'savings' | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({});
  const [budgetDefCollapsed, setBudgetDefCollapsed] = useState(true);
  const [comparativoCollapsed, setComparativoCollapsed] = useState(true);
  const [userId, setUserId] = useState('');
  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data: hh } = await supabase
        .from('households')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single();

      if (!hh) { router.push('/onboarding'); return; }
      setHouseholdId(hh.id);

      const monthStart = localMonthStart();

      const [{ data: cats }, { data: fp }, { data: subs }, { data: txs }] = await Promise.all([
        supabase.from('budget_categories').select('*').eq('household_id', hh.id),
        supabase.from('financial_profiles').select('total_income').eq('household_id', hh.id).limit(1).single(),
        supabase.from('budget_sub_items').select('*').eq('household_id', hh.id).order('created_at', { ascending: true }),
        supabase.from('transactions').select('category_id, amount').eq('household_id', hh.id).gte('date', monthStart),
      ]);

      // Aggregate spending by category
      const spent: Record<string, number> = {};
      (txs || []).forEach((tx: { category_id: string; amount: number }) => {
        spent[tx.category_id] = (spent[tx.category_id] || 0) + Number(tx.amount);
      });
      setSpentByCategory(spent);

      setCategories((cats || []) as BudgetCategory[]);
      setIncome(fp ? Number(fp.total_income) : 0);
      setSubItems((subs || []) as BudgetSubItem[]);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load income entries from localStorage
  useEffect(() => {
    if (!householdId) return;
    const stored = localStorage.getItem(`income_entries_${householdId}`);
    if (stored) setIncomeEntries(JSON.parse(stored));
  }, [householdId]);

  function saveIncomeEntries(entries: IncomeEntry[]) {
    setIncomeEntries(entries);
    if (householdId) {
      localStorage.setItem(`income_entries_${householdId}`, JSON.stringify(entries));
      // Sync total to Supabase
      const total = entries.reduce((s, e) => s + e.amount * (FREQUENCY_MULTIPLIER[e.frequency] || 1), 0);
      const roundedTotal = Math.round(total * 100) / 100;
      setIncome(roundedTotal);
      supabase.from('financial_profiles').update({ total_income: roundedTotal }).eq('household_id', householdId);
    }
  }

  function addIncomeEntry(source?: string) {
    const entry: IncomeEntry = {
      id: crypto.randomUUID(),
      source: source || '',
      member: 'Persona 1',
      amount: 0,
      frequency: 'mensual',
    };
    saveIncomeEntries([...incomeEntries, entry]);
  }

  function updateIncomeEntry(id: string, field: string, value: string | number) {
    const updated = incomeEntries.map(e => e.id === id ? { ...e, [field]: value } : e);
    saveIncomeEntries(updated);
  }

  function deleteIncomeEntry(id: string) {
    saveIncomeEntries(incomeEntries.filter(e => e.id !== id));
  }

  // Monthly multiplier for frequency
  function monthlyAmount(amount: number, freq: string): number {
    if (freq === 'trimestral') return amount / 3;
    if (freq === 'anual') return amount / 12;
    return amount;
  }

  // Calculate category total from sub-items (monthly equivalent), otherwise use budgeted_amount
  function getCategoryTotal(catId: string): number {
    const catSubs = subItems.filter(s => s.category_id === catId);
    if (catSubs.length > 0) {
      return catSubs.reduce((s, sub) => s + monthlyAmount(Number(sub.amount), sub.frequency || 'mensual'), 0);
    }
    const cat = categories.find(c => c.id === catId);
    return cat ? Number(cat.budgeted_amount) : 0;
  }

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    // Save category amounts (for those without sub-items)
    const promises = categories.map(cat =>
      supabase.from('budget_categories')
        .update({ budgeted_amount: getCategoryTotal(cat.id) })
        .eq('id', cat.id)
    );
    // Save sub-item amounts
    for (const sub of subItems) {
      const updateData: Record<string, unknown> = { amount: sub.amount };
      if (sub.frequency && sub.frequency !== 'mensual') {
        updateData.frequency = sub.frequency;
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

  async function addSubItem(categoryId: string) {
    if (!newSubName.trim()) return;
    // Build insert object — try with all columns, fallback gracefully
    const baseData = {
      category_id: categoryId,
      household_id: householdId,
      name: newSubName.trim(),
      amount: newSubAmount,
      is_fixed: newSubFixed,
    };

    // Try full insert first
    let result = await supabase
      .from('budget_sub_items')
      .insert({ ...baseData, payment_method: newSubPayment, frequency: newSubFrequency })
      .select()
      .single();

    // If it fails (missing columns), try without optional columns
    if (result.error) {
      result = await supabase
        .from('budget_sub_items')
        .insert({ ...baseData, payment_method: newSubPayment })
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

    const { data, error } = result;
    if (error) {
      console.error('Error adding sub-item:', error);
      return;
    }

    if (data) {
      setSubItems([...subItems, data as BudgetSubItem]);
      setNewSubName('');
      setNewSubAmount(0);
      setNewSubFixed(false);
      setNewSubPayment('efectivo');
      setNewSubFrequency('mensual');
      setAddingSubItem(null);
      setSaved(false);
    }
  }

  async function updateSubPayment(id: string, method: BudgetSubItem['payment_method']) {
    await supabase.from('budget_sub_items').update({ payment_method: method }).eq('id', id);
    setSubItems(items => items.map(s => s.id === id ? { ...s, payment_method: method } : s));
  }

  async function updateSubFrequency(id: string, frequency: BudgetSubItem['frequency']) {
    await supabase.from('budget_sub_items').update({ frequency }).eq('id', id);
    setSubItems(items => items.map(s => s.id === id ? { ...s, frequency } : s));
    setSaved(false);
  }

  async function addCategoryToBucket(bucket: 'needs' | 'wants' | 'savings') {
    if (!newCatName.trim()) return;
    const { data } = await supabase
      .from('budget_categories')
      .insert({
        household_id: householdId,
        name: newCatName.trim(),
        bucket,
        budgeted_amount: 0,
        is_custom: true,
      })
      .select()
      .single();

    if (data) {
      setCategories([...categories, data as BudgetCategory]);
      setNewCatName('');
      setAddingCatBucket(null);
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
        created_by: userId || null,
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
    <AppShell title="Presupuesto 50/30/20" currentPath="/presupuesto">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">Ingreso mensual: {fmt(income)}</p>
          <div className="flex items-center gap-2">
            <VoiceButton
              mode="expense"
              onExtraction={(result) => { setVoiceResult(result); setVoiceError(null); }}
              onError={(err) => setVoiceError(err)}
            />
            <Button onClick={saveAll} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-4 h-4 mr-2 text-electric-light" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saved ? 'Guardado' : 'Guardar'}
            </Button>
          </div>
        </div>

        {/* Voice transaction preview */}
        {voiceError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {voiceError}
          </div>
        )}
        {voiceResult && (
          <div className="mb-6">
            <TransactionPreview
              result={voiceResult}
              onConfirm={saveVoiceTransactions}
              onCancel={() => setVoiceResult(null)}
            />
          </div>
        )}

        {/* ─── SECCIÓN 1: Gráfica y medidores ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base text-navy">Distribución del presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BudgetChart
                needs={bucketTotals.needs}
                wants={bucketTotals.wants}
                savings={bucketTotals.savings}
              />
              <div className="space-y-4">
                {(['needs', 'wants', 'savings'] as const).map((bucket) => {
                  const info = BUCKET_LABELS[bucket];
                  const target = income * (bucket === 'needs' ? 0.5 : bucket === 'wants' ? 0.3 : 0.2);
                  const actual = bucketTotals[bucket];
                  const pct = income > 0 ? Math.round((actual / income) * 100) : 0;
                  return (
                    <div key={bucket}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium ${info.textColor}`}>{info.label}</span>
                        <span className="text-gray-600">
                          {fmt(actual)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${actual > target ? 'bg-red-400' : info.color}`}
                          style={{ width: `${income > 0 ? Math.min((actual / target) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Meta: {fmt(target)}
                      </p>
                    </div>
                  );
                })}
                <div className="pt-2 border-t">
                  <div className="flex justify-between font-medium">
                    <span>Sin asignar</span>
                    <span className={remaining < 0 ? 'text-red-500' : 'text-electric'}>
                      {fmt(remaining)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── SECCIÓN 2: Definición del presupuesto (colapsable) ─── */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-navy">Definición del presupuesto</CardTitle>
              <button onClick={() => setBudgetDefCollapsed(!budgetDefCollapsed)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
                <span>{budgetDefCollapsed ? 'Ver detalle' : 'Cerrar'}</span>
                {budgetDefCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
            {budgetDefCollapsed && (
              <p className="text-xs text-gray-400 mt-1">
                Ingresos: {fmt(income)} &middot; {categories.length} categorías &middot; Total asignado: {fmt(totalBudgeted)}
              </p>
            )}
          </CardHeader>
          {!budgetDefCollapsed && (
            <CardContent className="pt-0 space-y-4">
              {/* ── Ingresos ── */}
              <Card className="mb-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-success">Ingresos</CardTitle>
                    <span className="text-sm font-bold text-success">{fmt(income)}/mes</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Quick-add chips */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {INCOME_SUGGESTIONS.filter(s => !incomeEntries.some(e => e.source === s)).map((s) => (
                      <button
                        key={s}
                        onClick={() => addIncomeEntry(s)}
                        className="px-2.5 py-1 text-xs rounded-full border border-electric-soft text-electric hover:bg-electric-ghost transition-colors"
                      >
                        <Plus className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Income entries */}
                  <div className="space-y-1">
                    {incomeEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
                        <div className="w-1.5 h-6 rounded-full bg-[#10B981] flex-shrink-0" />
                        <Input
                          className="flex-1 h-7 text-sm min-w-0"
                          placeholder="Fuente"
                          value={entry.source}
                          onChange={(e) => updateIncomeEntry(entry.id, 'source', e.target.value)}
                        />
                        <select
                          className="text-xs border rounded px-1.5 py-1 bg-white text-gray-600 flex-shrink-0"
                          value={entry.member}
                          onChange={(e) => updateIncomeEntry(entry.id, 'member', e.target.value)}
                        >
                          <option value="Persona 1">Persona 1</option>
                          <option value="Persona 2">Persona 2</option>
                          <option value="Persona 3">Persona 3</option>
                          <option value="Hogar">Hogar</option>
                        </select>
                        <select
                          className="text-xs border rounded px-1.5 py-1 bg-white text-gray-600 flex-shrink-0"
                          value={entry.frequency}
                          onChange={(e) => updateIncomeEntry(entry.id, 'frequency', e.target.value)}
                        >
                          <option value="mensual">Mensual</option>
                          <option value="quincenal">Quincenal</option>
                          <option value="semanal">Semanal</option>
                          <option value="anual">Anual</option>
                        </select>
                        <div className="relative w-28 flex-shrink-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Q</span>
                          <Input
                            type="number"
                            className="pl-6 h-7 text-xs text-right"
                            placeholder="0"
                            value={entry.amount || ''}
                            onChange={(e) => updateIncomeEntry(entry.id, 'amount', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        {entry.frequency !== 'mensual' && entry.amount > 0 && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0 w-16 text-right">
                            {fmt(Math.round(entry.amount * (FREQUENCY_MULTIPLIER[entry.frequency] || 1) * 100) / 100)}/mes
                          </span>
                        )}
                        <button
                          onClick={() => deleteIncomeEntry(entry.id)}
                          className="text-gray-300 hover:text-red-500 flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => addIncomeEntry()}
                    className="mt-3 flex items-center gap-1 text-xs text-electric hover:text-electric-dark font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar ingreso
                  </button>

                  {incomeEntries.length > 0 && (
                    <div className="mt-4 pt-3 border-t flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Ingreso mensual total</span>
                      <span className="text-sm font-bold text-navy">{fmt(income)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Necesidades / Gustos / Ahorro ── */}
              {(['needs', 'wants', 'savings'] as const).map((bucket) => {
          const info = BUCKET_LABELS[bucket];
          const bucketCats = categories.filter(c => c.bucket === bucket);
          return (
            <Card key={bucket} className="mb-4">
              <CardHeader>
                <CardTitle className={`text-base ${info.textColor}`}>{info.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {bucketCats.map((cat) => {
                    const catSubs = subItems.filter(s => s.category_id === cat.id);
                    const hasSubs = catSubs.length > 0;
                    const isExpanded = expandedCats.has(cat.id);
                    const catTotal = getCategoryTotal(cat.id);
                    const fixedTotal = catSubs.filter(s => s.is_fixed).reduce((s, sub) => s + Number(sub.amount), 0);
                    const variableTotal = catSubs.filter(s => !s.is_fixed).reduce((s, sub) => s + Number(sub.amount), 0);

                    return (
                      <div key={cat.id} className="border rounded-lg overflow-hidden">
                        {/* Category header row */}
                        <div className="flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors">
                          <button
                            onClick={() => toggleCat(cat.id)}
                            className="flex items-center gap-2 flex-1 min-w-0"
                          >
                            <div className={`w-1.5 h-6 rounded-full ${info.color} flex-shrink-0`} />
                            <span className="text-sm font-medium truncate">{cat.name}</span>
                            {hasSubs && (
                              <span className="text-xs text-gray-400 flex-shrink-0">
                                ({catSubs.length} item{catSubs.length !== 1 ? 's' : ''})
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            )}
                          </button>

                          {/* Total amount — editable only if no sub-items */}
                          {hasSubs ? (
                            <span className="text-sm font-bold text-gray-700 w-28 text-right flex-shrink-0">
                              {fmt(catTotal)}
                            </span>
                          ) : (
                            <div className="relative w-28 flex-shrink-0">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Q</span>
                              <Input
                                type="number"
                                className="pl-6 h-8 text-sm text-right"
                                value={cat.budgeted_amount || ''}
                                onChange={(e) => updateAmount(cat.id, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          )}

                          {cat.is_custom && (
                            <button
                              onClick={() => deleteCategory(cat.id)}
                              className="text-gray-300 hover:text-red-500 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Expanded: sub-items */}
                        {isExpanded && (
                          <div className="border-t bg-gray-50 px-3 pb-3">
                            {/* Fixed/Variable summary */}
                            {hasSubs && (
                              <div className="flex gap-4 py-2 text-xs text-gray-500">
                                <span>Fijos: <strong className="text-gray-700">{fmt(fixedTotal)}</strong></span>
                                <span>Variables: <strong className="text-gray-700">{fmt(variableTotal)}</strong></span>
                              </div>
                            )}

                            {/* Sub-item list */}
                            <div className="space-y-1">
                              {catSubs.map((sub) => (
                                <div key={sub.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                                  <button
                                    onClick={() => toggleSubFixed(sub.id)}
                                    className="flex-shrink-0"
                                    title={sub.is_fixed ? 'Gasto fijo' : 'Gasto variable'}
                                  >
                                    {sub.is_fixed ? (
                                      <Lock className="w-3.5 h-3.5 text-blue-500" />
                                    ) : (
                                      <Unlock className="w-3.5 h-3.5 text-gray-400" />
                                    )}
                                  </button>
                                  <span className="text-sm flex-1 min-w-0 truncate">{sub.name}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${sub.is_fixed ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {sub.is_fixed ? 'fijo' : 'variable'}
                                  </span>
                                  <select
                                    className="text-xs border rounded px-1.5 py-1 bg-white text-gray-600 flex-shrink-0"
                                    value={sub.payment_method || 'efectivo'}
                                    onChange={(e) => updateSubPayment(sub.id, e.target.value as BudgetSubItem['payment_method'])}
                                  >
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="transferencia">Transferencia</option>
                                  </select>
                                  <select
                                    className="text-xs border rounded px-1.5 py-1 bg-white text-gray-600 flex-shrink-0"
                                    value={sub.frequency || 'mensual'}
                                    onChange={(e) => updateSubFrequency(sub.id, e.target.value as BudgetSubItem['frequency'])}
                                  >
                                    <option value="mensual">Mensual</option>
                                    <option value="trimestral">Trimestral</option>
                                    <option value="anual">Anual</option>
                                  </select>
                                  <div className="relative w-24 flex-shrink-0">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Q</span>
                                    <Input
                                      type="number"
                                      className="pl-6 h-7 text-xs text-right"
                                      value={sub.amount || ''}
                                      onChange={(e) => updateSubAmount(sub.id, parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  {(sub.frequency || 'mensual') !== 'mensual' && sub.amount > 0 && (
                                    <span className="text-[10px] text-ink-400 flex-shrink-0 whitespace-nowrap">
                                      {fmt(Math.round(monthlyAmount(sub.amount, sub.frequency || 'mensual')))}/mes
                                    </span>
                                  )}
                                  <button
                                    onClick={() => deleteSubItem(sub.id)}
                                    className="text-gray-300 hover:text-red-500 flex-shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Add sub-item form */}
                            {addingSubItem === cat.id ? (
                              <div className="mt-2 bg-white rounded-lg p-3 space-y-2 border border-electric-soft">
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Nombre del sub-item"
                                    className="flex-1 h-8 text-sm"
                                    value={newSubName}
                                    onChange={(e) => setNewSubName(e.target.value)}
                                    autoFocus
                                  />
                                  <div className="relative w-24">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Q</span>
                                    <Input
                                      type="number"
                                      className="pl-6 h-8 text-sm text-right"
                                      placeholder="0"
                                      value={newSubAmount || ''}
                                      onChange={(e) => setNewSubAmount(parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <Label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={newSubFixed}
                                      onChange={(e) => setNewSubFixed(e.target.checked)}
                                      className="rounded border-gray-300"
                                    />
                                    Gasto fijo
                                  </Label>
                                  <select
                                    className="text-xs border rounded px-2 py-1 bg-white text-gray-600"
                                    value={newSubPayment}
                                    onChange={(e) => setNewSubPayment(e.target.value as BudgetSubItem['payment_method'])}
                                  >
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="transferencia">Transferencia</option>
                                  </select>
                                  <select
                                    className="text-xs border rounded px-2 py-1 bg-white text-gray-600"
                                    value={newSubFrequency}
                                    onChange={(e) => setNewSubFrequency(e.target.value as BudgetSubItem['frequency'])}
                                  >
                                    <option value="mensual">Mensual</option>
                                    <option value="trimestral">Trimestral</option>
                                    <option value="anual">Anual</option>
                                  </select>
                                  <div className="flex gap-2 ml-auto">
                                    <Button size="sm" className="h-7 text-xs" onClick={() => addSubItem(cat.id)} disabled={!newSubName.trim()}>
                                      <Plus className="w-3 h-3 mr-1" />
                                      Agregar
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingSubItem(null); setNewSubName(''); setNewSubAmount(0); setNewSubFixed(false); setNewSubPayment('efectivo'); setNewSubFrequency('mensual'); }}>
                                      <X className="w-3 h-3 mr-1" />
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddingSubItem(cat.id); setNewSubName(''); setNewSubAmount(0); setNewSubFixed(false); }}
                                className="mt-2 flex items-center gap-1 text-xs text-electric hover:text-electric-dark font-medium"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Agregar detalle
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add category to this bucket */}
                {addingCatBucket === bucket ? (
                  <div className="mt-3 flex gap-2 items-center">
                    <Input
                      placeholder="Nombre de la categoría"
                      className="flex-1 h-8 text-sm"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') addCategoryToBucket(bucket); }}
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={() => addCategoryToBucket(bucket)} disabled={!newCatName.trim()}>
                      <Plus className="w-3 h-3 mr-1" />
                      Agregar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingCatBucket(null); setNewCatName(''); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingCatBucket(bucket); setNewCatName(''); }}
                    className="mt-3 flex items-center gap-1 text-xs text-electric hover:text-electric-dark font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar categoría
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
            </CardContent>
          )}
        </Card>

        {/* ─── SECCIÓN 3: Comparativo del mes (colapsable) ─── */}
        {categories.length > 0 && (() => {
          const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0);
          const totalDiff = totalSpent - totalBudgeted;
          const fmtNum = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
          return (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-navy">Comparativo del mes</CardTitle>
                <button onClick={() => setComparativoCollapsed(!comparativoCollapsed)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
                  <span>{comparativoCollapsed ? 'Ver detalle' : 'Cerrar'}</span>
                  {comparativoCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
              {comparativoCollapsed && (
                <p className="text-xs text-gray-400 mt-1">
                  Presupuesto: {fmtNum(totalBudgeted)} &middot; Real: {fmtNum(totalSpent)} &middot;{' '}
                  <span className={totalDiff > 0 ? 'text-red-500' : totalDiff < 0 ? 'text-green-600' : ''}>
                    Variación: {totalDiff > 0 ? '+' : totalDiff < 0 ? '-' : ''}{fmtNum(Math.abs(totalDiff))}
                  </span>
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">Todas las cifras están en Quetzales (GTQ)</p>
            </CardHeader>
            {!comparativoCollapsed && (
            <CardContent className="pt-0 overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 py-2 px-1">Categoría</th>
                    <th className="text-right text-xs font-semibold text-gray-500 py-2 px-1">Presupuesto</th>
                    <th className="text-right text-xs font-semibold text-gray-500 py-2 px-1">Real</th>
                    <th className="text-right text-xs font-semibold text-gray-500 py-2 px-1">Variación</th>
                    <th className="text-right text-xs font-semibold text-gray-500 py-2 px-1">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(['needs', 'wants', 'savings'] as const).map((bucket) => {
                    const info = BUCKET_LABELS[bucket];
                    const bucketCats = categories.filter(c => c.bucket === bucket);
                    if (bucketCats.length === 0) return null;
                    const bucketBudgeted = bucketCats.reduce((s, c) => s + getCategoryTotal(c.id), 0);
                    const bucketActual = bucketCats.reduce((s, c) => s + (spentByCategory[c.id] || 0), 0);
                    const bucketDiff = bucketActual - bucketBudgeted;
                    const bucketPct = bucketBudgeted > 0 ? Math.round((bucketDiff / bucketBudgeted) * 100) : 0;
                    const bucketVarClass = bucketDiff > 0 ? 'text-red-500' : bucketDiff < 0 ? 'text-green-600' : 'text-gray-400';
                    return (
                      <React.Fragment key={bucket}>
                        <tr className="bg-gray-50">
                          <td colSpan={5} className={`text-xs font-semibold py-1.5 px-1 ${info.textColor}`}>
                            {info.label}
                          </td>
                        </tr>
                        {bucketCats.map((cat) => {
                          const budgeted = getCategoryTotal(cat.id);
                          const actual = spentByCategory[cat.id] || 0;
                          const diff = actual - budgeted;
                          const pct = budgeted > 0 ? Math.round((diff / budgeted) * 100) : 0;
                          const varClass = diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-600' : 'text-gray-400';
                          return (
                            <tr key={cat.id} className="border-b border-gray-100">
                              <td className="py-2 px-1 font-medium text-navy">{cat.name}</td>
                              <td className="py-2 px-1 text-right tabular-nums">{fmtNum(budgeted)}</td>
                              <td className="py-2 px-1 text-right tabular-nums">{fmtNum(actual)}</td>
                              <td className={`py-2 px-1 text-right font-medium tabular-nums ${varClass}`}>
                                {diff > 0 ? '+' : diff < 0 ? '-' : ''}{fmtNum(Math.abs(diff))}
                              </td>
                              <td className={`py-2 px-1 text-right font-medium ${varClass}`}>
                                {diff === 0 ? '0%' : `${diff > 0 ? '+' : '-'}${Math.abs(pct)}%`}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Subtotal row per bucket */}
                        <tr className="border-b border-gray-200 bg-gray-50/50">
                          <td className="py-1.5 px-1 text-xs font-semibold text-gray-600">Subtotal</td>
                          <td className="py-1.5 px-1 text-right text-xs font-semibold text-gray-600 tabular-nums">{fmtNum(bucketBudgeted)}</td>
                          <td className="py-1.5 px-1 text-right text-xs font-semibold text-gray-600 tabular-nums">{fmtNum(bucketActual)}</td>
                          <td className={`py-1.5 px-1 text-right text-xs font-semibold tabular-nums ${bucketVarClass}`}>
                            {bucketDiff > 0 ? '+' : bucketDiff < 0 ? '-' : ''}{fmtNum(Math.abs(bucketDiff))}
                          </td>
                          <td className={`py-1.5 px-1 text-right text-xs font-semibold ${bucketVarClass}`}>
                            {bucketDiff === 0 ? '0%' : `${bucketDiff > 0 ? '+' : '-'}${Math.abs(bucketPct)}%`}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {/* Total row */}
                  {(() => {
                    const totalPct = totalBudgeted > 0 ? Math.round((totalDiff / totalBudgeted) * 100) : 0;
                    const cls = totalDiff > 0 ? 'text-red-500' : totalDiff < 0 ? 'text-green-600' : 'text-gray-400';
                    return (
                      <tr className="border-t-2 border-[#1E3A5F]">
                        <td className="py-2 px-1 font-bold text-navy">TOTAL</td>
                        <td className="py-2 px-1 text-right font-bold text-navy tabular-nums">{fmtNum(totalBudgeted)}</td>
                        <td className="py-2 px-1 text-right font-bold text-navy tabular-nums">{fmtNum(totalSpent)}</td>
                        <td className={`py-2 px-1 text-right font-bold tabular-nums ${cls}`}>
                          {totalDiff > 0 ? '+' : totalDiff < 0 ? '-' : ''}{fmtNum(Math.abs(totalDiff))}
                        </td>
                        <td className={`py-2 px-1 text-right font-bold ${cls}`}>
                          {totalDiff === 0 ? '0%' : `${totalDiff > 0 ? '+' : '-'}${Math.abs(totalPct)}%`}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </CardContent>
            )}
          </Card>
          );
        })()}
    </AppShell>
  );
}
