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
    const monthlyRate = Number(d.interest_rate) / 100 / 12;
    const minPayment = Number(d.min_payment);
    const firstMonthInterest = balance * monthlyRate;

    if (minPayment > 0 && minPayment < firstMonthInterest) {
      warnings.push(`"${d.name}": el pago mínimo (${minPayment.toFixed(0)}) no cubre los intereses mensuales (${firstMonthInterest.toFixed(0)}). La deuda crecerá.`);
    }

    return {
      name: d.name,
      balance,
      rate: monthlyRate,
      minPayment,
      totalPaid: 0,
      interestPaid: 0,
      months: 0,
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
  let freedPayments = 0; // Tracks freed min payments from paid-off debts
  const maxIterations = 360; // 30 years max

  while (active.some(d => d.balance > 0) && totalMonths < maxIterations) {
    totalMonths++;
    const extra = extraPayment + freedPayments;

    for (const d of active) {
      if (d.balance <= 0) continue;

      const interest = d.balance * d.rate;
      totalInterest += interest;
      d.interestPaid += interest;
      d.balance += interest;

      const isTarget = active.indexOf(d) === active.findIndex(x => x.balance > 0);
      const payment = d.minPayment + (isTarget ? extra : 0);
      const actualPayment = Math.min(payment, d.balance);
      d.balance -= actualPayment;
      d.totalPaid += actualPayment;
      d.months = totalMonths;

      if (d.balance <= 0.01) {
        d.balance = 0;
        freedPayments += d.minPayment; // Persists across months
        order.push({ name: d.name, months: totalMonths, totalPaid: d.totalPaid, interestPaid: Math.round(d.interestPaid) });
      }
    }
  }

  // Add remaining unpaid debts to order (hit max iterations)
  for (const d of active) {
    if (d.balance > 0) {
      order.push({ name: d.name, months: totalMonths, totalPaid: d.totalPaid, interestPaid: Math.round(d.interestPaid) });
      warnings.push(`"${d.name}" no se paga en 30 años con los pagos actuales.`);
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
  const sim = simulatePayoff(activeDebts, extraPayment, strategy);
  const baseline = simulatePayoff(activeDebts, 0, strategy);
  const monthsSaved = baseline.totalMonths - sim.totalMonths;
  const interestSaved = baseline.totalInterest - sim.totalInterest;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
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
                {sim.totalMonths > 0 ? `${sim.totalMonths} meses` : 'N/A'}
              </p>
              {sim.totalInterest > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Intereses totales: {fmt(sim.totalInterest)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Simulator */}
        {activeDebts.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-lg">Simulador de pago</CardTitle>
              </div>
              <CardDescription>
                Elige una estrategia y define cuánto extra puedes pagar al mes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Strategy selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStrategy('snowball')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    strategy === 'snowball' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium text-sm">Bola de nieve</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Paga primero la deuda más pequeña. Ganas motivación rápido.
                  </p>
                </button>
                <button
                  onClick={() => setStrategy('avalanche')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    strategy === 'avalanche' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Mountain className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">Avalancha</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Paga primero la de mayor interés. Ahorras más a largo plazo.
                  </p>
                </button>
              </div>

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

              {/* Projection comparison */}
              {activeDebts.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Proyección con pago extra de {fmt(extraPayment)}/mes:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Tiempo para saldar</p>
                      <p className="text-lg font-bold text-purple-700">
                        {sim.totalMonths >= 360 ? '+30 años' : sim.totalMonths > 12
                          ? `${Math.floor(sim.totalMonths / 12)}a ${sim.totalMonths % 12}m`
                          : `${sim.totalMonths} meses`}
                      </p>
                      {monthsSaved > 0 && (
                        <p className="text-xs text-green-600 font-medium">
                          {monthsSaved} meses menos vs. solo mínimos
                        </p>
                      )}
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Intereses totales</p>
                      <p className="text-lg font-bold text-purple-700">{fmt(sim.totalInterest)}</p>
                      {interestSaved > 0 && (
                        <p className="text-xs text-green-600 font-medium">
                          Ahorrás {fmt(interestSaved)} en intereses
                        </p>
                      )}
                    </div>
                  </div>
                  {extraPayment > 0 && baseline.totalMonths > 0 && (
                    <div className="bg-white rounded-lg p-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Solo mínimos</span>
                        <span>Con extra</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (sim.totalMonths / Math.max(baseline.totalMonths, 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-gray-400">
                          {baseline.totalMonths >= 360 ? '+30 años' : `${baseline.totalMonths} meses`}
                        </span>
                        <span className="text-purple-600 font-medium">
                          {sim.totalMonths >= 360 ? '+30 años' : `${sim.totalMonths} meses`}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Costo total de la deuda: {fmt(sim.totalPaid)} (capital + intereses)
                  </p>
                </div>
              )}

              {/* Payoff timeline */}
              {sim.order.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Orden de pago:</p>
                  <div className="space-y-2">
                    {sim.order.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-xs text-gray-500">
                            {d.months >= 360 ? 'No se paga en 30 años' : `Se paga en ${d.months} meses`} - Total pagado: {fmt(d.totalPaid)}
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

        {/* Debt list */}
        <div className="space-y-3">
          {activeDebts.map((debt) => (
            <Card key={debt.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{debt.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        debt.type === 'credit' ? 'bg-purple-100 text-purple-700'
                        : debt.type === 'loan' ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>
                        {debt.type === 'credit' ? 'Tarjeta' : debt.type === 'loan' ? 'Préstamo' : 'Informal'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold">{fmt(Number(debt.balance))}</p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      <span>Pago mín: {fmt(Number(debt.min_payment))}/mes</span>
                      {Number(debt.interest_rate) > 0 && (
                        <span>Tasa: {debt.interest_rate}% anual</span>
                      )}
                      {debt.due_day && <span>Vence: día {debt.due_day}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => markPaid(debt.id)} title="Marcar como pagada">
                      <CheckCircle2 className="w-4 h-4 text-purple-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteDebt(debt.id)} title="Eliminar">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {activeDebts.length === 0 && !showForm && (
            <Card>
              <CardContent className="p-8 text-center">
                <TrendingDown className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                <p className="font-medium text-gray-700">No tienes deudas activas</p>
                <p className="text-sm text-gray-500 mt-1">Excelente. Sigue así.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Paid debts */}
        {debts.some(d => d.is_paid) && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Deudas pagadas</h3>
            {debts.filter(d => d.is_paid).map(debt => (
              <div key={debt.id} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg mb-2">
                <CheckCircle2 className="w-5 h-5 text-purple-500" />
                <span className="text-sm line-through text-purple-700">{debt.name}</span>
                <span className="text-sm text-purple-600 ml-auto">{fmt(Number(debt.balance))}</span>
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
                        newDebt.type === t.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
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
