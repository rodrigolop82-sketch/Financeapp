'use client';

import { DIVIDER, PRESS_BUTTON, TEXT_BODY, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui';
import { capListText, type CapKey, type CapOk, type Recommendation } from '@/lib/recomendaciones';
import { CARD, GREEN_TEXT, GROUP_LABEL, NAVY_BG, SECTION_TITLE } from './ctf-ui';

interface OportunidadesProps {
  over: Recommendation[];
  ok: CapOk[];
  potential: number;
  selected: Set<CapKey>;
  /** Topes que el plan vigente también pasa. */
  planAlert: CapKey[];
  planMonthName: string;
  /** No hay ingresos recibidos: no se puede comparar contra topes. */
  noIncome: boolean;
  onToggle: (key: CapKey) => void;
  onEditCap: (key: CapKey) => void;
  fmt: (n: number) => string;
}

const pctText = (p: number) => `${Math.round(p)}%`;

function RecCard({ r, on, onToggle, onEdit, fmt }: {
  r: Recommendation; on: boolean; onToggle: () => void; onEdit: () => void; fmt: (n: number) => string;
}) {
  const fixed = r.kind === 'fijo';
  // Escala de la barra: hasta 45 % de los ingresos (o más si hace falta).
  const scale = Math.max(45, r.pct, r.cap + 5);
  return (
    <article aria-label={r.name} className={`flex flex-col gap-2.5 px-4 py-3.5 ${CARD}`}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-xl ${TILE_BG}`}>{r.emoji}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>{r.name}</span>
          <span className={`text-[13px] ${TEXT_MUTED}`}>{pctText(r.pct)} de tus ingresos</span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`font-outfit text-[17px] font-bold ${GREEN_TEXT}`}>{fmt(r.saving)}</span>
          <span className={`text-xs ${TEXT_MUTED}`}>al mes</span>
        </div>
      </div>
      <div
        className="relative h-2 rounded-[5px] bg-[var(--zafi-border-light)]"
        role="img"
        aria-label={`Gastaste ${pctText(r.pct)} de tus ingresos; tu tope es ${r.cap}%`}
      >
        <div
          className={`h-full rounded-[5px] transition-[width] duration-[350ms] ease-out ${fixed ? NAVY_BG : 'bg-warning'}`}
          style={{ width: `${Math.min(100, (r.pct / scale) * 100)}%` }}
        />
        <div
          className={`absolute -top-1 h-4 w-0.5 rounded-[1px] transition-[left] duration-[350ms] ease-out ${fixed ? 'bg-warning' : 'bg-ink-900 dark:bg-ink-100'}`}
          style={{ left: `${Math.min(100, (r.cap / scale) * 100)}%` }}
        />
      </div>
      <p className={`text-sm leading-[1.4] [text-wrap:pretty] ${TEXT_BODY}`}>{r.advice}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={on}
          onClick={onToggle}
          className={`flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] text-[13.5px] font-semibold transition-colors duration-200 ${PRESS_BUTTON} ${
            on
              ? 'border-success-dark bg-success-light text-success-dark dark:border-[var(--zafi-success-border)] dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]'
              : `border-ink-100 bg-[var(--zafi-card)] dark:border-white/10 ${TEXT_STRONG}`
          }`}
        >
          {on ? '✓ En mi proyección' : '+ Sumar a proyección'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Cambiar tope de ${r.name} (${r.cap}%)`}
          className={`h-[38px] rounded-full border border-ink-100 bg-[var(--zafi-card)] px-3.5 text-[13.5px] font-semibold dark:border-white/10 ${PRESS_BUTTON} ${TEXT_STRONG}`}
        >
          Tope {r.cap}% ✎
        </button>
      </div>
    </article>
  );
}

/** "Tus oportunidades para ahorrar": variables, fijos y lo que está dentro de su tope. */
export function Oportunidades({ over, ok, potential, selected, planAlert, planMonthName, noIncome, onToggle, onEditCap, fmt }: OportunidadesProps) {
  const vars = over.filter((r) => r.kind === 'variable');
  const fixed = over.filter((r) => r.kind === 'fijo');
  const card = (r: Recommendation) => (
    <RecCard key={r.key} r={r} on={selected.has(r.key)} onToggle={() => onToggle(r.key)} onEdit={() => onEditCap(r.key)} fmt={fmt} />
  );

  return (
    <section aria-label="Tus oportunidades para ahorrar" className="mt-[22px] flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5 px-1">
        <h2 className={SECTION_TITLE}>Tus oportunidades para ahorrar</h2>
        {noIncome ? (
          <span className={`text-sm ${TEXT_MUTED}`}>Registra tus ingresos recibidos para compararlos con tus topes.</span>
        ) : over.length > 0 ? (
          <span className={`text-sm ${TEXT_MUTED}`}>
            Podrías liberar hasta <b className={`font-outfit ${GREEN_TEXT}`}>{fmt(potential)}</b> al mes
          </span>
        ) : (
          <span className={`text-sm ${TEXT_MUTED}`}>Todo quedó dentro de tus topes. ¡Bien hecho!</span>
        )}
      </div>

      {planAlert.length > 0 && (
        <div role="note" className="flex items-start gap-2.5 rounded-[14px] bg-warning-light px-3.5 py-3 dark:bg-warning/15">
          <span aria-hidden className="text-lg leading-none">⚠️</span>
          <span className="text-[13.5px] leading-[1.4] text-warning-text [text-wrap:pretty] dark:text-warning">
            <b>Tu plan de {planMonthName}</b> también pasa tus topes en {capListText(planAlert)}. Te avisamos ahí al guardarlo.
          </span>
        </div>
      )}

      {vars.length > 0 && (
        <>
          <h3 className={`px-1 pt-1.5 ${GROUP_LABEL} ${TEXT_MUTED}`}>Fáciles de ajustar · gastos variables</h3>
          {vars.map(card)}
        </>
      )}
      {fixed.length > 0 && (
        <>
          <h3 className={`px-1 pt-2.5 ${GROUP_LABEL} ${TEXT_MUTED}`}>Requieren un cambio mayor · gastos fijos</h3>
          {fixed.map(card)}
        </>
      )}

      {ok.length > 0 && (
        <div className={`px-4 py-1 ${CARD}`} aria-label="Dentro de su tope">
          <h3 className="sr-only">Dentro de su tope</h3>
          {ok.map((o, i) => (
            <div key={o.key} className={`flex items-center gap-2.5 py-[11px] ${i > 0 ? `border-t ${DIVIDER}` : ''}`}>
              <span aria-hidden className="text-lg">{o.emoji}</span>
              <span className={`flex-1 text-[14.5px] font-semibold ${TEXT_STRONG}`}>{o.name}</span>
              <span className={`text-[13px] font-semibold ${GREEN_TEXT}`}>{pctText(o.pct)} · tope {o.cap}%</span>
              <button
                type="button"
                onClick={() => onEditCap(o.key)}
                aria-label={`Cambiar tope de ${o.name} (${o.cap}%)`}
                className="-mr-2 flex h-11 w-11 items-center justify-center text-[15px] font-semibold text-electric"
              >
                ✎
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
