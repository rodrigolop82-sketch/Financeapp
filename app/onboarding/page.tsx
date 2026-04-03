'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  Users,
  User,
  Wallet,
  PiggyBank,
  AlertCircle,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Wordmark } from '@/components/brand/Wordmark';
import { AppIcon } from '@/components/brand/AppIcon';
import { OnboardingData } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { calculateHealthScore, ScoreBreakdown } from '@/lib/scoring';
import { generateInitialPlan } from '@/lib/action-plan';
import { ActionStep } from '@/types';

const TOTAL_STEPS = 8;

const defaultData: OnboardingData = {
  householdName: '',
  householdType: 'individual',
  totalIncome: 0,
  incomeType: 'fixed',
  fixedExpenses: {
    vivienda: 0,
    transporte: 0,
    servicios: 0,
    alimentacion: 0,
    salud: 0,
    educacion: 0,
  },
  hasDebts: false,
  debts: [],
  totalSavings: 0,
  savingsCash: 0,
  savingsInvestments: 0,
  hasEmergencyFund: false,
};

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [plan, setPlan] = useState<ActionStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const router = useRouter();
  const fmt = useFormatMoney();

  const progress = (step / TOTAL_STEPS) * 100;

  const totalFixedExpenses = Object.values(data.fixedExpenses).reduce((a, b) => a + b, 0);
  const totalDebt = data.debts.reduce((a, b) => a + b.balance, 0);

  function computeScore() {
    const profile = {
      total_income: data.totalIncome,
      total_fixed_expenses: totalFixedExpenses,
      total_debt: totalDebt,
      total_savings: data.totalSavings,
      has_emergency_fund: data.hasEmergencyFund,
      income_type: data.incomeType,
    };
    const result = calculateHealthScore(profile);
    setScore(result);
    setPlan(generateInitialPlan(profile, result));
  }

  // Animate score counter
  useEffect(() => {
    if (step === 7 && score) {
      setAnimatedScore(0);
      const target = score.total;
      const duration = 1500;
      const increment = target / (duration / 16);
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          setAnimatedScore(target);
          clearInterval(timer);
        } else {
          setAnimatedScore(Math.round(current));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [step, score]);

  async function saveOnboarding() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errorMsg = `Error del servidor (${res.status})`;
        try {
          const body = await res.json();
          const detail = body.details ? ` (${body.details})` : '';
          errorMsg = (body.error || 'Error al guardar') + detail;
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMsg);
      }
      router.refresh();
      router.push('/dashboard');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar datos');
      setSaving(false);
    }
  }

  function next() {
    if (step === 6) {
      computeScore();
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  function addDebt() {
    setData({
      ...data,
      debts: [
        ...data.debts,
        { name: '', type: 'credit', balance: 0, interestRate: 0, minPayment: 0 },
      ],
    });
  }

  function removeDebt(index: number) {
    setData({ ...data, debts: data.debts.filter((_, i) => i !== index) });
  }

  function updateDebt(index: number, field: string, value: string | number) {
    const updated = [...data.debts];
    updated[index] = { ...updated[index], [field]: value };
    setData({ ...data, debts: updated });
  }

  const scoreColorClass = score
    ? {
        red: 'text-red-500',
        orange: 'text-orange-500',
        yellow: 'text-yellow-500',
        green: 'text-green-500',
        emerald: 'text-electric-light',
      }[score.color]
    : '';

  const scoreBgClass = score
    ? {
        red: 'bg-red-100',
        orange: 'bg-orange-100',
        yellow: 'bg-yellow-100',
        green: 'bg-green-100',
        emerald: 'bg-blue-100',
      }[score.color]
    : '';

  return (
    <div className="min-h-screen bg-surface-bg">
      {/* Top bar */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AppIcon size="xs" variant="electric" />
              <Wordmark size="xs" />
            </div>
            <span className="text-sm text-gray-500">
              Paso {step} de {TOTAL_STEPS}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="animate-fade-in">
            <Card>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-electric" />
                </div>
                <CardTitle className="text-2xl">Hola, soy Zafi</CardTitle>
                <CardDescription className="text-base">
                  En 5 minutos voy a conocer tus finanzas y darte un plan.
                  Empecemos con lo básico.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="householdName">Nombre de tu hogar</Label>
                  <Input
                    id="householdName"
                    placeholder="Ej: Casa García, Mi presupuesto"
                    value={data.householdName}
                    onChange={(e) => setData({ ...data, householdName: e.target.value })}
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Ponle un nombre para identificar este presupuesto.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Household type */}
        {step === 2 && (
          <div className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>¿Cómo administras tus finanzas?</CardTitle>
                <CardDescription>
                  Esto nos ayuda a personalizar tu experiencia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { value: 'individual' as const, icon: User, label: 'Individual', desc: 'Manejo mis finanzas solo/a' },
                  { value: 'family' as const, icon: Users, label: 'En pareja', desc: 'Compartimos gastos con mi pareja' },
                  { value: 'family' as const, icon: Home, label: 'Familia', desc: 'Administramos las finanzas del hogar' },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setData({ ...data, householdType: opt.value })}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                      data.householdType === opt.value && (opt.label !== 'Familia' || data.householdType === 'family')
                        ? 'border-electric-light bg-surface-tint'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <opt.icon className="w-5 h-5 text-electric" />
                    </div>
                    <div>
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-sm text-gray-500">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Income */}
        {step === 3 && (
          <div className="animate-fade-in">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <Wallet className="w-6 h-6 text-electric" />
                </div>
                <CardTitle>¿Cuál es tu ingreso mensual?</CardTitle>
                <CardDescription>
                  Si tu ingreso varía, pon el promedio de los últimos 3 meses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="income">Ingreso mensual total (GTQ)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      Q
                    </span>
                    <Input
                      id="income"
                      type="number"
                      placeholder="0.00"
                      className="pl-8"
                      value={data.totalIncome || ''}
                      onChange={(e) =>
                        setData({ ...data, totalIncome: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Tipo de ingreso</Label>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {[
                      { value: 'fixed' as const, label: 'Fijo', desc: 'Salario mensual' },
                      { value: 'variable' as const, label: 'Variable', desc: 'Comisiones, ventas' },
                      { value: 'mixed' as const, label: 'Mixto', desc: 'Base + variable' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setData({ ...data, incomeType: opt.value })}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          data.incomeType === opt.value
                            ? 'border-electric-light bg-surface-tint'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {data.incomeType === 'variable' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Con ingreso variable, es aún más importante tener un fondo de emergencia.
                      Te ayudaremos a construir uno.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Fixed expenses */}
        {step === 4 && (
          <div className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>¿Cuáles son tus gastos fijos mensuales?</CardTitle>
                <CardDescription>
                  Incluye los gastos que pagas todos los meses. Si no aplica, déjalo en 0.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'vivienda' as const, label: 'Vivienda / Alquiler', icon: '🏠' },
                  { key: 'alimentacion' as const, label: 'Alimentación', icon: '🛒' },
                  { key: 'transporte' as const, label: 'Transporte', icon: '🚗' },
                  { key: 'servicios' as const, label: 'Servicios (agua, luz, internet)', icon: '💡' },
                  { key: 'salud' as const, label: 'Salud / Medicinas', icon: '🏥' },
                  { key: 'educacion' as const, label: 'Educación', icon: '📚' },
                ].map((expense) => (
                  <div key={expense.key} className="flex items-center gap-3">
                    <span className="text-xl w-8 text-center">{expense.icon}</span>
                    <div className="flex-1">
                      <Label htmlFor={expense.key} className="text-sm">
                        {expense.label}
                      </Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                          Q
                        </span>
                        <Input
                          id={expense.key}
                          type="number"
                          placeholder="0"
                          className="pl-8"
                          value={data.fixedExpenses[expense.key] || ''}
                          onChange={(e) =>
                            setData({
                              ...data,
                              fixedExpenses: {
                                ...data.fixedExpenses,
                                [expense.key]: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Separator />
                <div className="flex justify-between items-center font-medium">
                  <span>Total gastos fijos</span>
                  <span className="text-lg">{fmt(totalFixedExpenses)}</span>
                </div>
                {data.totalIncome > 0 && (
                  <p className="text-sm text-gray-500">
                    Esto es el {Math.round((totalFixedExpenses / data.totalIncome) * 100)}% de tu
                    ingreso mensual.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 5: Debts */}
        {step === 5 && (
          <div className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>¿Tienes deudas?</CardTitle>
                <CardDescription>
                  Incluye tarjetas de crédito, préstamos, y también deudas informales (familiares,
                  tandas, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setData({ ...data, hasDebts: true })}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      data.hasDebts
                        ? 'border-electric-light bg-surface-tint'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium">Sí, tengo deudas</p>
                  </button>
                  <button
                    onClick={() => setData({ ...data, hasDebts: false, debts: [] })}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      !data.hasDebts
                        ? 'border-electric-light bg-surface-tint'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium">No tengo deudas</p>
                  </button>
                </div>

                {data.hasDebts && (
                  <>
                    <Separator />
                    {data.debts.map((debt, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3 relative">
                        <button
                          onClick={() => removeDebt(i)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div>
                          <Label>Nombre de la deuda</Label>
                          <Input
                            placeholder="Ej: Tarjeta Visa, Préstamo del tío"
                            className="mt-1"
                            value={debt.name}
                            onChange={(e) => updateDebt(i, 'name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Tipo</Label>
                          <div className="grid grid-cols-3 gap-2 mt-1">
                            {[
                              { value: 'credit', label: 'Tarjeta' },
                              { value: 'loan', label: 'Préstamo' },
                              { value: 'informal', label: 'Informal' },
                            ].map((t) => (
                              <button
                                key={t.value}
                                onClick={() => updateDebt(i, 'type', t.value)}
                                className={`py-1.5 px-2 rounded border text-sm transition-all ${
                                  debt.type === t.value
                                    ? 'border-electric-light bg-surface-tint'
                                    : 'border-gray-200'
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
                            <Input
                              type="number"
                              placeholder="0"
                              className="mt-1"
                              value={debt.balance || ''}
                              onChange={(e) =>
                                updateDebt(i, 'balance', parseFloat(e.target.value) || 0)
                              }
                            />
                          </div>
                          <div>
                            <Label>Pago mínimo (Q)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              className="mt-1"
                              value={debt.minPayment || ''}
                              onChange={(e) =>
                                updateDebt(i, 'minPayment', parseFloat(e.target.value) || 0)
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Tasa de interés anual (%)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            className="mt-1"
                            value={debt.interestRate || ''}
                            onChange={(e) =>
                              updateDebt(i, 'interestRate', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full" onClick={addDebt}>
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar deuda
                    </Button>
                    {data.debts.length > 0 && (
                      <div className="flex justify-between items-center font-medium pt-2">
                        <span>Total deudas</span>
                        <span className="text-lg">{fmt(totalDebt)}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 6: Savings */}
        {step === 6 && (
          <div className="animate-fade-in">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <PiggyBank className="w-6 h-6 text-electric" />
                </div>
                <CardTitle>¿Tienes ahorros?</CardTitle>
                <CardDescription>
                  Incluye todo el dinero que tienes guardado: cuentas de ahorro, debajo del
                  colchón, inversiones, etc.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Efectivo disponible (cuentas de ahorro, efectivo)</Label>
                  <p className="text-xs text-gray-500 mb-1">
                    Dinero que puedes usar de inmediato si lo necesitas.
                  </p>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      Q
                    </span>
                    <Input
                      type="number"
                      placeholder="0"
                      className="pl-8"
                      value={data.savingsCash || ''}
                      onChange={(e) => {
                        const cash = parseFloat(e.target.value) || 0;
                        setData({ ...data, savingsCash: cash, totalSavings: cash + data.savingsInvestments });
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label>Inversiones (plazos fijos, fondos, acciones)</Label>
                  <p className="text-xs text-gray-500 mb-1">
                    Dinero invertido que no tiene disponibilidad inmediata.
                  </p>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      Q
                    </span>
                    <Input
                      type="number"
                      placeholder="0"
                      className="pl-8"
                      value={data.savingsInvestments || ''}
                      onChange={(e) => {
                        const inv = parseFloat(e.target.value) || 0;
                        setData({ ...data, savingsInvestments: inv, totalSavings: data.savingsCash + inv });
                      }}
                    />
                  </div>
                </div>

                {(data.savingsCash > 0 || data.savingsInvestments > 0) && (
                  <div className="bg-gray-50 rounded-lg p-3 flex justify-between text-sm">
                    <span className="text-gray-600">Total ahorros</span>
                    <span className="font-semibold">{fmt(data.totalSavings)}</span>
                  </div>
                )}

                <div>
                  <Label>¿Tienes un fondo de emergencia separado?</Label>
                  <p className="text-sm text-gray-500 mb-2">
                    Un fondo de emergencia es dinero reservado exclusivamente para imprevistos
                    (enfermedades, reparaciones, pérdida de empleo).
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setData({ ...data, hasEmergencyFund: true })}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        data.hasEmergencyFund
                          ? 'border-electric-light bg-surface-tint'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium">Sí</p>
                    </button>
                    <button
                      onClick={() => setData({ ...data, hasEmergencyFund: false })}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        !data.hasEmergencyFund
                          ? 'border-electric-light bg-surface-tint'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium">No</p>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 7: Score result */}
        {step === 7 && score && (
          <div className="animate-fade-in">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Tu salud financiera</CardTitle>
                <CardDescription>
                  Basado en la información que nos diste, este es tu diagnóstico.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Animated score */}
                <div className="text-center">
                  <div
                    className={`inline-flex items-center justify-center w-32 h-32 rounded-full ${scoreBgClass}`}
                  >
                    <span className={`text-5xl font-bold ${scoreColorClass}`}>
                      {animatedScore}
                    </span>
                  </div>
                  <p className={`text-xl font-semibold mt-3 capitalize ${scoreColorClass}`}>
                    {score.label}
                  </p>
                  <p className="text-sm text-gray-500">de 100 puntos posibles</p>
                </div>

                <Separator />

                {/* Score breakdown */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-gray-700">Desglose del puntaje</h4>
                  {[
                    { label: 'Tasa de ahorro', value: score.components.savingsRate, max: 30 },
                    { label: 'Carga de deuda', value: score.components.debtBurden, max: 25 },
                    { label: 'Fondo de emergencia', value: score.components.emergencyFund, max: 20 },
                    { label: 'Gastos fijos', value: score.components.expenseRatio, max: 15 },
                    { label: 'Estabilidad de ingreso', value: score.components.incomeStability, max: 10 },
                  ].map((comp) => (
                    <div key={comp.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{comp.label}</span>
                        <span className="font-medium">
                          {comp.value}/{comp.max}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-electric-light rounded-full transition-all duration-1000"
                          style={{ width: `${(comp.value / comp.max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Insights */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-gray-700">Observaciones</h4>
                  {score.insights.map((insight, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-600">{insight}</p>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ingreso mensual</span>
                    <span className="font-medium">{fmt(data.totalIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gastos fijos</span>
                    <span className="font-medium">{fmt(totalFixedExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Deuda total</span>
                    <span className="font-medium">{fmt(totalDebt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ahorros</span>
                    <span className="font-medium">{fmt(data.totalSavings)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 8: Action plan */}
        {step === 8 && (
          <div className="animate-fade-in">
            <Card>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-electric" />
                </div>
                <CardTitle className="text-2xl">Tu plan de acción</CardTitle>
                <CardDescription>
                  Estos son los pasos que te recomendamos para este mes. Puedes marcar cada uno
                  como completado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        item.priority === 'high'
                          ? 'border-red-400'
                          : item.priority === 'medium'
                          ? 'border-yellow-400'
                          : 'border-gray-300'
                      }`}
                    >
                      <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                      <span
                        className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                          item.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : item.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.priority === 'high'
                          ? 'Prioridad alta'
                          : item.priority === 'medium'
                          ? 'Prioridad media'
                          : 'Prioridad baja'}
                      </span>
                    </div>
                  </div>
                ))}

                <Separator className="my-4" />

                {saveError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{saveError}</p>
                  </div>
                )}

                <Button size="lg" className="w-full" onClick={saveOnboarding} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Guardar e ir a mi dashboard
                    </>
                  )}
                </Button>
                <p className="text-center text-sm text-gray-500">
                  Puedes ajustar tu plan en cualquier momento desde la sección de Plan.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        {step < 8 && (
          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={back} disabled={step === 1}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
            <Button
              onClick={next}
              disabled={step === 1 && !data.householdName.trim()}
            >
              {step === 6 ? 'Ver mi diagnóstico' : step === 7 ? 'Ver mi plan' : 'Siguiente'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
