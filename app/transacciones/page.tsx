'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { localToday } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BudgetCategory, Transaction } from '@/types';
import type { VoiceExtractionResult, SearchTransaction, SearchMonthTotal } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { TransactionPreview } from '@/components/voice/TransactionPreview';
import { SearchBar } from '@/components/transactions/SearchBar';
import { SearchFilters } from '@/components/transactions/SearchFilters';
import { SearchResults } from '@/components/transactions/SearchResults';
import { EditSheet } from '@/components/transactions/EditSheet';
import { ReclassifySheet } from '@/components/transactions/ReclassifySheet';
import { UndoToast } from '@/components/transactions/UndoToast';
import { useReclassifyFlow } from '@/lib/transactions/useReclassifyFlow';
import { AppShell } from '@/components/layout/AppShell';
import { getUserHousehold } from '@/lib/household';
import {
  Plus,
  Loader2,
  Trash2,
  Receipt,
  ArrowUpCircle,
  Pencil,
  Check,
  X,
  MessageSquare,
  Camera,
  Upload,
} from 'lucide-react';

function periodToDateRange(period: string): { from: string | null; to: string | null } {
  const today = new Date();
  switch (period) {
    case 'month': {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      return { from: `${y}-${m}-01`, to: null };
    }
    case '3m': {
      const d = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      return {
        from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        to: null,
      };
    }
    case '6m': {
      const d = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return {
        from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        to: null,
      };
    }
    default:
      return { from: null, to: null };
  }
}

function amountToRange(amt: string): { min: number | null; max: number | null } {
  switch (amt) {
    case 'lt100':
      return { min: null, max: 99.99 };
    case 'mid':
      return { min: 100, max: 500 };
    case 'gt500':
      return { min: 500.01, max: null };
    default:
      return { min: null, max: null };
  }
}

