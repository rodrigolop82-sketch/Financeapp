'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PrivacyGateScreen } from '@/components/onboarding/PrivacyGateScreen';
import {
  BADGE_NEUTRAL, BADGE_WARN, DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, GroupTitle, INPUT_48, ListCard, ROW_DIVIDER,
  RowBody, Segmented, Tile,
} from '@/components/layout/Pantalla';
import { CARD } from '@/components/resumen/ctf-ui';
import { BORDER, CARD_BG, PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { AddRow, Note } from '@/components/plan/ui';
import { ScoreHero, ScoreParts } from '@/components/score/ScoreUI';
import { OnboardingData } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { scoreFromProfile, type HealthScoreResult } from '@/lib/score-calculator';
import { generateInitialPlan } from '@/lib/action-plan';
import { ActionStep } from '@/types';

const TOTAL_STEPS = 9;

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
  const [score, setScore] = useState<HealthScoreResult | null>(null);
  const [plan, setPlan] = useState<ActionStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const router = useRouter();
  const fmt = useFormatMoney();

  // Pareja y familia guardan el mismo tipo; se recuerda cuál se tocó.
  const [householdChoice, setHouseholdChoice] = useState<string>('Individual');

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
    const debtPayments = data.debts.reduce((a, d) => a + (Number(d.minPayment) || 0), 0);
    const result = scoreFromProfile(profile, debtPayments);
    setScore(result);
    setPlan(generateInitialPlan(profile, result));
  }

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

  const setAmount = (v: string) => parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
  const amountInput = (value: number, onChange: (n: number) => void, id: string, label: string) => (
    <label htmlFor={id} className="flex items-center justify-center gap-1 py-1.5">
      <span aria-hidden className="font-outfit text-[44px] font-extrabold text-ink-400">Q</span>
      <input
        id={id}
        aria-label={label}
        inputMode="decimal"
        placeholder="0"
        value={value ? String(value) : ''}
        onChange={(e) => onChange(setAmount(e.target.value))}
        style={{ width: `${Math.max(1, String(value || '').length) + 0.6}ch` }}
        className={`max-w-[260px] bg-transparent font-outfit text-[48px] font-extrabold tracking-[-0.03em] outline-none placeholder:text-ink-200 dark:placeholder:text-white/20 ${TEXT_STRONG}`}
      />
    </label>
  );
  const sumRow = (label: string, value: string) => (
    <p className={`mx-1 flex items-center justify-between text-sm ${TEXT_MUTED}`}>
      <span>{label}</span>
      <b className={`font-outfit text-[17px] ${TEXT_STRONG}`}>{value}</b>
    </p>
  );
  const PRIORITY = {
    high: { label: 'Prioridad alta', badge: 'flex-none rounded-full px-2 py-0.5 text-[11.5px] font-bold bg-danger-light text-danger-text dark:bg-[var(--zafi-error-bg)] dark:text-[var(--zafi-error-text)]' },
    medium: { label: 'Prioridad media', badge: BADGE_WARN },
    low: { label: 'Prioridad baja', badge: BADGE_NEUTRAL },
  } as const;

  return (
    <div className="min-h-screen bg-[var(--zafi-bg)]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-[22px] px-5 pb-6 pt-[calc(20px+env(safe-area-inset-top))]">
        {/* Avance */}
        <div className="flex flex-col gap-2.5">
          <span className={`text-[13px] font-semibold ${TEXT_MUTED}`}>Paso {step} de {TOTAL_STEPS}</span>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${TOTAL_STEPS}, minmax(0, 1fr))` }} aria-hidden>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className={`h-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-electric' : 'bg-[var(--zafi-border)]'}`} />
            ))}
          </div>
        </div>

        <div key={step} className="flex flex-col gap-[22px] zafi-stagger">
          {step === 1 && (
            <>
              <Title title="Hola, soy Zafi" sub="En 5 minutos conozco tus finanzas y te doy un plan. Empecemos por tu hogar." />
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="householdName">Nombre de tu hogar</FieldLabel>
                <input
                  id="householdName"
                  placeholder="Ej. Casa García, Mi presupuesto"
                  value={data.householdName}
                  onChange={(e) => setData({ ...data, householdName: e.target.value })}
                  className={INPUT_48}
                />
                <span className={`text-[13px] ${TEXT_MUTED}`}>Así identificas este presupuesto.</span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Title title="¿Cómo administras tus finanzas?" sub="Así personalizamos tu plan." />
              <div role="radiogroup" aria-label="Tipo de hogar" className="flex flex-col gap-2">
                {([
                  { value: 'individual', emoji: '🙋', name: 'Individual', help: 'Manejo mis finanzas por mi cuenta' },
                  { value: 'family', emoji: '💑', name: 'En pareja', help: 'Compartimos gastos con mi pareja' },
                  { value: 'family', emoji: '👪', name: 'Familia', help: 'Administramos las finanzas del hogar' },
                ] as const).map((o) => (
                  <Choice
                    key={o.name}
                    selected={householdChoice === o.name}
                    emoji={o.emoji}
                    name={o.name}
                    help={o.help}
                    onClick={() => { setHouseholdChoice(o.name); setData({ ...data, householdType: o.value }); }}
                  />
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Title title="¿Cuál es tu ingreso mensual?" sub="Lo que entra a tu casa cada mes. Si varía, pon el promedio de los últimos 3 meses." />
              {amountInput(data.totalIncome, (n) => setData({ ...data, totalIncome: n }), 'income', 'Ingreso mensual')}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Tipo de ingreso</FieldLabel>
                <Segmented
                  label="Tipo de ingreso"
                  options={[{ value: 'fixed', label: 'Fijo' }, { value: 'variable', label: 'Variable' }, { value: 'mixed', label: 'Mixto' }]}
                  value={data.incomeType}
                  onChange={(v) => setData({ ...data, incomeType: v })}
                />
                <p className={`text-[13.5px] ${TEXT_MUTED}`}>
                  {data.incomeType === 'fixed' ? 'Recibes lo mismo cada mes (salario).'
                    : data.incomeType === 'variable' ? 'Cambia mes a mes (comisiones, negocio, freelance).'
                    : 'Una parte fija y otra que cambia.'}
                </p>
              </div>
              {data.incomeType === 'variable' && (
                <Note tone="warn" className="">Con ingreso variable, un fondo de emergencia es aún más importante. Te ayudamos a construirlo.</Note>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <Title title="¿Cuáles son tus gastos fijos mensuales?" sub="Lo que pagas todos los meses. Si no aplica, déjalo en blanco." />
              <ListCard>
                {([
                  { key: 'vivienda', label: 'Vivienda / alquiler', icon: '🏠' },
                  { key: 'alimentacion', label: 'Alimentación', icon: '🛒' },
                  { key: 'transporte', label: 'Transporte', icon: '🚗' },
                  { key: 'servicios', label: 'Servicios (agua, luz, internet)', icon: '💡' },
                  { key: 'salud', label: 'Salud / medicinas', icon: '🏥' },
                  { key: 'educacion', label: 'Educación', icon: '📚' },
                ] as const).map((x) => (
                  <label key={x.key} htmlFor={x.key} className={`flex min-h-16 items-center gap-3 py-2 ${ROW_DIVIDER}`}>
                    <RowBody tile={<Tile>{x.icon}</Tile>} name={x.label} />
                    <input
                      id={x.key}
                      inputMode="decimal"
                      placeholder="Q 0"
                      value={data.fixedExpenses[x.key] || ''}
                      onChange={(e) => setData({ ...data, fixedExpenses: { ...data.fixedExpenses, [x.key]: setAmount(e.target.value) } })}
                      className={`h-11 w-28 flex-none rounded-xl border border-[var(--zafi-border)] bg-[var(--zafi-bg)] px-3 text-right font-outfit text-[15px] font-bold outline-none focus:border-electric ${TEXT_STRONG}`}
                    />
                  </label>
                ))}
              </ListCard>
              {sumRow('Total gastos fijos', fmt(totalFixedExpenses))}
              {data.totalIncome > 0 && totalFixedExpenses > 0 && (
                <p className={`-mt-3 mx-1 text-[13px] ${TEXT_MUTED}`}>Es el {Math.round((totalFixedExpenses / data.totalIncome) * 100)}% de tu ingreso.</p>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <Title title="¿Tienes deudas?" sub="Tarjetas, préstamos o lo que le debas a alguien (familia, tandas). Lo usamos para tu plan." />
              <div role="radiogroup" aria-label="¿Tienes deudas?" className="flex flex-col gap-2">
                <Choice selected={data.hasDebts} emoji="💳" name="Sí, tengo deudas" help="Agrégalas aquí abajo" onClick={() => setData({ ...data, hasDebts: true, debts: data.debts.length ? data.debts : [{ name: '', type: 'credit', balance: 0, interestRate: 0, minPayment: 0 }] })} />
                <Choice selected={!data.hasDebts} emoji="🙌" name="No tengo deudas" help="¡Excelente!" onClick={() => setData({ ...data, hasDebts: false, debts: [] })} />
              </div>
              {data.hasDebts && (
                <>
                  {data.debts.map((debt, i) => (
                    <div key={i} className={`flex flex-col gap-3 p-3.5 ${CARD}`}>
                      <div className="flex flex-col gap-1.5">
                        <FieldLabel htmlFor={`debt-name-${i}`}>Nombre</FieldLabel>
                        <input id={`debt-name-${i}`} placeholder="Ej. Tarjeta Visa, Préstamo del tío" value={debt.name} onChange={(e) => updateDebt(i, 'name', e.target.value)} className={INPUT_48} />
                      </div>
                      <Segmented
                        label="Tipo de deuda"
                        options={[{ value: 'credit', label: 'Tarjeta' }, { value: 'loan', label: 'Préstamo' }, { value: 'informal', label: 'Informal' }]}
                        value={debt.type as 'credit' | 'loan' | 'informal'}
                        onChange={(v) => updateDebt(i, 'type', v)}
                      />
                      <div className="flex gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <FieldLabel htmlFor={`debt-balance-${i}`}>Saldo</FieldLabel>
                          <input id={`debt-balance-${i}`} inputMode="decimal" placeholder="Q 0" value={debt.balance || ''} onChange={(e) => updateDebt(i, 'balance', setAmount(e.target.value))} className={INPUT_48} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <FieldLabel htmlFor={`debt-min-${i}`}>Pago mínimo</FieldLabel>
                          <input id={`debt-min-${i}`} inputMode="decimal" placeholder="Q 0" value={debt.minPayment || ''} onChange={(e) => updateDebt(i, 'minPayment', setAmount(e.target.value))} className={INPUT_48} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <FieldLabel htmlFor={`debt-rate-${i}`}>Interés anual (%)</FieldLabel>
                        <input id={`debt-rate-${i}`} inputMode="decimal" placeholder="0" value={debt.interestRate || ''} onChange={(e) => updateDebt(i, 'interestRate', setAmount(e.target.value))} className={INPUT_48} />
                      </div>
                      <button type="button" onClick={() => removeDebt(i)} className={DANGER_TEXT_BUTTON}>Quitar esta deuda</button>
                    </div>
                  ))}
                  <ListCard><AddRow label="Agregar otra deuda" onClick={addDebt} /></ListCard>
                  {data.debts.length > 0 && sumRow('Total deudas', fmt(totalDebt))}
                </>
              )}
            </>
          )}

          {step === 6 && (
            <>
              <Title title="¿Tienes ahorros?" sub="Todo lo que tienes guardado: cuentas de ahorro, efectivo, inversiones." />
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="savingsCash">Disponible ya</FieldLabel>
                <input
                  id="savingsCash"
                  inputMode="decimal"
                  placeholder="Q 0"
                  value={data.savingsCash || ''}
                  onChange={(e) => { const cash = setAmount(e.target.value); setData({ ...data, savingsCash: cash, totalSavings: cash + data.savingsInvestments }); }}
                  className={INPUT_48}
                />
                <span className={`text-[13px] ${TEXT_MUTED}`}>Cuentas de ahorro o efectivo que puedes usar de inmediato.</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="savingsInv">Inversiones</FieldLabel>
                <input
                  id="savingsInv"
                  inputMode="decimal"
                  placeholder="Q 0"
                  value={data.savingsInvestments || ''}
                  onChange={(e) => { const inv = setAmount(e.target.value); setData({ ...data, savingsInvestments: inv, totalSavings: data.savingsCash + inv }); }}
                  className={INPUT_48}
                />
                <span className={`text-[13px] ${TEXT_MUTED}`}>Plazos fijos, fondos o acciones.</span>
              </div>
              {data.totalSavings > 0 && sumRow('Total ahorros', fmt(data.totalSavings))}
              <div className="flex flex-col gap-2">
                <FieldLabel>¿Tienes un fondo de emergencia aparte?</FieldLabel>
                <div role="radiogroup" aria-label="Fondo de emergencia" className="flex flex-col gap-2">
                  <Choice selected={data.hasEmergencyFund} emoji="🛡️" name="Sí" help="Dinero solo para imprevistos" onClick={() => setData({ ...data, hasEmergencyFund: true })} />
                  <Choice selected={!data.hasEmergencyFund} emoji="⏳" name="Todavía no" help="Te ayudamos a empezarlo" onClick={() => setData({ ...data, hasEmergencyFund: false })} />
                </div>
              </div>
            </>
          )}

          {step === 7 && score && (
            <>
              <Title title="Tu salud financiera" sub="Con lo que nos contaste, así empiezas." />
              <div className="-mt-3.5">
                <ScoreHero score={score} sub="Se actualiza sola con lo que registres en Zafi." />
              </div>
              <section className="-mt-[22px]">
                <GroupTitle>Qué lo compone</GroupTitle>
                <ScoreParts score={score} actions={false} />
              </section>
            </>
          )}

          {step === 8 && <PrivacyGateScreen onContinue={next} />}

          {step === 9 && (
            <>
              <Title title="Tu plan de acción" sub="Los pasos que te recomendamos para este mes." />
              <ListCard>
                {plan.map((item, i) => (
                  <div key={item.id} className={`flex items-start gap-3 py-3 ${ROW_DIVIDER}`}>
                    <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-electric-ghost text-xs font-bold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft">
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{item.title}</span>
                      <span className={`text-[13px] leading-[1.4] ${TEXT_MUTED}`}>{item.description}</span>
                      <span className={`self-start ${PRIORITY[item.priority as keyof typeof PRIORITY]?.badge ?? BADGE_NEUTRAL}`}>
                        {PRIORITY[item.priority as keyof typeof PRIORITY]?.label ?? 'Prioridad'}
                      </span>
                    </span>
                  </div>
                ))}
              </ListCard>
              {saveError && <ErrorBox>{saveError}</ErrorBox>}
              <p className={`-mt-2 text-center text-[13px] ${TEXT_MUTED}`}>Puedes ajustarlo cuando quieras desde Plan.</p>
            </>
          )}
        </div>

        {/* Pie */}
        {step !== 8 && (
          <div className="sticky bottom-0 mt-auto flex flex-col gap-1.5 bg-[var(--zafi-bg)] pb-[env(safe-area-inset-bottom)] pt-2">
            {step === 9 ? (
              <button type="button" onClick={saveOnboarding} disabled={saving} className={PRIMARY_BUTTON}>
                {saving ? 'Guardando…' : 'Guardar e ir a Inicio'}
              </button>
            ) : (
              <button type="button" onClick={next} disabled={step === 1 && !data.householdName.trim()} className={PRIMARY_BUTTON}>
                {step === 6 ? 'Ver mi diagnóstico' : 'Continuar'}
              </button>
            )}
            {step > 1 && (
              <button type="button" onClick={back} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>Atrás</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const choice = (selected: boolean) =>
  `flex w-full items-center gap-3 rounded-[14px] p-3.5 text-left transition duration-150 active:scale-[0.98] ${
    selected ? 'border-2 border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : `border-[1.5px] ${BORDER} ${CARD_BG}`
  }`;

/** Opción tocable (tile + nombre + ayuda); la elegida lleva borde azul. */
function Choice({ selected, emoji, name, help, onClick }: { selected: boolean; emoji: string; name: string; help?: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={choice(selected)}>
      <RowBody tile={<Tile>{emoji}</Tile>} name={name} help={help} />
    </button>
  );
}

/** Pregunta del paso: DM Serif 30 y explicación. */
function Title({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className={`font-serif text-[30px] leading-[1.15] [text-wrap:pretty] ${TEXT_STRONG}`}>{title}</h1>
      {sub && <p className={`text-[15px] leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>{sub}</p>}
    </div>
  );
}
