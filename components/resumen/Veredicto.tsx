'use client';

import { CountUp } from '@/components/motion/CountUp';
import { DIVIDER, TEXT_STRONG } from '@/components/movimientos/ui';
import { AMBER_TEXT, CARD, GREEN_TEXT, GROUP_LABEL } from './ctf-ui';

interface VeredictoProps {
  monthName: string;
  isCurrent: boolean;
  income: number;
  spent: number;
  saved: number;
  savedPct: number | null;
  /** Hay recomendaciones abajo para cerrar la diferencia. */
  hasRecs: boolean;
  fmt: (n: number) => string;
}

/** Hero navy: "En {mes} ahorraste" + ingresos recibidos y gastaste. */
export function Veredicto({ monthName, isCurrent, income, spent, saved, savedPct, hasRecs, fmt }: VeredictoProps) {
  const negative = saved < 0;
  const lead = negative
    ? `En ${monthName} ${isCurrent ? 'llevas gastado de más' : 'gastaste de más'}`
    : `En ${monthName} ${isCurrent ? 'llevas ahorrado' : 'ahorraste'}`;
  // Sin cortar el monto entre líneas ("(Q" / "3,900)").
  const healthy = fmt(income * 0.2).replace(/ /g, '\u00A0');
  let sub: string;
  if (!(income > 0)) {
    sub = `No registraste ingresos recibidos en ${monthName}. Regístralos para ver cuánto ahorraste.`;
  } else if (negative) {
    sub = `Gastaste más de lo que recibiste. Lo sano es ahorrar 20% (${healthy}).`;
  } else {
    sub = `Es el ${savedPct ?? 0}% de tus ingresos. Lo sano es 20% (${healthy}).`;
  }
  if (income > 0 && (savedPct ?? 0) < 20 && hasRecs) sub += ' Abajo te mostramos de dónde sacar la diferencia.';

  return (
    <section
      aria-label="Veredicto del mes"
      className="mt-3.5 flex flex-col gap-1.5 rounded-[20px] p-[22px] text-white"
      style={{ background: 'var(--zafi-hero)' }}
    >
      <span className="text-[15px] text-[#CBD8E8]">{lead}</span>
      <span
        className="font-outfit text-[54px] font-extrabold leading-none tracking-[-0.02em]"
        style={negative ? { color: '#FCA5A5' } : undefined}
      >
        <CountUp value={Math.abs(saved)} from={0} format={fmt} />
      </span>
      <span className="text-sm leading-[1.45] text-[#9FB3CB] [text-wrap:pretty]">
        {sub}
        {isCurrent && ' El mes sigue en curso.'}
      </span>
      <div className="mb-1.5 mt-3 h-px bg-white/10" />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-[#9FB3CB]">Ingresos recibidos</span>
          <span className="font-outfit text-[19px] font-bold">{fmt(income)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-[#9FB3CB]">Gastaste</span>
          <span className="font-outfit text-[19px] font-bold">{fmt(spent)}</span>
        </div>
      </div>
    </section>
  );
}

/** "Lo que salió bien" / "Lo que se pasó" (máximo 3 y 3). */
export function Highlights({ good, bad }: { good: string[]; bad: string[] }) {
  if (good.length === 0 && bad.length === 0) return null;
  return (
    <section aria-label="Lo que salió bien y lo que se pasó" className={`mt-3 flex flex-col gap-3.5 p-4 ${CARD}`}>
      {good.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className={`${GROUP_LABEL} ${GREEN_TEXT}`}>Lo que salió bien</h2>
          <ul className="flex flex-col gap-2">
            {good.map((g) => (
              <li key={g} className="flex items-start gap-2.5">
                <span aria-hidden className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success-light text-xs font-extrabold text-success-dark dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]">✓</span>
                <span className={`text-[14.5px] leading-[1.4] [text-wrap:pretty] ${TEXT_STRONG}`}>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {good.length > 0 && bad.length > 0 && <div className={`border-t ${DIVIDER}`} />}
      {bad.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className={`${GROUP_LABEL} ${AMBER_TEXT}`}>Lo que se pasó</h2>
          <ul className="flex flex-col gap-2">
            {bad.map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <span aria-hidden className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-warning-light text-[13px] font-extrabold text-warning-text dark:bg-warning/20 dark:text-warning">!</span>
                <span className={`text-[14.5px] leading-[1.4] [text-wrap:pretty] ${TEXT_STRONG}`}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
