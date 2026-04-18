'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { localToday } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BudgetCategory, Transaction } from '@/types';
import type { VoiceExtractionResult } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { TransactionPreview } from '@/components/voice/TransactionPreview';
import { AppShell } from '@/components/layout/AppShell';
import {
  Plus,
  Loader2,
  Trash2,
  Receipt,
  ArrowUpCircle,
  Pencil,
  Check,
  X,
} from 'lucide-react';

export default function TransaccionesPage() {
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
  });
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ category_id: '', amount: 0, description: '', date: '', payment_method: 'efectivo' as string });
  const [editSaving, setEditSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data: hh } = await supabase
        .from('households').select('id').eq('owner_id', user.id).limit(1).single();
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
        category_name: (tx.budget_categories as { name: string } | null)?.name || 'Sin categoría',
        bucket: (tx.budget_categories as { bucket: string } | null)?.bucket || '',
      })) as (Transaction & { category_name?: string; bucket?: string })[];

      setTransactions(mapped);
      setCategories((cats || []) as BudgetCategory[]);
      if (cats && cats.length > 0) setNewTx(prev => ({ ...prev, category_id: cats[0].id }));
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addTransaction() {
    setSaving(true);
    const { data } = await supabase
      .from('transactions')
      .insert({
        household_id: householdId,
        category_id: newTx.category_id,
        amount: newTx.amount,
        description: newTx.description,
        date: newTx.date,
        source: 'manual',
        payment_method: newTx.payment_method,
        created_by: userId || null,
      })
      .select('*, budget_categories(name, bucket)')
      .single();

    if (data) {
      const mapped = {
        ...data,
        category_name: (data.budget_categories as { name: string } | null)?.name || 'Sin categoría',
        bucket: (data.budget_categories as { bucket: string } | null)?.bucket || '',
      } as Transaction & { category_name?: string; bucket?: string };
      setTransactions([mapped, ...transactions]);
      setNewTx({ ...newTx, amount: 0, description: '', payment_method: 'efectivo' });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function saveVoiceTransactions(txs: VoiceExtractionResult['transactions']) {
    if (!householdId) return;
    const { data } = await supabase
      .from('transactions')
      .insert(
        txs.map(tx => ({
          household_id: householdId,
          category_id: tx.category_id ?? null,
          amount: tx.amount,
          description: tx.description,
          date: tx.date,
          source: 'voice',
          voice_raw_text: voiceResult?.raw_text ?? null,
          created_by: userId || null,
        }))
      )
      .select('*, budget_categories(name, bucket)');

    if (data) {
      const mapped = data.map((d: Record<string, unknown>) => ({
        ...d,
        category_name: (d.budget_categories as { name: string } | null)?.name || 'Sin categoría',
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

  function startEdit(tx: Transaction & { category_name?: string }) {
    setEditingId(tx.id);
    setEditData({
      category_id: tx.category_id,
      amount: Number(tx.amount),
      description: tx.description || '',
      date: tx.date,
      payment_method: tx.payment_method || 'efectivo',
    });
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
        category_name: (data.budget_categories as { name: string } | null)?.name || 'Sin categoría',
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

  // Group by date
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
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, t) => s + Number(t.amount), 0);

  const bucketColors: Record<string, string> = {
    needs: 'bg-blue-100 text-electric-dark',
    wants: 'bg-blue-100 text-electric-dark',
    savings: 'bg-blue-100 text-blue-700',
  };

  return (
    <AppShell title="Transacciones" currentPath="/transacciones">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">Este mes: {fmt(totalThisMonth)}</p>
          <div className="flex gap-2">
            <VoiceButton
              mode="expense"
              onExtraction={(result) => { setVoiceResult(result); setVoiceError(null); setShowForm(false); }}
              onError={(err) => setVoiceError(err)}
            />
            <Button onClick={() => { setShowForm(true); setVoiceResult(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              Gasto
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

        {/* New transaction form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Registrar gasto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Categoría</Label>
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
                  <Label>Descripción (opcional)</Label>
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
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="cheque">📝 Cheque</option>
                    <option value="transferencia">🏦 Transferencia</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={addTransaction} disabled={saving || newTx.amount <= 0}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUpCircle className="w-4 h-4 mr-2" />}
                  Registrar gasto
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
                <p className="text-sm font-medium text-gray-500 capitalize">{label}</p>
                <p className="text-sm font-medium">{fmt(dayTotal)}</p>
              </div>
              <Card>
                <CardContent className="p-0 divide-y">
                  {txs.map((tx) => (
                    editingId === tx.id ? (
                      <div key={tx.id} className="px-4 py-3 bg-blue-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-electric">Editando transacción</span>
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
                              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Categoría</Label>
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
                            <Label className="text-xs">Descripción</Label>
                            <Input
                              className="mt-1"
                              value={editData.description}
                              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                              placeholder="Descripción del gasto"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Forma de pago</Label>
                            <select
                              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                              value={editData.payment_method}
                              onChange={(e) => setEditData({ ...editData, payment_method: e.target.value })}
                            >
                              <option value="efectivo">💵 Efectivo</option>
                              <option value="tarjeta">💳 Tarjeta</option>
                              <option value="cheque">📝 Cheque</option>
                              <option value="transferencia">🏦 Transferencia</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Receipt className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.description || tx.category_name}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${bucketColors[tx.bucket || ''] || 'bg-gray-100 text-gray-600'}`}>
                              {tx.category_name}
                            </span>
                            {tx.payment_method && tx.payment_method !== 'efectivo' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                {tx.payment_method === 'tarjeta' ? '💳' : tx.payment_method === 'cheque' ? '📝' : '🏦'}{' '}
                                {tx.payment_method.charAt(0).toUpperCase() + tx.payment_method.slice(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className="font-medium text-sm">{fmt(Number(tx.amount))}</span>
                          <button
                            onClick={() => startEdit(tx)}
                            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-gray-300 hover:text-electric transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTransaction(tx.id)}
                            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
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
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">Sin transacciones</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Empieza a registrar tus gastos para llevar el control.
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Registrar primer gasto
              </Button>
            </CardContent>
          </Card>
        )}
    </AppShell>
  );
}
