'use client';

import { CountUp } from '@/components/motion/CountUp';
import { PRESS_BUTTON, TEXT_MUTED } from '@/components/movimientos/ui';
import { shortMonth } from '@/lib/como-te-fue';
import type { Horizon, Projection } from '@/lib/recomendaciones';
import { CARD_LG, GREEN_TEXT, NAVY_BG, SECTION_TITLE } from './ctf-ui';

interface ProyeccionProps {
  horizon: Horizon;
  /** "A diciembre" solo si quedan meses en el año. */
  canYear: boolean;
  onHorizon: (h: Horizon) => void;
  proj: Projection;
  selCount: number;
  planMonthName: string;
  applying: boolean;
  onApply: () => void;
  fmt: (n: number) => string;
}

const EXTRA_BG = 'bg-[#4ADE80]';

function signed(n: number, fmt: (n: number) => string): string {
  return n < 0 ? `−${fmt(-n)}` : fmt(n);
}

/** "Si te ajustas": ahorro acumulado al ritmo actual y con los ajustes elegidos. */
export function Proyeccion({ horizon, canYear, onHorizon, proj, selCount, planMonthName, applying, onApply, fmt }: ProyeccionProps) {
  const n = proj.points.length;
  const max = Math.max(1, ...proj.points.map((p) => Math.max(p.total, p.base, 0)));
  const label = (m: string) => (n > 6 ? shortMonth(m).charAt(0) : shortMonth(m));
  const options: { value: Horizon; text: string }[] = [
    ...(canYear ? [{ value: 'year' as const, text: 'A diciembre' }] : []),
    { value: '12', text: '12 meses' },
  ];

  return (
    <section aria-label="Si te ajustas" className={`mt-[22px] flex flex-col gap-3 px-4 py-[18px] ${CARD_LG}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={SECTION_TITLE}>Si te ajustas</h2>
        <div role="radiogroup" aria-label="Horizonte" className="flex rounded-full bg-[var(--zafi-bg)] p-[3px]">
          {options.map((o) => {
            const on = horizon === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onHorizon(o.value)}
                className={`h-[30px] rounded-full px-3 text-[13px] font-semibold ${
                  on
                    ? 'bg-[var(--zafi-tab-active)] text-[var(--zafi-tab-active-text)] shadow-[0_1px_3px_rgba(13,31,54,0.15)]'
                    : 'text-[var(--zafi-tab-inactive-text)]'
                }`}
              >
                {o.text}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-0.5" aria-live="polite">
        <span className={`text-sm ${TEXT_MUTED}`}>
          {horizon === 'year' ? 'Si sigues tu plan, a diciembre tendrías' : 'Si sigues tu plan, en 12 meses tendrías'}
        </span>
        <span className={`font-outfit text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] ${GREEN_TEXT}`}>
          + <CountUp value={proj.extraTotal} format={fmt} duration={500} />
        </span>
        <span className={`text-[13.5px] ${TEXT_MUTED}`}>
          extra ahorrado · {signed(proj.total, fmt)} en total vs {signed(proj.baseTotal, fmt)} al ritmo actual
        </span>
      </div>

      <div
        className="flex h-[140px] items-end pt-1.5"
        style={{ gap: n > 6 ? 6 : 18 }}
        role="img"
        aria-label={`Ahorro acumulado: ${proj.points.map((p) => `${shortMonth(p.month)} ${fmt(p.total)}`).join(', ')}`}
      >
        {proj.points.map((p) => {
          const base = Math.max(0, p.base);
          const extra = Math.max(0, p.total - base);
          const h = ((base + extra) / max) * 100;
          return (
            <div key={p.month} className="flex h-full flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 flex-col justify-end">
                <div
                  className="flex w-full flex-col overflow-hidden rounded-t-md rounded-b-[3px] transition-[height] duration-[400ms] ease-out"
                  style={{ height: `${h}%`, minHeight: base + extra > 0 ? 3 : 0 }}
                >
                  <div className={`${EXTRA_BG} transition-[flex-grow] duration-[400ms] ease-out`} style={{ flexGrow: extra, flexBasis: 0 }} />
                  <div className={NAVY_BG} style={{ flexGrow: base, flexBasis: 0 }} />
                </div>
              </div>
              <span className={`text-[11.5px] font-semibold ${TEXT_MUTED}`}>{label(p.month)}</span>
            </div>
          );
        })}
      </div>

      <div className={`flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] ${TEXT_MUTED}`}>
        <span className="flex items-center gap-1.5"><span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${NAVY_BG}`} />Ahorro actual</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${EXTRA_BG}`} />Con tus ajustes ({selCount})</span>
      </div>

      <button
        type="button"
        onClick={onApply}
        disabled={applying || selCount === 0}
        className={`h-[46px] rounded-full bg-electric text-[15px] font-bold text-white disabled:opacity-50 ${PRESS_BUTTON}`}
      >
        {applying ? 'Aplicando…' : `Aplicar a mi plan de ${planMonthName}`}
      </button>
    </section>
  );
}
