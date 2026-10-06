// Piezas de las secciones de Plan (Metas, Deudas) y de Familia: hero navy,
// notas de color y barra de progreso. Se apoyan en Pantalla.tsx.

import { HERO, HERO_MUTED, HERO_STYLE } from '@/components/layout/Pantalla';
import { CARD } from '@/components/resumen/ctf-ui';
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';

/** Hero navy: etiqueta, monto Outfit 46, texto y barra o chip opcionales. */
export function PlanHero({ label, amount, sub, pct, bar = '#22C55E', chip }: {
  label: string;
  amount: string;
  sub?: React.ReactNode;
  /** 0–1: dibuja la barra del hero. */
  pct?: number;
  bar?: string;
  /** Texto y color del punto del chip de la derecha. */
  chip?: { text: string; dot: string };
}) {
  return (
    <section aria-label={label} className={`mt-3.5 flex flex-col gap-1.5 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[15px] ${HERO_MUTED}`}>{label}</span>
        {chip && (
          <span className="flex flex-none items-center gap-1.5 rounded-full bg-white/[0.08] px-[11px] py-[5px] text-[13px] font-semibold">
            <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ background: chip.dot }} />
            {chip.text}
          </span>
        )}
      </div>
      <p className="font-outfit text-[46px] font-extrabold leading-none tracking-[-0.02em]">{amount}</p>
      {sub && <p className="text-sm text-[#9FB3CB] [text-wrap:pretty]">{sub}</p>}
      {pct !== undefined && (
        <div
          className="mt-2.5 h-2 overflow-hidden rounded-[5px] bg-[#2A4A6E]"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(1, pct) * 100)}
        >
          <div className="h-full rounded-[5px] transition-[width] duration-[600ms]" style={{ width: `${Math.min(100, pct * 100)}%`, background: bar }} />
        </div>
      )}
    </section>
  );
}

/** Barra de 6px sobre el divisor; sin degradado. */
export function ProgressBar({ ratio, color = '#2563EB', className = '' }: { ratio: number; color?: string; className?: string }) {
  return (
    <span aria-hidden className={`block h-1.5 overflow-hidden rounded-full bg-[var(--zafi-border-light)] ${className}`}>
      <span
        className="block h-full rounded-full transition-[width] duration-[600ms]"
        style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%`, background: color }}
      />
    </span>
  );
}

const NOTE_TONES = {
  info: 'bg-electric-ghost text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft',
  warn: 'bg-warning-light text-warning-text dark:bg-warning/15 dark:text-warning',
  ok: 'bg-success-light text-success-text dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]',
} as const;

/** Nota de color (radio 16). */
export function Note({ tone = 'info', className = 'mt-3', children }: {
  tone?: keyof typeof NOTE_TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="note" className={`rounded-2xl px-4 py-3.5 text-sm leading-[1.45] [text-wrap:pretty] ${NOTE_TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}

/** Monto a la derecha de una fila (Outfit 16/700). */
export function RowAmount({ children, className = TEXT_STRONG }: { children: React.ReactNode; className?: string }) {
  return <span className={`flex-none font-outfit text-base font-bold ${className}`}>{children}</span>;
}

/** Dos celdas lado a lado: "Planeaste / Llevas", "Solo mínimos / Con extra". */
export function TwoCells({ cells }: { cells: { label: string; value: React.ReactNode; valueClass?: string }[] }) {
  return (
    <div className={`grid grid-cols-2 overflow-hidden ${CARD} !rounded-[14px]`}>
      {cells.map((c, i) => (
        <div key={c.label} className={`flex min-w-0 flex-col px-3.5 py-3 ${i === 0 ? 'border-r border-[var(--zafi-border-light)]' : ''}`}>
          <span className={`text-[13px] ${TEXT_MUTED}`}>{c.label}</span>
          <span className={`font-outfit text-[19px] font-bold leading-tight ${c.valueClass ?? TEXT_STRONG}`}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}
