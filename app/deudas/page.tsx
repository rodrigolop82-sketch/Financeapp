'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Debt } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  TrendingDown,
  Calculator,
  Zap,
  Mountain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import Link from 'next/link';

interface SimResult {
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  order: { name: string; months: number; totalPaid: number; interestPaid: number }[];
  warnings: string[];
}

function simulatePayoff(
  debts: Debt[],
  extraPayment: number,
  strategy: 'snowball' | 'avalanche'
): SimResult {
  if (debts.length === 0) return { totalMonths: 0, totalInterest: 0, totalPaid: 0, order: [], warnings: [] };

  const warnings: string[] = [];
  const active = debts.map(d => {
    const balance = Number(d.balance);
    const annualRate = Number(d.interest_rate);
    const monthlyRate = annualRate / 100 / 12;
    const minPayment = Number(d.min_payment);
    const monthlyInterest = balance * monthlyRate;

    if (minPayment > 0 && minPayment <= monthlyInterest && annualRate > 0) {
      warnings.push(`"${d.name}": el pago mínimo (Q ${minPayment.toLocaleString()}) no cubre los intereses mensuales (Q ${Math.round(monthlyInterest).toLocaleString()}). Necesitás pagar más para reducir esta deuda.`);
    }

    return {
      name: d.name,
      balance,
      rate: monthlyRate,
      minPayment,
      totalPaid: 0,
      interestPaid: 0,
      months: 0,
      paidOff: false,
    };
  });

  // Sort by strategy
  if (strategy === 'snowball') {
    active.sort((a, b) => a.balance - b.balance);
  } else {
    active.sort((a, b) => b.rate - a.rate);
  }

  const order: SimResult['order'] = [];
  let totalMonths = 0;
  let totalInterest = 0;
  let freedPayments = 0;
  const maxMonths = 360; // 30 years max

  while (active.some(d => d.balance > 0 && !d.paidOff) && totalMonths < maxMonths) {
    totalMonths++;
    const availableExtra = extraPayment + freedPayments;
    let extraRemaining = availableExtra;

    // First pass: apply interest and minimum payments
    for (const d of active) {
      if (d.balance <= 0 || d.paidOff) continue;

      // Apply monthly interest
      const interest = d.balance * d.rate;
      totalInterest += interest;
      d.interestPaid += interest;
      d.balance += interest;

      // Apply minimum payment
      const minPay = Math.min(d.minPayment, d.balance);
      d.balance -= minPay;
      d.totalPaid += minPay;
      d.months = totalMonths;

      if (d.balance <= 0.01) {
        d.balance = 0;
        d.paidOff = true;
        freedPayments += d.minPayment;
        order.push({ name: d.name, months: totalMonths, totalPaid: Math.round(d.totalPaid), interestPaid: Math.round(d.interestPaid) });
      }
    }

    // Second pass: apply extra payment to target debt (first unpaid in sorted order)
    for (const d of active) {
      if (d.balance <= 0 || d.paidOff || extraRemaining <= 0) continue;

      const extraPay = Math.min(extraRemaining, d.balance);
      d.balance -= extraPay;
      d.totalPaid += extraPay;
      extraRemaining -= extraPay;

      if (d.balance <= 0.01) {
        d.balance = 0;
        d.paidOff = true;
        freedPayments += d.minPayment;
        // Check if already added to order
        if (!order.some(o => o.name === d.name)) {
          order.push({ name: d.name, months: totalMonths, totalPaid: Math.round(d.totalPaid), interestPaid: Math.round(d.interestPaid) });
        }
      }

      break; // Extra payment goes to first target only
    }
  }

  // Add remaining unpaid debts
  for (const d of active) {
    if (d.balance > 0 && !d.paidOff) {
      order.push({ name: d.name, months: totalMonths, totalPaid: Math.round(d.totalPaid), interestPaid: Math.round(d.interestPaid) });
      warnings.push(`"${d.name}" no se paga en 30 años con los pagos actuales. Considerá aumentar el pago mensual.`);
    }
  }

  const totalPaid = active.reduce((s, d) => s + d.totalPaid, 0);
  return { totalMonths, totalInterest: Math.round(totalInterest), totalPaid: Math.round(totalPaid), order, warnings };
}