function TransaccionesPageInner() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<(Transaction & { category_name?: string; bucket?: string })[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [newTx, setNewTx] = useState({
    category_id: '',
    amount: 0,
    description: '',
    date: localToday(),
    payment_method: 'efectivo' as 'efectivo' | 'tarjeta' | 'cheque' | 'transferencia',
    type: 'expense' as 'expense' | 'income',
  });
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ category_id: '', amount: 0, description: '', date: '', payment_method: 'efectivo' as string });
  const [editSaving, setEditSaving] = useState(false);
  const [showSmsForm, setShowSmsForm] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [smsParsing, setSmsParsing] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [explicitPeriod, setExplicitPeriod] = useState<string | null>(null);
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchAmount, setSearchAmount] = useState('any');
  const [searchResults, setSearchResults] = useState<SearchTransaction[]>([]);
  const [searchTotals, setSearchTotals] = useState<SearchMonthTotal[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchGen, setSearchGen] = useState(0);
  const searchCursor = useRef<{ date: string | null; id: string | null }>({ date: null, id: null });

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fmt = useFormatMoney();

  const flow = useReclassifyFlow(categories, () => setSearchGen((g) => g + 1));

  const trimmedQuery = searchQuery.trim();
  const effectivePeriod = explicitPeriod ?? (trimmedQuery.length >= 2 ? 'all' : 'month');
  const isSearchMode = trimmedQuery.length >= 2 || explicitPeriod !== null || searchCategory !== 'all' || searchAmount !== 'any';
  const hasActiveFilters = explicitPeriod !== null || searchCategory !== 'all' || searchAmount !== 'any';

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const hh = await getUserHousehold(supabase, user.id);
      if (!hh) { router.push('/onboarding'); return; }
      setHouseholdId(hh.id);

      const [{ data: txs }, { data: cats }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, budget_categories(name, bucket)')
          .eq('household_id', hh.id)
          .order('date', { ascending: false })
          .limit(50),
        supabase
          .from('budget_categories')
          .select('*')
          .eq('household_id', hh.id)
          .order('bucket'),
      ]);

      const mapped = (txs || []).map((tx: Record<string, unknown>) => ({
        ...tx,
        category_name: (tx.budget_categories as { name: string } | null)?.name || 'Sin categoria',
        bucket: (tx.budget_categories as { bucket: string } | null)?.bucket || '',
      })) as (Transaction & { category_name?: string; bucket?: string })[];

      setTransactions(mapped);
      setCategories((cats || []) as BudgetCategory[]);
      if (cats && cats.length > 0) setNewTx(prev => ({ ...prev, category_id: cats[0].id }));
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch normal list after reclassify mutations
  useEffect(() => {
    if (searchGen === 0 || !householdId) return;
    supabase
      .from('transactions')
      .select('*, budget_categories(name, bucket)')
      .eq('household_id', householdId)
      .order('date', { ascending: false })
      .limit(50)
      .then(({ data: txs }) => {
        const mapped = (txs || []).map((tx: Record<string, unknown>) => ({
          ...tx,
          category_name: (tx.budget_categories as { name: string } | null)?.name || 'Sin categoria',
          bucket: (tx.budget_categories as { bucket: string } | null)?.bucket || '',
        })) as (Transaction & { category_name?: string; bucket?: string })[];
        setTransactions(mapped);
      });
  }, [searchGen, householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate SMS form from PWA Web Share Target (?shared_text=...)
  useEffect(() => {
    const shared = searchParams.get('shared_text');
    if (shared) {
      setSmsText(shared);
      setShowSmsForm(true);
    }
  }, [searchParams]);

  // Search effect
  useEffect(() => {
    const q = searchQuery.trim();
    const active = q.length >= 2 || explicitPeriod !== null || searchCategory !== 'all' || searchAmount !== 'any';

    if (!active) {
      setSearchResults([]);
      setSearchTotals([]);
      setSearchHasMore(false);
      return;
    }

    const controller = new AbortController();
    const period = explicitPeriod ?? (q.length >= 2 ? 'all' : 'month');
    const { from, to } = periodToDateRange(period);
    const { min, max } = amountToRange(searchAmount);

    searchCursor.current = { date: null, id: null };
    setSearchLoading(true);

    fetch('/api/transactions/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: q.length >= 2 ? q : undefined,
        from,
        to,
        categoryId: searchCategory !== 'all' ? searchCategory : undefined,
        minAmount: min,
        maxAmount: max,
        limit: 30,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        const rows: SearchTransaction[] = data.rows ?? [];
        setSearchResults(rows);
        setSearchTotals(data.totals ?? []);
        setSearchHasMore(rows.length === 30);
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          searchCursor.current = { date: last.date, id: last.id };
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      })
      .finally(() => setSearchLoading(false));

    return () => controller.abort();
  }, [searchQuery, explicitPeriod, searchCategory, searchAmount, searchGen]);

  function loadMoreResults() {
    if (!searchHasMore || searchLoading) return;

    const q = searchQuery.trim();
    const period = explicitPeriod ?? (q.length >= 2 ? 'all' : 'month');
    const { from, to } = periodToDateRange(period);
    const { min, max } = amountToRange(searchAmount);

    setSearchLoading(true);

    fetch('/api/transactions/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: q.length >= 2 ? q : undefined,
        from,
        to,
        categoryId: searchCategory !== 'all' ? searchCategory : undefined,
        minAmount: min,
        maxAmount: max,
        limit: 30,
        cursorDate: searchCursor.current.date,
        cursorId: searchCursor.current.id,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const rows: SearchTransaction[] = data.rows ?? [];
        setSearchResults((prev) => [...prev, ...rows]);
        setSearchHasMore(rows.length === 30);
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          searchCursor.current = { date: last.date, id: last.id };
        }
      })
      .catch(console.error)
      .finally(() => setSearchLoading(false));
  }

  function handleSearchChange(v: string) {
    setSearchQuery(v);
    if (!v.trim()) {
      setExplicitPeriod(null);
    }
    setEditingId(null);
  }

  function handlePeriodChange(v: string) {
    setExplicitPeriod(v);
  }

  function clearSearchFilters() {
    setExplicitPeriod(null);
    setSearchCategory('all');
    setSearchAmount('any');
  }

  function handleSearchSelect(tx: SearchTransaction) {
    flow.openEdit(tx);
  }

  async function parseSms() {
    if (!smsText.trim()) return;
    setSmsParsing(true);
    setSmsError(null);
    try {
      const res = await fetch('/api/parse-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: smsText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSmsError(data.error || 'Error al interpretar el mensaje.');
      } else {
        setVoiceResult(data);
        setShowSmsForm(false);
        setSmsText('');
        setShowForm(false);
      }
    } catch {
      setSmsError('Error de conexion. Intenta de nuevo.');
    }
    setSmsParsing(false);
  }

  async function addTransaction() {
    setSaving(true);
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        household_id: householdId,
        category_id: newTx.category_id,
        amount: newTx.amount,
        description: newTx.description,
        date: newTx.date,
        source: 'manual',
        type: newTx.type,
        payment_method: newTx.payment_method,
        created_by: userId || null,
      })
      .select('*, budget_categories(name, bucket)')
      .single();

    if (error) {
      alert(`Error al guardar: ${error.message}`);
      setSaving(false);
      return;
    }

    if (data) {
      const mapped = {
        ...data,
        category_name: (data.budget_categories as { name: string } | null)?.name || 'Sin categoria',
        bucket: (data.budget_categories as { bucket: string } | null)?.bucket || '',
      } as Transaction & { category_name?: string; bucket?: string };
      setTransactions([mapped, ...transactions]);
      setNewTx({ ...newTx, amount: 0, description: '', payment_method: 'efectivo', type: 'expense' });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function saveVoiceTransactions(txs: VoiceExtractionResult['transactions']) {
    if (!householdId) return;
    const { data, error } = await supabase
      .from('transactions')
      .insert(
        txs.map(tx => ({
          household_id: householdId,
          category_id: tx.category_id ?? null,
          amount: tx.amount,
          description: tx.description,
          date: tx.date,
          source: 'voice',
          type: 'expense' as const,
          payment_method: 'efectivo' as const,
          voice_raw_text: voiceResult?.raw_text ?? null,
          created_by: userId || null,
          original_amount: tx.original_amount ?? null,
          original_currency: tx.original_currency ?? null,
        }))
      )
      .select('*, budget_categories(name, bucket)');

    if (error) {
      alert(`Error al guardar: ${error.message}`);
      return;
    }

    if (data) {
      const mapped = data.map((d: Record<string, unknown>) => ({
        ...d,
        category_name: (d.budget_categories as { name: string } | null)?.name || 'Sin categoria',
        bucket: (d.budget_categories as { bucket: string } | null)?.bucket || '',
      })) as (Transaction & { category_name?: string; bucket?: string })[];
      setTransactions([...mapped, ...transactions]);
    }
    setVoiceResult(null);
    setVoiceError(null);
  }

  async function deleteTransaction(id: string) {
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions(transactions.filter(t => t.id !== id));
  }

  function startEdit(tx: Transaction & { category_name?: string; bucket?: string }) {
    const cat = categories.find((c) => c.id === tx.category_id);
    const asST: SearchTransaction = {
      ...tx,
      category_name: cat?.name ?? tx.category_name ?? 'Sin categoría',
      category_bucket: (cat?.bucket ?? tx.bucket ?? 'wants') as 'needs' | 'wants' | 'savings',
      category_icon: cat?.icon ?? null,
    };
    flow.openEdit(asST);
  }

  async function saveEdit() {
    if (!editingId || editData.amount <= 0) return;
    setEditSaving(true);

    const { data } = await supabase
      .from('transactions')
      .update({
        category_id: editData.category_id,
        amount: editData.amount,
        description: editData.description,
        date: editData.date,
        payment_method: editData.payment_method,
      })
      .eq('id', editingId)
      .select('*, budget_categories(name, bucket)')
      .single();

    if (data) {
      const mapped = {
        ...data,
        category_name: (data.budget_categories as { name: string } | null)?.name || 'Sin categoria',
        bucket: (data.budget_categories as { bucket: string } | null)?.bucket || '',
      } as Transaction & { category_name?: string; bucket?: string };

      setTransactions(transactions.map(t => t.id === editingId ? mapped : t));
    }

    setEditingId(null);
    setEditSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric-light animate-spin" />
      </div>
    );
  }

  // Group by date (normal mode)
  const grouped: Record<string, typeof transactions> = {};
  for (const tx of transactions) {
    const key = tx.date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }

  const totalThisMonth = transactions
    .filter(t => {
      const d = new Date(t.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type !== 'income';
    })
    .reduce((s, t) => s + Number(t.amount), 0);

  const bucketColors: Record<string, string> = {
    needs: 'bg-blue-100 text-electric-dark',
    wants: 'bg-blue-100 text-electric-dark',
    savings: 'bg-blue-100 text-blue-700',
  };

  return (
    <AppShell title="Transacciones" currentPath="/transacciones">
      <div className="max-w-3xl mx-auto">
        {/* Search bar */}
        <SearchBar value={searchQuery} onChange={handleSearchChange} />

        {/* Filters */}
        <SearchFilters
          period={effectivePeriod}
          onPeriodChange={handlePeriodChange}
          category={searchCategory}
          onCategoryChange={setSearchCategory}
          amount={searchAmount}
          onAmountChange={setSearchAmount}
          categories={categories}
          periodHighlighted={explicitPeriod !== null}
        />

        {isSearchMode ? (
          <SearchResults
            results={searchResults}
            totals={searchTotals}
            query={searchQuery}
            loading={searchLoading}
            hasMore={searchHasMore}
            onLoadMore={loadMoreResults}
            onSelect={handleSearchSelect}
            onClearFilters={clearSearchFilters}
            hasActiveFilters={hasActiveFilters}
            fmt={fmt}
          />
        ) : (
          <>
            {/* Action bar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-ink-500">Este mes: {fmt(totalThisMonth)}</p>
              <div className="flex gap-2 flex-wrap justify-end">
                <VoiceButton
                  mode="expense"
                  onExtraction={(result) => { setVoiceResult(result); setVoiceError(null); setShowForm(false); setShowSmsForm(false); }}
                  onError={(err) => setVoiceError(err)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowSmsForm(v => !v); setShowForm(false); setVoiceResult(null); }}
                  title="Pegar SMS o notificacion de banco"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push('/capture')}>
                  <Camera className="w-4 h-4 mr-1" />
                  Foto
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push('/importar')}>
                  <Upload className="w-4 h-4 mr-1" />
                  CSV
                </Button>
                <Button onClick={() => { setShowForm(true); setVoiceResult(null); setShowSmsForm(false); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Gasto
                </Button>
              </div>
            </div>

            {/* SMS paste form */}
            {showSmsForm && (
              <Card className="mb-4 border-blue-200 bg-blue-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-electric" />
                    Pegar notificacion de banco / Apple Pay / Google Pay
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-electric/30"
                    rows={4}
                    placeholder={'Ej: "Compra aprobada por Q250.00 en WALMART"\n"Apple Pay: Q89.50 at Starbucks"\n"VISA: Compra por Q125.00 en AMAZON"'}
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                  />
                  {smsError && (
                    <p className="text-xs text-red-600">{smsError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={parseSms}
                      disabled={smsParsing || !smsText.trim()}
                    >
                      {smsParsing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-1" />}
                      Identificar gasto
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowSmsForm(false); setSmsText(''); setSmsError(null); }}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Voice/SMS transaction preview */}
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

            {/* New transaction form */}
            {showForm && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">Registrar movimiento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex rounded-lg overflow-hidden border" style={{ height: 40 }}>
                    <button
                      type="button"
                      onClick={() => setNewTx({ ...newTx, type: 'expense' })}
                      className="flex-1 text-sm font-semibold transition-colors"
                      style={{
                        background: newTx.type === 'expense' ? '#1E3A5F' : 'white',
                        color: newTx.type === 'expense' ? 'white' : '#64748B',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      Gasto
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTx({ ...newTx, type: 'income' })}
                      className="flex-1 text-sm font-semibold transition-colors"
                      style={{
                        background: newTx.type === 'income' ? '#16A34A' : 'white',
                        color: newTx.type === 'income' ? 'white' : '#64748B',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      Ingreso
                    </button>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <select
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                      value={newTx.category_id}
                      onChange={(e) => setNewTx({ ...newTx, category_id: e.target.value })}
                    >
                      <optgroup label="Necesidades">
                        {categories.filter(c => c.bucket === 'needs').map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Gustos">
                        {categories.filter(c => c.bucket === 'wants').map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Ahorro/Deudas">
                        {categories.filter(c => c.bucket === 'savings').map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Monto (Q)</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={newTx.amount || ''}
                        onChange={(e) => setNewTx({ ...newTx, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={newTx.date}
                        onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Descripcion (opcional)</Label>
                      <Input
                        className="mt-1"
                        placeholder="Ej: Supermercado, Gasolina"
                        value={newTx.description}
                        onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Forma de pago</Label>
                      <select
                        className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                        value={newTx.payment_method}
                        onChange={(e) => setNewTx({ ...newTx, payment_method: e.target.value as 'efectivo' | 'tarjeta' | 'cheque' | 'transferencia' })}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="cheque">Cheque</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={addTransaction} disabled={saving || newTx.amount <= 0}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUpCircle className="w-4 h-4 mr-2" />}
                      {newTx.type === 'income' ? 'Registrar ingreso' : 'Registrar gasto'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transaction list */}
            {Object.entries(grouped).map(([date, txs]) => {
              const d = new Date(date + 'T12:00:00');
              const label = d.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
              const dayTotal = txs.reduce((s, t) => s + Number(t.amount), 0);

              return (
                <div key={date} className="mb-4">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-sm font-medium text-ink-500 capitalize">{label}</p>
                    <p className="text-sm font-medium">{fmt(dayTotal)}</p>
                  </div>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {txs.map((tx) => (
                        editingId === tx.id ? (
                          <div key={tx.id} className="px-4 py-3 bg-blue-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-electric">Editando transaccion</span>
                              <div className="flex gap-1">
                                <button
                                  onClick={saveEdit}
                                  disabled={editSaving || editData.amount <= 0}
                                  className="p-1.5 rounded-md bg-electric text-white hover:bg-electric-dark disabled:opacity-50"
                                >
                                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 rounded-md text-ink-500 hover:text-ink-700 hover:bg-gray-100"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Categoria</Label>
                              <select
                                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                                value={editData.category_id}
                                onChange={(e) => setEditData({ ...editData, category_id: e.target.value })}
                              >
                                <optgroup label="Necesidades">
                                  {categories.filter(c => c.bucket === 'needs').map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </optgroup>
                                <optgroup label="Gustos">
                                  {categories.filter(c => c.bucket === 'wants').map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </optgroup>
                                <optgroup label="Ahorro/Deudas">
                                  {categories.filter(c => c.bucket === 'savings').map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Monto (Q)</Label>
                                <Input
                                  type="number"
                                  className="mt-1"
                                  value={editData.amount || ''}
                                  onChange={(e) => setEditData({ ...editData, amount: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Fecha</Label>
                                <Input
                                  type="date"
                                  className="mt-1"
                                  value={editData.date}
                                  onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Descripcion</Label>
                                <Input
                                  className="mt-1"
                                  value={editData.description}
                                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                  placeholder="Descripcion del gasto"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Forma de pago</Label>
                                <select
                                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                                  value={editData.payment_method}
                                  onChange={(e) => setEditData({ ...editData, payment_method: e.target.value })}
                                >
                                  <option value="efectivo">Efectivo</option>
                                  <option value="tarjeta">Tarjeta</option>
                                  <option value="cheque">Cheque</option>
                                  <option value="transferencia">Transferencia</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Receipt className="w-5 h-5 text-ink-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {tx.description || tx.category_name}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${bucketColors[tx.bucket || ''] || 'bg-gray-100 text-ink-700'}`}>
                                  {tx.category_name}
                                </span>
                                {tx.payment_method && tx.payment_method !== 'efectivo' && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-ink-500">
                                    {tx.payment_method === 'tarjeta' ? 'Tarjeta' : tx.payment_method === 'cheque' ? 'Cheque' : 'Transferencia'}
                                  </span>
                                )}
                                {tx.source === 'csv' && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                    Importado
                                  </span>
                                )}
                                {tx.type === 'income' && (
                                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#DCFCE7', color: '#166534' }}>
                                    Ingreso
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                              <div>
                                <span className="font-medium text-sm" style={{ color: tx.type === 'income' ? '#16A34A' : undefined }}>
                                  {tx.type === 'income' ? '+' : ''}{fmt(Number(tx.amount))}
                                </span>
                                {tx.original_currency && (
                                  <div className="text-[11px] text-muted-foreground">
                                    {tx.original_currency === 'USD' ? '$' : tx.original_currency === 'EUR' ? '€' : tx.original_currency} {Number(tx.original_amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => startEdit(tx)}
                                className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-ink-400 hover:text-electric transition-all"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteTransaction(tx.id)}
                                className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-ink-400 hover:text-red-500 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      ))}
                    </CardContent>
                  </Card>
                </div>
              );
            })}

            {transactions.length === 0 && !showForm && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Receipt className="w-12 h-12 text-ink-400 mx-auto mb-3" />
                  <p className="font-medium text-ink-700">Sin transacciones</p>
                  <p className="text-sm text-ink-500 mt-1 mb-4">
                    Empieza a registrar tus gastos para llevar el control.
                  </p>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar primer gasto
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Edit & reclassify sheets (search mode) */}
      <EditSheet
        open={flow.step === 'editing'}
        transaction={flow.editingTx}
        categories={categories}
        onSave={flow.saveCategory}
        onClose={flow.closeEdit}
        saving={flow.saving}
        fmt={fmt}
      />

      <ReclassifySheet
        open={flow.step === 'reclassifying'}
        merchantName={flow.merchantName}
        newCategoryName={flow.newCategoryName}
        matches={flow.matches}
        defaultSelectedIds={flow.defaultSelectedIds}
        truncated={flow.truncated}
        saving={flow.saving}
        onConfirm={flow.confirmBulk}
        onSingleOnly={flow.singleOnly}
        onClose={flow.closeEdit}
        fmt={fmt}
      />

      <UndoToast
        visible={flow.undoVisible}
        title={flow.undoTitle}
        subtitle={flow.undoSubtitle}
        onUndo={flow.doUndo}
        onDismiss={flow.dismissUndo}
      />
    </AppShell>
  );
}

export default function TransaccionesPage() {
  return (
    <Suspense>
      <TransaccionesPageInner />
    </Suspense>
  );
}
