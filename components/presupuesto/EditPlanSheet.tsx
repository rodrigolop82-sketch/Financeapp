'use client';

import { useState } from 'react';
import { impactText } from '@/lib/plan-del-mes';
import { cleanAmountInput } from '@/lib/movimientos';
import {
  BORDER, PRIMARY_BUTTON, SHEET_TITLE, SOFT_BG, TEXT_BODY, TEXT_MUTED, TEXT_STRONG, TILE_BG,
} from '@/components/movimientos/ui';

export type PlanItemKind = 'category' | 'part' | 'goal' | 'income';

export interface PlanDraft {
  name: string;
  /** Monto mensual. */
  amount: number;
  fixed: boolean;
  /** Se borra al guardar si no es fijo. */
  day: number | null;
}

export interface EditPlanTarget {
  kind: PlanItemKind;
  isNew: boolean;
  emoji: string;
  title: string;
  subtitle: string;
  initial: PlanDraft;
  /** Lo gastado este mes (avisa si el nuevo monto queda por debajo). */
  spent: number;
  /** "Como septiembre · Q x"; null si no hay dato. */
  last: { label: string; amount: number } | null;
  canSplit: boolean;
  canRemove: boolean;
}

interface EditPlanSheetProps {
  target: EditPlanTarget;
  /** Nombre del mes en curso, "octubre". */
  month: string;
  /** Sin asignar con el plan guardado. */
  unassigned: number;
  fmt: (n: number) => string;
  saving: boolean;
  onSave: (draft: PlanDraft) => void;
  onSplit: (draft: PlanDraft) => void;
  onRemove: () => void;
}

const DUE_CHIPS: { label: string; value: number | null }[] = [
  { label: 'Inicio de mes', value: 1 },
  { label: 'Quincena', value: 15 },
  { label: 'Fin de mes', value: 31 },
  { label: 'Sin fecha fija', value: null },
];

function amountText(n: number): string {
  return n > 0 ? String(Math.round(n * 100) / 100) : '';
}

