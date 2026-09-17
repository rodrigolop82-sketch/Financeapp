'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { Wordmark } from '@/components/brand/Wordmark';
import { sessionAnalisis } from '@/lib/session-analisis';
import { calculateHealthScore } from '@/lib/scoring';

const TOTAL_STEPS = 4;

const METAS = [
  'Salir de deudas',
  'Crear fondo de emergencia',
  'Ahorrar para una meta',
  'Aumentar mis ingresos',
  'Organizar mis finanzas',
];

const TIPO_INGRESO = [
  { value: 'fijo', label: 'Fijo', desc: 'Salario estable' },
  { value: 'variable', label: 'Variable', desc: 'Comisiones, ventas' },
  { value: 'mixto', label: 'Mixto', desc: 'Ambos' },
];

function formatQ(n: number) {
  return 'Q ' + n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function AnalisisPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const [ingresos, setIngresos] = useState('');
  const [tipoIngreso, setTipoIngreso] = useState<'fijo' | 'variable' | 'mixto' | ''>('');
  const [gastos, setGastos] = useState('');
  const [deudas, setDeudas] = useState('');
  const [ahorros, setAhorros] = useState('');
  const [meta, setMeta] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const progress = (step / TOTAL_STEPS) * 100;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (!ingresos || Number(ingresos) <= 0) errs.ingresos = 'Ingresá un monto mayor a 0';
      if (!tipoIngreso) errs.tipoIngreso = 'Seleccioná el tipo de ingreso';
    }
    if (step === 2) {
      if (!gastos || Number(gastos) <= 0) errs.gastos = 'Ingresá un monto mayor a 0';
    }
    if (step === 3) {
      if (deudas === '' || Number(deudas) < 0) errs.deudas = 'Ingresá 0 si no tenés deudas';
      if (ahorros === '' || Number(ahorros) < 0) errs.ahorros = 'Ingresá 0 si no tenés ahorros';
    }
    if (step === 4) {
      if (!meta) errs.meta = 'Seleccioná tu meta principal';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (!validate()) return;

    if (step === 1) {
      sessionAnalisis.guardar({ ingresos: Number(ingresos), tipoIngreso: tipoIngreso as 'fijo' | 'variable' | 'mixto' });
    }
    if (step === 2) {
      sessionAnalisis.guardar({ gastos: Number(gastos) });
    }
    if (step === 3) {
      sessionAnalisis.guardar({ deudas: Number(deudas), ahorros: Number(ahorros) });
    }
    if (step === 4) {
      sessionAnalisis.guardar({ meta });
      // Compute score and redirect
      const data = sessionAnalisis.leer()!;
      const incomeTypeMap: Record<string, 'fixed' | 'variable' | 'mixed'> = {
        fijo: 'fixed', variable: 'variable', mixto: 'mixed',
      };
      const scoreResult = calculateHealthScore({
        total_income: data.ingresos,
        total_fixed_expenses: data.gastos,
        total_debt: data.deudas,
        total_savings: data.ahorros,
        has_emergency_fund: data.ahorros >= data.gastos * 3,
        income_type: incomeTypeMap[data.tipoIngreso] || 'fixed',
      });
      sessionAnalisis.guardar({
        score: scoreResult.total,
        scoreLabel: scoreResult.label,
        completadoEn: new Date().toISOString(),
      });
      router.push('/resultados');
      return;
    }

    setDirection('forward');
    setAnimating(true);
    setTimeout(() => {
      setStep((s: number) => s + 1);
      setAnimating(false);
    }, 200);
  }

  function goBack() {
    if (step === 1) return;
    setDirection('back');
    setAnimating(true);
    setTimeout(() => {
      setStep((s: number) => s - 1);
      setAnimating(false);
    }, 200);
  }

  const slideClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-x-4'
      : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <Wordmark size="sm" variant="light" />
        <Link href="/login" className="text-sm text-gray-500 hover:text-navy transition-colors">
          Ya tengo cuenta
        </Link>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-electric transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div
          className={`w-full max-w-md transition-all duration-200 ease-out ${slideClass}`}
        >
          {/* Step label */}
          <p className="text-sm font-medium text-electric mb-2">
            Paso {step} de {TOTAL_STEPS}
          </p>

          {/* Step 1: Ingresos */}
          {step === 1 && (
            <div>
              <h1 className="font-serif text-2xl text-navy mb-1">
                ¿Cuánto ganás al mes?
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Tu ingreso total mensual, antes de gastos
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-navy mb-1">
                  Ingreso mensual
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Q</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={ingresos}
                    onChange={(e) => { setIngresos(e.target.value); setErrors((err) => ({ ...err, ingresos: '' })); }}
                    className="input-base w-full pl-8"
                  />
                </div>
                {errors.ingresos && <p className="text-red-500 text-xs mt-1">{errors.ingresos}</p>}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-navy mb-2">
                  Tipo de ingreso
                </label>
                <div className="flex gap-2">
                  {TIPO_INGRESO.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setTipoIngreso(t.value as 'fijo' | 'variable' | 'mixto'); setErrors((err) => ({ ...err, tipoIngreso: '' })); }}
                      className={`flex-1 py-3 px-2 rounded-xl border text-sm font-medium transition-all duration-150 ${
                        tipoIngreso === t.value
                          ? 'bg-navy text-white border-navy'
                          : 'bg-white text-navy border-gray-200 hover:border-navy/40'
                      }`}
                    >
                      <div className="font-semibold">{t.label}</div>
                      <div className={`text-xs mt-0.5 ${tipoIngreso === t.value ? 'text-white/70' : 'text-gray-400'}`}>
                        {t.desc}
                      </div>
                    </button>
                  ))}
                </div>
                {errors.tipoIngreso && <p className="text-red-500 text-xs mt-1">{errors.tipoIngreso}</p>}
              </div>

              {/* Trust signal */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>Solo vos ves esta información. Nunca la compartimos.</span>
              </div>
            </div>
          )}

          {/* Step 2: Gastos */}
          {step === 2 && (
            <div>
              <h1 className="font-serif text-2xl text-navy mb-1">
                ¿Cuánto gastás al mes?
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Incluí renta, comida, transporte, entretenimiento — todo
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-navy mb-1">
                  Gastos mensuales totales
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Q</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={gastos}
                    onChange={(e) => { setGastos(e.target.value); setErrors((err) => ({ ...err, gastos: '' })); }}
                    className="input-base w-full pl-8"
                  />
                </div>
                {errors.gastos && <p className="text-red-500 text-xs mt-1">{errors.gastos}</p>}
              </div>

              {ingresos && gastos && Number(gastos) > 0 && Number(ingresos) > 0 && (
                <div className="p-3 bg-gray-100 rounded-xl text-sm text-gray-600">
                  Estás gastando el{' '}
                  <span className={`font-semibold ${Number(gastos) / Number(ingresos) > 0.9 ? 'text-red-600' : 'text-navy'}`}>
                    {Math.round((Number(gastos) / Number(ingresos)) * 100)}%
                  </span>{' '}
                  de tus ingresos.{' '}
                  {Number(ingresos) - Number(gastos) >= 0
                    ? `Te quedan ${formatQ(Number(ingresos) - Number(gastos))} al mes.`
                    : 'Estás gastando más de lo que ganás.'}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Deudas y ahorros */}
          {step === 3 && (
            <div>
              <h1 className="font-serif text-2xl text-navy mb-1">
                Deudas y ahorros
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Poné 0 si no aplicá — no hay respuesta incorrecta
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-navy mb-1">
                  ¿Cuánto debés en total?
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Q</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={deudas}
                    onChange={(e) => { setDeudas(e.target.value); setErrors((err) => ({ ...err, deudas: '' })); }}
                    className="input-base w-full pl-8"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Tarjetas, préstamos, créditos — sumados</p>
                {errors.deudas && <p className="text-red-500 text-xs mt-1">{errors.deudas}</p>}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-navy mb-1">
                  ¿Cuánto tenés ahorrado?
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Q</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={ahorros}
                    onChange={(e) => { setAhorros(e.target.value); setErrors((err) => ({ ...err, ahorros: '' })); }}
                    className="input-base w-full pl-8"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Cuenta bancaria, efectivo, inversiones</p>
                {errors.ahorros && <p className="text-red-500 text-xs mt-1">{errors.ahorros}</p>}
              </div>
            </div>
          )}

          {/* Step 4: Meta */}
          {step === 4 && (
            <div>
              <h1 className="font-serif text-2xl text-navy mb-1">
                ¿Cuál es tu meta principal?
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Elegí una — la que más te importa ahora mismo
              </p>

              <div className="space-y-2">
                {METAS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMeta(m); setErrors((err) => ({ ...err, meta: '' })); }}
                    className={`w-full py-3.5 px-4 rounded-xl border text-left text-sm font-medium transition-all duration-150 ${
                      meta === m
                        ? 'bg-navy text-white border-navy'
                        : 'bg-white text-navy border-gray-200 hover:border-navy/40'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {errors.meta && <p className="text-red-500 text-xs mt-2">{errors.meta}</p>}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-navy/40 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="btn-primary flex-1 py-3"
            >
              {step === TOTAL_STEPS ? 'Ver mi resultado →' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
