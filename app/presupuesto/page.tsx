'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BudgetChart } from '@/components/charts/budget-chart';
import { formatCurrency, BudgetCategory } from '@/types';
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

const BUCKET_LABELS = {
  needs: { label: 'Necesidades (50%)', color: 'bg-emerald-700', textColor: 'text-emerald-700' },
  wants: { label: 'Gustos (30%)', color: 'bg-emerald-500', textColor: 'text-emerald-500' },
  savings: { label: 'Ahorro/Deudas (20%)', color: 'bg-emerald-300', textColor: 'text-emerald-700' },
};

export default function PresupuestoPage() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [income, setIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [householdId, setHouseholdId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatBucket, setNewCatBucket] = useState<'needs' | 'wants' | 'savings'>('needs');
  const router = useRouter();
  const supabase = createClient();

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

      const [{ data: cats }, { data: fp }] = await Promise.all([
        supabase.from('budget_categories').select('*').eq('household_id', hh.id),
        supabase.from('financial_profiles').select('total_income').eq('household_id', hh.id).limit(1).single(),
      ]);

      setCategories((cats || []) as BudgetCategory[]);
      setIncome(fp ? Number(fp.total_income) : 0);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bucketTotals = {
    needs: categories.filter(c => c.bucket === 'needs').reduce((s, c) => s + Number(c.budgeted_amount), 0),
    wants: categories.filter(c => c.bucket === 'wants').reduce((s, c) => s + Number(c.budgeted_amount), 0),
    savings: categories.filter(c => c.bucket === 'savings').reduce((s, c) => s + Number(c.budgeted_amount), 0),
  };
  const totalBudgeted = bucketTotals.needs + bucketTotals.wants + bucketTotals.savings;
  const remaining = income - totalBudgeted;

  function updateAmount(id: string, amount: number) {
    setCategories(cats => cats.map(c => c.id === id ? { ...c, budgeted_amount: amount } : c));
    setSaved(false);
  }

  async function saveAll() {
    setSaving(true);
    for (const cat of categories) {
      await supabase
        .from('budget_categories')
        .update({ budgeted_amount: cat.budgeted_amount })
        .eq('id', cat.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    const { data } = await supabase
      .from('budget_categories')
      .insert({
        household_id: householdId,
        name: newCatName.trim(),
        bucket: newCatBucket,
        budgeted_amount: 0,
        is_custom: true,
      })
      .select()
      .single();

    if (data) {
      setCategories([...categories, data as BudgetCategory]);
      setNewCatName('');
    }
  }

  async function deleteCategory(id: string) {
    await supabase.from('budget_categories').delete().eq('id', id);
    setCategories(cats => cats.filter(c => c.id !== id));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Presupuesto 50/30/20</h1>
              <p className="text-sm text-gray-500">Ingreso mensual: {formatCurrency(income)}</p>
            </div>
          </div>
          <Button onClick={saveAll} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saved ? 'Guardado' : 'Guardar'}
          </Button>
        </div>

        {/* Summary card */}
        <Card className="mb-6">
          <CardContent className="p-6">
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
                          {formatCurrency(actual)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${actual > target ? 'bg-red-400' : info.color}`}
                          style={{ width: `${income > 0 ? Math.min((actual / target) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Meta: {formatCurrency(target)}
                      </p>
                    </div>
                  );
                })}
                <div className="pt-2 border-t">
                  <div className="flex justify-between font-medium">
                    <span>Sin asignar</span>
                    <span className={remaining < 0 ? 'text-red-500' : 'text-emerald-600'}>
                      {formatCurrency(remaining)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories by bucket */}
        {(['needs', 'wants', 'savings'] as const).map((bucket) => {
          const info = BUCKET_LABELS[bucket];
          const bucketCats = categories.filter(c => c.bucket === bucket);
          return (
            <Card key={bucket} className="mb-4">
              <CardHeader>
                <CardTitle className={`text-base ${info.textColor}`}>{info.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bucketCats.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 rounded-full ${info.color}`} />
                      <span className="flex-1 text-sm font-medium min-w-0 truncate">{cat.name}</span>
                      <div className="relative w-32">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Q</span>
                        <Input
                          type="number"
                          className="pl-6 h-8 text-sm text-right"
                          value={cat.budgeted_amount || ''}
                          onChange={(e) => updateAmount(cat.id, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      {cat.is_custom && (
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          className="text-gray-300 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add custom category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agregar categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Nombre de la categoría"
                className="flex-1 min-w-[200px]"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <select
                className="border rounded-md px-3 py-2 text-sm bg-white"
                value={newCatBucket}
                onChange={(e) => setNewCatBucket(e.target.value as 'needs' | 'wants' | 'savings')}
              >
                <option value="needs">Necesidades</option>
                <option value="wants">Gustos</option>
                <option value="savings">Ahorro/Deudas</option>
              </select>
              <Button onClick={addCategory} disabled={!newCatName.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