/** Contenido de la hoja "Editar plan": la misma para categoría, parte, meta e ingreso. */
export function EditPlanSheet({ target, month, unassigned, fmt, saving, onSave, onSplit, onRemove }: EditPlanSheetProps) {
  const { kind } = target;
  const isIncome = kind === 'income';
  const [name, setName] = useState(target.initial.name);
  const [amount, setAmount] = useState(amountText(target.initial.amount));
  const [fixed, setFixed] = useState(target.initial.fixed);
  const [day, setDay] = useState<number | null>(target.initial.day);

  const value = Number(amount) || 0;
  const draft: PlanDraft = { name, amount: value, fixed, day };
  const delta = value - target.initial.amount;
  const newUnassigned = Math.round((isIncome ? unassigned + delta : unassigned - delta) * 100) / 100;
  const negative = newUnassigned < 0;

  let warn: string | null = null;
  if (isIncome && !fixed) warn = 'Como cambia cada mes, planea con un monto bajo. Si entra más, lo asignas cuando llegue.';
  else if ((kind === 'category' || kind === 'part') && value < target.spent) {
    warn = `Ya gastaste ${fmt(target.spent)} aquí; con este monto quedarías pasado.`;
  }

  const question = {
    category: `¿Cuánto quieres gastar en ${month}?`,
    part: '¿Cuánto planeas para esto?',
    goal: '¿Cuánto apartas cada mes?',
    income: '¿Cuánto esperas recibir al mes?',
  }[kind];

  const fixHint = isIncome
    ? fixed
      ? 'Te llega el mismo monto cada mes, como un salario. Lo confirmas en tu inicio de mes.'
      : 'Cambia cada mes, como ventas o trabajos por tu cuenta. Lo tomamos como un estimado.'
    : fixed
      ? 'Casi siempre es el mismo monto, como la renta o el internet. Zafi lo aparta antes de calcular lo que puedes gastar al día.'
      : 'Cambia según lo que hagas, como el súper o salir a comer. Aquí es donde puedes ajustar para ahorrar.';

  const pill = `h-[38px] px-4 rounded-full border text-sm font-semibold ${BORDER} ${TEXT_BODY} bg-[var(--zafi-card)]`;
  const step = (fn: (v: number) => number) => setAmount(amountText(Math.max(0, fn(Math.round(value)))));

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-1.5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <span aria-hidden className={`flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[15px] text-[26px] ${TILE_BG}`}>
          {target.emoji}
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 tabIndex={-1} className={`${SHEET_TITLE} truncate`}>{target.title}</h2>
          <span className={`text-sm ${TEXT_MUTED}`}>{target.subtitle}</span>
        </div>
      </div>

      {/* Nombre (parte e ingreso) */}
      {(kind === 'part' || isIncome) && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          aria-label="Nombre"
          placeholder={isIncome ? 'Nombre, por ej. Salario o Ventas' : 'Nombre, por ej. Cuota de mantenimiento'}
          className={`h-12 rounded-xl border-[1.5px] border-electric-soft bg-[var(--zafi-card)] px-3.5 text-[15.5px] font-semibold outline-none placeholder:font-normal placeholder:text-ink-400 focus:border-electric ${TEXT_STRONG}`}
        />
      )}

      {/* Monto */}
      <label className="flex flex-col items-center gap-0.5">
        <span className={`text-[13px] font-semibold ${TEXT_MUTED}`}>{question}</span>
        <span className="flex items-center justify-center gap-1">
          <span aria-hidden className="font-outfit text-[44px] font-extrabold text-ink-400">Q</span>
          <input
            value={amount}
            onChange={(e) => setAmount(cleanAmountInput(e.target.value))}
            inputMode="decimal"
            placeholder="0"
            aria-label="Monto"
            className={`w-[190px] bg-transparent font-outfit text-[48px] font-extrabold tracking-[-0.03em] outline-none placeholder:text-ink-200 ${TEXT_STRONG}`}
          />
        </span>
      </label>

      {/* Atajos */}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => step((v) => v - 100)} className={pill}>− 100</button>
        <button type="button" onClick={() => step((v) => v + 100)} className={pill}>+ 100</button>
        {target.last && (
          <button type="button" onClick={() => setAmount(amountText(target.last!.amount))} className={`${pill} px-3.5`}>
            Como {target.last.label} · {fmt(target.last.amount)}
          </button>
        )}
      </div>

      {/* Fijo / Variable */}
      {kind !== 'goal' && (
        <div className="flex flex-col gap-1.5">
          <div role="radiogroup" aria-label="Fijo o variable" className="grid grid-cols-2 rounded-xl bg-[var(--zafi-tab-bg)] p-1">
            {([true, false] as const).map((v) => {
              const active = fixed === v;
              return (
                <button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFixed(v)}
                  className={`h-[38px] rounded-[9px] text-sm font-semibold ${
                    active
                      ? 'bg-[var(--zafi-tab-active)] text-[var(--zafi-tab-active-text)] shadow-[0_1px_3px_rgba(30,58,95,0.15)]'
                      : 'text-[var(--zafi-tab-inactive-text)]'
                  }`}
                >
                  {v ? 'Fijo' : 'Variable'}
                </button>
              );
            })}
          </div>
          <span className={`text-[13px] leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>{fixHint}</span>

          {fixed && (
            <div className="mt-1.5 flex flex-col gap-2">
              <div className={`flex items-center gap-2.5 rounded-[14px] border py-2.5 pl-3.5 pr-3 ${BORDER}`}>
                <div className="flex flex-1 flex-col gap-px">
                  <span className={`text-[14.5px] font-semibold ${TEXT_STRONG}`}>
                    {isIncome ? '¿Qué día te pagan?' : '¿Qué día vence?'}
                  </span>
                  <span className={`text-[12.5px] ${TEXT_MUTED}`}>Lo usamos en tu inicio de mes</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDay((d) => Math.max(1, (d || 2) - 1))}
                  aria-label="Un día antes"
                  className={`h-9 w-9 flex-none rounded-full border text-lg font-semibold text-navy dark:text-ink-100 bg-[var(--zafi-card)] ${BORDER}`}
                >
                  −
                </button>
                <span aria-live="polite" className={`min-w-[74px] text-center font-outfit text-base font-bold ${TEXT_STRONG}`}>
                  {day ? `Día ${day}` : 'Sin fecha'}
                </span>
                <button
                  type="button"
                  onClick={() => setDay((d) => Math.min(31, (d || 0) + 1))}
                  aria-label="Un día después"
                  className={`h-9 w-9 flex-none rounded-full border text-lg font-semibold text-navy dark:text-ink-100 bg-[var(--zafi-card)] ${BORDER}`}
                >
                  +
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {DUE_CHIPS.map((c) => {
                  const on = day === c.value;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDay(c.value)}
                      className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-semibold ${
                        on
                          ? 'border-electric bg-[#EFF6FF] text-electric-dark dark:bg-electric/20 dark:text-electric-pale'
                          : `${BORDER} bg-[var(--zafi-card)] ${TEXT_BODY}`
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Impacto */}
      <div
        aria-live="polite"
        className={`flex flex-col gap-1 rounded-[14px] p-3.5 ${negative ? 'bg-[var(--zafi-error-bg)]' : SOFT_BG}`}
      >
        <span className={`text-sm font-semibold ${negative ? 'text-[var(--zafi-error-text)]' : TEXT_BODY}`}>
          {impactText(newUnassigned, isIncome, fmt)}
        </span>
        {warn && <span className="text-[13.5px] leading-[1.4] text-warning-text dark:text-warning">{warn}</span>}
      </div>

      {/* Botones */}
      <button type="button" disabled={saving} onClick={() => onSave(draft)} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {target.canSplit && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onSplit(draft)}
          className="h-11 rounded-[14px] border-[1.5px] border-dashed border-electric-soft text-[14.5px] font-semibold text-electric"
        >
          Dividir en partes
        </button>
      )}
      {target.canRemove && (
        <button
          type="button"
          disabled={saving}
          onClick={onRemove}
          className="h-11 text-[14.5px] font-semibold text-danger-text dark:text-[#FCA5A5]"
        >
          Quitar esta parte
        </button>
      )}
    </div>
  );
}
