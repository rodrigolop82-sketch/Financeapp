'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BudgetCategory, Transaction } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Receipt,
  Gift,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function TransaccionesPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<(Transaction & { category_name?: string; bucket?: string })[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isExtraordinary, setIsExtraordinary] = useState(false);
  const [newTx, setNewTx] = useState({
    category_id: '',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  // Extraordinary income
  const [extraIncome, setExtraIncome] = useState({ amount: 0, description: 'Aguinaldo', date: new Date().toISOString().split('T')[0] });
  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

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
      setNewTx({ ...newTx, amount: 0, description: '' });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function addExtraordinaryIncome() {
    setSaving(true);
    // Find or use savings category for extraordinary income
    const savingsCat = categories.find(c => c.bucket === 'savings');
    if (!savingsCat) { setSaving(false); return; }

    const { data } = await supabase
      .from('transactions')
      .insert({
        household_id: householdId,
        category_id: savingsCat.id,
        amount: extraIncome.amount,
        description: extraIncome.description || 'Ingreso extraordinario',
        date: extraIncome.date,
        source: 'manual',
      })
      .select('*, budget_categories(name, bucket)')
      .single();

    if (data) {
      const mapped = {
        ...data,
        category_name: (data.budget_categories as { name: string } | null)?.name || 'Ingreso extraordinario',
        bucket: 'savings',
      } as Transaction & { category_name?: string; bucket?: string };
      setTransactions([mapped, ...transactions]);
      setExtraIncome({ amount: 0, description: 'Aguinaldo', date: new Date().toISOString().split('T')[0] });
      setIsExtraordinary(false);
    }
    setSaving(false);
  }

  async function deleteTransaction(id: string) {
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions(transactions.filter(t => t.id !== id));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
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
    needs: 'bg-purple-100 text-purple-700',
    wants: 'bg-purple-100 text-purple-700',
    savings: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Transacciones</h1>
              <p className="text-sm text-gray-500">Este mes: {fmt(totalThisMonth)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setIsExtraordinary(true); setShowForm(false); }}>
              <Gift className="w-4 h-4 mr-2" />
              Aguinaldo
            </Button>
            <Button onClick={() => { setShowForm(true); setIsExtraordinary(false); }}>
              <Plus className="w-4 h-4 mr-2" />
              Gasto
            </Button>
          </div>
        </div>

        {/* Extraordinary income form (aguinaldo) */}
        {isExtraordinary && (
          <Card className="mb-6 border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-base">Registrar ingreso extraordinario</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Registra tu aguinaldo, bono de fin de año, o cualquier ingreso extra.
              </p>
              <div>
                <Label>Descripción</Label>
                <Input
                  className="mt-1"
                  value={extraIncome.description}
                  onChange={(e) => setExtraIncome({ ...extraIncome, description: e.target.value })}
                  placeholder="Ej: Aguinaldo 2026, Bono, Comisión extra"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monto (Q)</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={extraIncome.amount || ''}
                    onChange={(e) => setExtraIncome({ ...extraIncome, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={extraIncome.date}
                    onChange={(e) => setExtraIncome({ ...extraIncome, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={addExtraordinaryIncome} disabled={saving || extraIncome.amount <= 0}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
                  Registrar ingreso
                </Button>
                <Button variant="outline" onClick={() => setIsExtraordinary(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
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
              <div>
                <Label>Descripción (opcional)</Label>
                <Input
                  className="mt-1"
                  placeholder="Ej: Supermercado, Gasolina, Netflix"
                  value={newTx.description}
                  onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
                />
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
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="font-medium text-sm">{fmt(Number(tx.amount))}</span>
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          );
        })}

        {transactions.length === 0 && !showForm && !isExtraordinary && (
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
      </div>
    </div>
  );
}