export default function DeudasPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche'>('snowball');
  const [extraPayment, setExtraPayment] = useState(500);
  const [showForm, setShowForm] = useState(false);
  const [expandedDebts, setExpandedDebts] = useState<Set<string>>(new Set());
  const [editingDebt, setEditingDebt] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; type: 'credit' | 'loan' | 'informal'; balance: number; interest_rate: number; min_payment: number; due_day: number }>({ name: '', type: 'credit', balance: 0, interest_rate: 0, min_payment: 0, due_day: 1 });
  const [newDebt, setNewDebt] = useState<{ name: string; type: 'credit' | 'loan' | 'informal'; balance: number; interest_rate: number; min_payment: number; due_day: number }>({ name: '', type: 'credit', balance: 0, interest_rate: 0, min_payment: 0, due_day: 1 });
  const [saving, setSaving] = useState(false);
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

      const { data } = await supabase
        .from('debts').select('*').eq('household_id', hh.id).order('balance', { ascending: true });
      setDebts((data || []) as Debt[]);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDebts = debts.filter(d => !d.is_paid);
  const totalBalance = activeDebts.reduce((s, d) => s + Number(d.balance), 0);
  const totalMinPayment = activeDebts.reduce((s, d) => s + Number(d.min_payment), 0);

  // Simulate both strategies for comparison
  const simSnowball = simulatePayoff(activeDebts, extraPayment, 'snowball');
  const simAvalanche = simulatePayoff(activeDebts, extraPayment, 'avalanche');
  const sim = strategy === 'snowball' ? simSnowball : simAvalanche;
  const baseline = simulatePayoff(activeDebts, 0, strategy);
  const monthsSaved = baseline.totalMonths - sim.totalMonths;
  const interestSaved = baseline.totalInterest - sim.totalInterest;

  // Determine which strategy is better
  const avalancheSavings = simSnowball.totalInterest - simAvalanche.totalInterest;
  const snowballFaster = simSnowball.order[0]?.months ?? 999;
  const avalancheFirstPaid = simAvalanche.order[0]?.months ?? 999;

  function toggleDebt(id: string) {
    setExpandedDebts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addDebt() {
    setSaving(true);
    const { data } = await supabase.from('debts').insert({
      household_id: householdId,
      ...newDebt,
    }).select().single();

    if (data) {
      setDebts([...debts, data as Debt]);
      setNewDebt({ name: '', type: 'credit', balance: 0, interest_rate: 0, min_payment: 0, due_day: 1 });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function markPaid(id: string) {
    await supabase.from('debts').update({ is_paid: true }).eq('id', id);
    setDebts(debts.map(d => d.id === id ? { ...d, is_paid: true } : d));
  }

  async function deleteDebt(id: string) {
    await supabase.from('debts').delete().eq('id', id);
    setDebts(debts.filter(d => d.id !== id));
  }

  function startEdit(debt: Debt) {
    setEditingDebt(debt.id);
    setEditForm({
      name: debt.name,
      type: debt.type as 'credit' | 'loan' | 'informal',
      balance: Number(debt.balance),
      interest_rate: Number(debt.interest_rate),
      min_payment: Number(debt.min_payment),
      due_day: debt.due_day,
    });
  }

  async function saveEdit() {
    if (!editingDebt) return;
    setSaving(true);
    const { error } = await supabase.from('debts').update({
      name: editForm.name,
      type: editForm.type,
      balance: editForm.balance,
      interest_rate: editForm.interest_rate,
      min_payment: editForm.min_payment,
      due_day: editForm.due_day,
    }).eq('id', editingDebt);

    if (!error) {
      setDebts(debts.map(d => d.id === editingDebt ? { ...d, ...editForm } : d));
      setEditingDebt(null);
    }
    setSaving(false);
  }

  function formatMonths(months: number): string {
    if (months >= 360) return '+30 años';
    if (months > 12) return `${Math.floor(months / 12)}a ${months % 12}m`;
    return `${months} meses`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
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
              <h1 className="text-2xl font-bold">Rastreador de deudas</h1>
              <p className="text-sm text-gray-500">
                {activeDebts.length} deuda{activeDebts.length !== 1 ? 's' : ''} activa{activeDebts.length !== 1 ? 's' : ''} - Total: {fmt(totalBalance)}
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar deuda
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Deuda total</p>
              <p className="text-2xl font-bold mt-1">{fmt(totalBalance)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Pago mínimo mensual</p>
              <p className="text-2xl font-bold mt-1">{fmt(totalMinPayment)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Libre de deuda en</p>
              <p className="text-2xl font-bold mt-1">
                {sim.totalMonths > 0 ? formatMonths(sim.totalMonths) : 'N/A'}
              </p>
              {sim.totalInterest > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Intereses totales: {fmt(sim.totalInterest)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Debt list — collapsible cards */}
        <div className="space-y-2 mb-6">
          {activeDebts.map((debt) => {
            const isExpanded = expandedDebts.has(debt.id);
            const monthlyInterest = Number(debt.balance) * (Number(debt.interest_rate) / 100 / 12);

            return (
              <Card key={debt.id} className="overflow-hidden">
                {/* Collapsed header — always visible */}
                <button
                  onClick={() => toggleDebt(debt.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      debt.type === 'credit' ? 'bg-blue-100 text-[#1D4ED8]'
                      : debt.type === 'loan' ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                      {debt.type === 'credit' ? 'Tarjeta' : debt.type === 'loan' ? 'Préstamo' : 'Informal'}
                    </span>
                    <span className="font-semibold text-sm">{debt.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{fmt(Number(debt.balance))}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && editingDebt === debt.id && (
                  <CardContent className="px-4 pb-4 pt-0 border-t">
                    <div className="space-y-3 mt-3">
                      <div>
                        <Label className="text-xs">Nombre</Label>
                        <Input
                          className="mt-1"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          {([
                            { value: 'credit', label: 'Tarjeta' },
                            { value: 'loan', label: 'Préstamo' },
                            { value: 'informal', label: 'Informal' },
                          ] as const).map((t) => (
                            <button
                              key={t.value}
                              onClick={() => setEditForm({ ...editForm, type: t.value })}
                              className={`py-1.5 px-2 rounded border text-xs transition-all ${
                                editForm.type === t.value ? 'border-[#3B82F6] bg-[#F8F9FF]' : 'border-gray-200'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Saldo actual (Q)</Label>
                          <Input type="number" className="mt-1" value={editForm.balance || ''} onChange={(e) => setEditForm({ ...editForm, balance: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <Label className="text-xs">Pago mínimo (Q)</Label>
                          <Input type="number" className="mt-1" value={editForm.min_payment || ''} onChange={(e) => setEditForm({ ...editForm, min_payment: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Tasa de interés anual (%)</Label>
                          <Input type="number" className="mt-1" value={editForm.interest_rate || ''} onChange={(e) => setEditForm({ ...editForm, interest_rate: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <Label className="text-xs">Día de vencimiento</Label>
                          <Input type="number" min={1} max={31} className="mt-1" value={editForm.due_day || ''} onChange={(e) => setEditForm({ ...editForm, due_day: parseInt(e.target.value) || 1 })} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} disabled={saving || !editForm.name.trim()}>
                          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                          Guardar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingDebt(null)}>
                          <X className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}

                {isExpanded && editingDebt !== debt.id && (
                  <CardContent className="px-4 pb-4 pt-0 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-gray-500">Pago mínimo</p>
                        <p className="text-sm font-medium">{fmt(Number(debt.min_payment))}/mes</p>
                      </div>
                      {Number(debt.interest_rate) > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Tasa anual</p>
                          <p className="text-sm font-medium">{debt.interest_rate}%</p>
                        </div>
                      )}
                      {Number(debt.interest_rate) > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Interés mensual</p>
                          <p className="text-sm font-medium text-amber-600">{fmt(Math.round(monthlyInterest))}</p>
                        </div>
                      )}
                      {debt.due_day > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Vence</p>
                          <p className="text-sm font-medium">Día {debt.due_day}</p>
                        </div>
                      )}
                    </div>

                    {/* Warning if min payment doesn't cover interest */}
                    {Number(debt.interest_rate) > 0 && Number(debt.min_payment) <= monthlyInterest && (
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-700">
                          El pago mínimo no cubre los intereses mensuales. Esta deuda va a crecer si no pagás más.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={() => startEdit(debt)}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => markPaid(debt.id)}>
                        <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
                        Pagada
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteDebt(debt.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {activeDebts.length === 0 && !showForm && (
            <Card>
              <CardContent className="p-8 text-center">
                <TrendingDown className="w-12 h-12 text-[#93C5FD] mx-auto mb-3" />
                <p className="font-medium text-gray-700">No tienes deudas activas</p>
                <p className="text-sm text-gray-500 mt-1">Excelente. Sigue así.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Simulator */}
        {activeDebts.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#2563EB]" />
                <CardTitle className="text-lg">Simulador de pago</CardTitle>
              </div>
              <CardDescription>
                Elige una estrategia y define cuánto extra puedes pagar al mes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Extra payment */}
              <div>
                <Label>Pago extra mensual (además de los mínimos)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Q</span>
                  <Input
                    type="number"
                    className="pl-8"
                    value={extraPayment || ''}
                    onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Warnings */}
              {sim.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800 mb-1">Atención:</p>
                  {sim.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w}</p>
                  ))}
                </div>
              )}

              {/* Strategy comparison — side by side */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Comparación de estrategias (con pago extra de {fmt(extraPayment)}/mes):
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Snowball */}
                  <button
                    onClick={() => setStrategy('snowball')}
                    className={`rounded-xl border-2 text-left transition-all overflow-hidden ${
                      strategy === 'snowball' ? 'border-yellow-400 ring-1 ring-yellow-200' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`p-3 ${strategy === 'snowball' ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="font-semibold text-sm">Bola de nieve</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Paga la deuda más pequeña primero
                      </p>
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Tiempo total</p>
                        <p className="text-lg font-bold text-gray-900">{formatMonths(simSnowball.totalMonths)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Intereses totales</p>
                        <p className="text-sm font-bold text-amber-600">{fmt(simSnowball.totalInterest)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Costo total</p>
                        <p className="text-sm font-medium">{fmt(simSnowball.totalPaid)}</p>
                      </div>
                      {simSnowball.order.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Primera deuda eliminada</p>
                          <p className="text-xs font-medium text-green-600">
                            {simSnowball.order[0].name} en {formatMonths(simSnowball.order[0].months)}
                          </p>
                        </div>
                      )}
                    </div>
                    {strategy === 'snowball' && (
                      <div className="bg-yellow-100 text-center py-1">
                        <p className="text-xs font-semibold text-yellow-800">Seleccionada</p>
                      </div>
                    )}
                  </button>

                  {/* Avalanche */}
                  <button
                    onClick={() => setStrategy('avalanche')}
                    className={`rounded-xl border-2 text-left transition-all overflow-hidden ${
                      strategy === 'avalanche' ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`p-3 ${strategy === 'avalanche' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Mountain className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-sm">Avalancha</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Paga la de mayor interés primero
                      </p>
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Tiempo total</p>
                        <p className="text-lg font-bold text-gray-900">{formatMonths(simAvalanche.totalMonths)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Intereses totales</p>
                        <p className="text-sm font-bold text-amber-600">{fmt(simAvalanche.totalInterest)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Costo total</p>
                        <p className="text-sm font-medium">{fmt(simAvalanche.totalPaid)}</p>
                      </div>
                      {simAvalanche.order.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Primera deuda eliminada</p>
                          <p className="text-xs font-medium text-green-600">
                            {simAvalanche.order[0].name} en {formatMonths(simAvalanche.order[0].months)}
                          </p>
                        </div>
                      )}
                    </div>
                    {strategy === 'avalanche' && (
                      <div className="bg-blue-100 text-center py-1">
                        <p className="text-xs font-semibold text-blue-800">Seleccionada</p>
                      </div>
                    )}
                  </button>
                </div>

                {/* Recommendation */}
                {activeDebts.length > 1 && (avalancheSavings > 0 || snowballFaster < avalancheFirstPaid) && (
                  <div className="mt-3 p-3 bg-[#F8F9FF] border border-[#BFDBFE] rounded-xl">
                    <p className="text-sm font-medium text-[#1E3A5F] mb-1">Recomendación de Zafi:</p>
                    {avalancheSavings > 500 ? (
                      <p className="text-xs text-[#1D4ED8]">
                        <strong>Avalancha</strong> te ahorra <strong>{fmt(avalancheSavings)}</strong> en intereses vs. Bola de nieve.
                        {snowballFaster < avalancheFirstPaid && (
                          <> Pero <strong>Bola de nieve</strong> elimina tu primera deuda más rápido ({formatMonths(snowballFaster)} vs {formatMonths(avalancheFirstPaid)}), lo cual ayuda con la motivación.</>
                        )}
                      </p>
                    ) : avalancheSavings > 0 ? (
                      <p className="text-xs text-[#1D4ED8]">
                        Ambas estrategias son muy similares en tu caso. La diferencia es solo {fmt(avalancheSavings)} en intereses. Elegí la que te motive más.
                      </p>
                    ) : (
                      <p className="text-xs text-[#1D4ED8]">
                        <strong>Bola de nieve</strong> te da victorias rápidas eliminando la deuda más pequeña primero en {formatMonths(snowballFaster)}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Projection vs baseline */}
              {extraPayment > 0 && baseline.totalMonths > 0 && (
                <div className="bg-gradient-to-r from-[#F8F9FF] to-blue-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Impacto del pago extra:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Solo pagos mínimos</p>
                      <p className="text-lg font-bold text-gray-400">{formatMonths(baseline.totalMonths)}</p>
                      <p className="text-xs text-gray-400">Intereses: {fmt(baseline.totalInterest)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border-2 border-green-200">
                      <p className="text-xs text-green-600 font-medium">Con +{fmt(extraPayment)}/mes</p>
                      <p className="text-lg font-bold text-green-700">{formatMonths(sim.totalMonths)}</p>
                      <p className="text-xs text-green-600">Intereses: {fmt(sim.totalInterest)}</p>
                    </div>
                  </div>
                  {monthsSaved > 0 && (
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-sm text-green-700 font-semibold">
                        Ahorrás {fmt(interestSaved)} en intereses y terminás {monthsSaved} meses antes
                      </p>
                    </div>
                  )}
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Solo mínimos</span>
                      <span>Con extra</span>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (sim.totalMonths / Math.max(baseline.totalMonths, 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-400">{formatMonths(baseline.totalMonths)}</span>
                      <span className="text-green-600 font-medium">{formatMonths(sim.totalMonths)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payoff timeline */}
              {sim.order.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Orden de pago:</p>
                  <div className="space-y-2">
                    {sim.order.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-[#1D4ED8]">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-xs text-gray-500">
                            {d.months >= 360 ? 'No se paga en 30 años' : `Se paga en ${formatMonths(d.months)}`} - Total pagado: {fmt(d.totalPaid)}
                            <span className="text-amber-600 ml-1">(intereses: {fmt(d.interestPaid)})</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Paid debts */}
        {debts.some(d => d.is_paid) && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Deudas pagadas</h3>
            {debts.filter(d => d.is_paid).map(debt => (
              <div key={debt.id} className="flex items-center gap-3 p-3 bg-[#F8F9FF] rounded-lg mb-2">
                <CheckCircle2 className="w-5 h-5 text-[#3B82F6]" />
                <span className="text-sm line-through text-[#1D4ED8]">{debt.name}</span>
                <span className="text-sm text-[#2563EB] ml-auto">{fmt(Number(debt.balance))}</span>
              </div>
            ))}
          </div>
        )}

        {/* Add debt form */}
        {showForm && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Nueva deuda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Tarjeta Visa, Préstamo del tío"
                  className="mt-1"
                  value={newDebt.name}
                  onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([
                    { value: 'credit', label: 'Tarjeta' },
                    { value: 'loan', label: 'Préstamo' },
                    { value: 'informal', label: 'Informal' },
                  ] as const).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setNewDebt({ ...newDebt, type: t.value })}
                      className={`py-2 px-3 rounded border text-sm transition-all ${
                        newDebt.type === t.value ? 'border-[#3B82F6] bg-[#F8F9FF]' : 'border-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Saldo actual (Q)</Label>
                  <Input type="number" className="mt-1" value={newDebt.balance || ''} onChange={(e) => setNewDebt({ ...newDebt, balance: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Pago mínimo (Q)</Label>
                  <Input type="number" className="mt-1" value={newDebt.min_payment || ''} onChange={(e) => setNewDebt({ ...newDebt, min_payment: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tasa de interés anual (%)</Label>
                  <Input type="number" className="mt-1" value={newDebt.interest_rate || ''} onChange={(e) => setNewDebt({ ...newDebt, interest_rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Día de vencimiento</Label>
                  <Input type="number" min={1} max={31} className="mt-1" value={newDebt.due_day || ''} onChange={(e) => setNewDebt({ ...newDebt, due_day: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={addDebt} disabled={saving || !newDebt.name.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Agregar
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
