'use client';

import { useState } from 'react';
import { BORDER, PRESS_BUTTON, PRIMARY_BUTTON, SHEET_TITLE, TEXT_BODY, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { CAP_MAX, CAP_META, CAP_MIN, DEFAULT_CAPS, type CapKey } from '@/lib/recomendaciones';

interface CapSheetProps {
  capKey: CapKey;
  initial: number;
  income: number;
  saving: boolean;
  onSave: (pct: number) => void;
  fmt: (n: number) => string;
}

/** Contenido de la hoja "Tope para {categoría}": slider 3–50 %. */
export function CapSheet({ capKey, initial, income, saving, onSave, fmt }: CapSheetProps) {
  const [draft, setDraft] = useState(Math.round(Math.min(CAP_MAX, Math.max(CAP_MIN, initial))));
  const meta = CAP_META[capKey];
  const rec = DEFAULT_CAPS[capKey];

  return (
    <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-1.5 [&>*]:shrink-0">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="text-2xl">{meta.emoji}</span>
        <div className="flex flex-col">
          <h2 tabIndex={-1} className={`${SHEET_TITLE} !text-[20px]`}>Tope para {meta.name.toLowerCase()}</h2>
          <span className={`text-[13.5px] ${TEXT_MUTED}`}>Máximo ideal sobre tus ingresos recibidos</span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2" aria-live="polite">
        <span className={`font-outfit text-[44px] font-extrabold leading-none ${TEXT_STRONG}`}>{draft}%</span>
        {income > 0 && <span className={`text-[15px] ${TEXT_BODY}`}>= {fmt((draft / 100) * income)} al mes</span>}
      </div>
      <input
        type="range"
        min={CAP_MIN}
        max={CAP_MAX}
        step={1}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        aria-label={`Tope para ${meta.name.toLowerCase()}`}
        aria-valuetext={`${draft}%`}
        className="h-11 w-full accent-electric"
      />
      <p className={`text-[13.5px] leading-[1.4] ${TEXT_BODY}`}>
        Recomendado: {rec}%. Si tu plan o tus gastos pasan este tope, Zafi te avisa.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDraft(rec)}
          className={`h-[54px] rounded-[14px] border bg-[var(--zafi-card)] px-4 text-[14.5px] font-semibold ${BORDER} ${TEXT_STRONG} ${PRESS_BUTTON}`}
        >
          Usar recomendado
        </button>
        <button type="button" disabled={saving} onClick={() => onSave(draft)} className={`${PRIMARY_BUTTON} flex-1`}>
          {saving ? 'Guardando…' : 'Guardar tope'}
        </button>
      </div>
    </div>
  );
}
