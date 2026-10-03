'use client';

import { useState } from 'react';
import { perDay, type MonthChoices } from '@/lib/inicio-de-mes';
import {
  BORDER, DIVIDER, PRIMARY_BUTTON, SOFT_BG, TEXT_BODY, TEXT_MUTED, TEXT_STRONG,
} from '@/components/movimientos/ui';

export interface MonthStartIncomeRow {
  id: string;
  emoji: string;
  name: string;
  amount: number;
  received: number;
  day: number | null;
}

export interface MonthStartLeafRow {
  id: string;
  emoji: string;
  name: string;
  plan: number;
  spent: number;
  day: number | null;
}

interface MonthStartSheetProps {
  /** "octubre". */
  monthName: string;
  done: boolean;
  incomes: MonthStartIncomeRow[];
  leaves: MonthStartLeafRow[];
  initialChoices: MonthChoices;
  initialRemind: boolean;
  /** Básico + gustos. */
  planSpend: number;
  spent: number;
  daysLeft: number;
  fmt: (n: number) => string;
  saving: boolean;
  onSave: (choices: MonthChoices, remind: boolean, reserved: number) => void;
}

function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`relative h-7 w-[46px] flex-none rounded-full transition-colors ${on ? 'bg-electric' : 'bg-ink-200 dark:bg-white/20'}`}>
      <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-[left]" style={{ left: on ? 21 : 3 }} />
    </span>
  );
}

function Check() {
  return <span className="w-[46px] flex-none text-center text-[13px] font-bold text-success-dark">✓</span>;
}

interface RowProps {
  emoji: string;
  name: string;
  sub: string;
  amount: string;
  amountClass: string;
  done: boolean;
  on: boolean;
  last: boolean;
  onToggle: () => void;
}

function Row({ emoji, name, sub, amount, amountClass, done, on, last, onToggle }: RowProps) {
  const body = (
    <>
      <span aria-hidden className="w-[26px] flex-none text-center text-xl leading-none">{emoji}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
        <span className={`truncate text-[14.5px] font-semibold ${TEXT_STRONG}`}>{name}</span>
        <span className={`text-[12.5px] ${TEXT_MUTED}`}>{sub}</span>
      </span>
      <span className={`flex-none font-outfit text-[15px] font-bold ${amountClass}`}>{amount}</span>
      {done ? <Check /> : <Switch on={on} />}
    </>
  );
  const cls = `flex w-full items-center gap-3 px-3.5 py-3 ${last ? '' : `border-b ${DIVIDER}`}`;
  if (done) return <div className={cls}>{body}</div>;
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={name} onClick={onToggle} className={cls}>
      {body}
    </button>
  );
}

/** Contenido de la hoja "Empieza {mes}". */
export function MonthStartSheet({
  monthName, done, incomes, leaves, initialChoices, initialRemind, planSpend, spent, daysLeft, fmt, saving, onSave,
}: MonthStartSheetProps) {
  const [choices, setChoices] = useState<MonthChoices>(initialChoices);
  const [remind, setRemind] = useState(initialRemind);

  const toggle = (kind: 'expense' | 'income', id: string) =>
    setChoices((c) => ({ ...c, [kind]: { ...c[kind], [id]: !(c[kind][id] ?? true) } }));

  const reserved = leaves.reduce((a, l) => {
    const pending = Math.max(0, l.plan - l.spent);
    return (choices.expense[l.id] ?? true) ? a + pending : a;
  }, 0);
  const withReserve = perDay(planSpend, spent, reserved, daysLeft);
  const without = perDay(planSpend, spent, 0, daysLeft);
  const title = `Empieza ${monthName}`;

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-1.5 [&>*]:shrink-0">
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Inicio de mes</span>
        <h2 tabIndex={-1} className={`font-serif text-[26px] leading-tight outline-none ${TEXT_STRONG}`}>{title}</h2>
        <p className={`text-sm leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>
          Confirma lo que te entra y aparta lo que pagas cada mes. Así lo que ves como disponible es real, aunque algo llegue o se pague hasta fin de mes.
        </p>
      </div>

      {incomes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={`px-0.5 text-[13px] font-bold ${TEXT_BODY}`}>Lo que te entra</h3>
          <div className={`overflow-hidden rounded-2xl border ${BORDER}`}>
            {incomes.map((r, i) => {
              const got = r.amount > 0 && r.received >= r.amount;
              const on = choices.income[r.id] ?? true;
              const when = r.day ? `llega el día ${r.day}` : 'sin fecha fija';
              return (
                <Row
                  key={r.id}
                  emoji={r.emoji}
                  name={r.name}
                  sub={got ? 'Ya llegó' : `${on ? 'Cuento con él este mes' : 'Solo cuenta cuando llegue'} · ${when}`}
                  amount={fmt(r.amount)}
                  amountClass="text-success-dark"
                  done={got}
                  on={on}
                  last={i === incomes.length - 1}
                  onToggle={() => toggle('income', r.id)}
                />
              );
            })}
          </div>
        </section>
      )}

      {leaves.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={`px-0.5 text-[13px] font-bold ${TEXT_BODY}`}>Lo que pagas</h3>
          <div className={`overflow-hidden rounded-2xl border ${BORDER}`}>
            {leaves.map((r, i) => {
              const paid = r.plan > 0 && r.spent >= r.plan;
              const on = choices.expense[r.id] ?? true;
              const when = r.day ? `vence el ${r.day}` : 'sin fecha fija';
              return (
                <Row
                  key={r.id}
                  emoji={r.emoji}
                  name={r.name}
                  sub={paid ? 'Ya lo registraste' : `${on ? 'Contado como gastado' : 'Cuenta como disponible'} · ${when}`}
                  amount={fmt(paid ? r.plan : r.plan - r.spent)}
                  amountClass={TEXT_STRONG}
                  done={paid}
                  on={on}
                  last={i === leaves.length - 1}
                  onToggle={() => toggle('expense', r.id)}
                />
              );
            })}
          </div>
        </section>
      )}

      <div aria-live="polite" className={`flex flex-col gap-1 rounded-2xl p-4 ${SOFT_BG}`}>
        <span className={`text-[13px] font-semibold ${TEXT_MUTED}`}>Con esto, hoy podrías gastar</span>
        <span className="flex items-baseline gap-1.5">
          <span className={`font-outfit text-[34px] font-extrabold leading-tight ${TEXT_STRONG}`}>{fmt(withReserve)}</span>
          <span className={`text-sm ${TEXT_MUTED}`}>al día</span>
        </span>
        <span className={`text-[13.5px] leading-[1.4] ${TEXT_BODY}`}>
          {reserved > 0
            ? `Sin apartar serían ${fmt(without)} al día, pero ${fmt(reserved)} ya tienen dueño.`
            : 'No estás apartando nada: todo cuenta como disponible.'}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={remind}
        onClick={() => setRemind(!remind)}
        className={`flex items-center gap-3 rounded-[14px] border p-3.5 text-left ${BORDER}`}
      >
        <span className="flex flex-1 flex-col gap-0.5">
          <span className={`text-[14.5px] font-semibold ${TEXT_STRONG}`}>Recordarme cada día 1</span>
          <span className={`text-[13px] ${TEXT_MUTED}`}>Con lo que elijas hoy ya marcado</span>
        </span>
        <Switch on={remind} />
      </button>

      <button type="button" disabled={saving} onClick={() => onSave(choices, remind, reserved)} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : done ? 'Guardar cambios' : 'Empezar el mes'}
      </button>
    </div>
  );
}
