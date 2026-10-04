'use client';

// Piezas de la pantalla Mi cuenta: grupo, fila, switch, pill, hoja de
// opciones y toast corto. Colores con tokens y variables --zafi-* para que
// el modo oscuro tenga buen contraste.

import { useEffect, type ReactNode } from 'react';
import { BottomSheet } from '@/components/transactions/BottomSheet';

const TEXT_STRONG = 'text-ink-900 dark:text-ink-100';
const TEXT_SECONDARY = 'text-[var(--zafi-text-secondary)]';

export function AccountGroup({ title, children, padded = false }: { title: string; children: ReactNode; padded?: boolean }) {
  return (
    <section className="flex flex-col">
      <h2 className={`mx-1 mb-1.5 mt-[22px] text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_SECONDARY}`}>
        {title}
      </h2>
      <div
        className={`rounded-2xl border border-[var(--zafi-border)] bg-[var(--zafi-card)] ${
          padded ? 'flex flex-col gap-3 p-3.5' : 'px-3.5'
        }`}
      >
        {children}
      </div>
    </section>
  );
}

interface AccountRowProps {
  emoji: string;
  title: string;
  hint?: ReactNode;
  /** Control a la derecha (switch, pill, botón). Sin control y con onClick/href, pinta "›". */
  right?: ReactNode;
  /** Contenido debajo de la fila (segmentado, "Después de…"). */
  below?: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Tile con el azul suave del acento (p. ej. "Envíanos tu idea"). */
  accentTile?: boolean;
  last?: boolean;
  busy?: boolean;
}

export function AccountRow({ emoji, title, hint, right, below, onClick, href, accentTile, last, busy }: AccountRowProps) {
  const body = (
    <>
      <span
        aria-hidden
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-lg ${
          accentTile ? 'bg-electric-ghost dark:bg-electric/20' : 'bg-[var(--zafi-card-alt)]'
        }`}
      >
        {emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{title}</span>
        {hint && <span className={`text-[13px] ${TEXT_SECONDARY}`}>{hint}</span>}
      </span>
      {right ?? ((onClick || href) && (
        <span aria-hidden className={`font-bold ${TEXT_SECONDARY}`}>{busy ? '…' : '›'}</span>
      ))}
    </>
  );

  const rowClass = 'flex min-h-[60px] w-full items-center gap-3 py-3';
  const wrapClass = `flex flex-col gap-2 ${last ? '' : 'border-b border-[var(--zafi-border-light)]'}`;

  let row: ReactNode;
  if (href) {
    const external = href.startsWith('mailto:') || href.startsWith('http');
    row = (
      <a href={href} className={`${rowClass} no-underline transition-opacity active:opacity-70`} {...(external ? { rel: 'noopener' } : {})}>
        {body}
      </a>
    );
  } else if (onClick) {
    row = (
      <button type="button" onClick={onClick} disabled={busy} className={`${rowClass} transition-opacity active:opacity-70 disabled:opacity-60`}>
        {body}
      </button>
    );
  } else {
    row = <div className={rowClass}>{body}</div>;
  }

  return (
    <div className={wrapClass}>
      {row}
      {below && <div className="pb-3">{below}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-[30px] w-[50px] flex-none rounded-full p-[3px] transition-colors duration-200 ${
        checked ? 'bg-electric dark:bg-electric-light' : 'bg-ink-200 dark:bg-ink-700'
      }`}
    >
      <span
        className="h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
        style={{
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform .25s cubic-bezier(.3,1.4,.5,1)',
        }}
      />
    </button>
  );
}

/** Pill con "▾" que abre una hoja de opciones (reemplaza a los <select>). */
export function PickerPill({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="dialog"
      className={`flex h-8 flex-none items-center gap-1.5 rounded-full border border-[var(--zafi-border)] bg-[var(--zafi-card-alt)] px-3 text-[13.5px] font-semibold transition-transform active:scale-95 ${TEXT_STRONG}`}
    >
      {children} <span aria-hidden className={TEXT_SECONDARY}>▾</span>
    </button>
  );
}

export interface PickerOption<T> {
  value: T;
  label: string;
  /** Texto a la izquierda en Outfit (p. ej. el símbolo de la moneda). */
  lead?: string;
}

export function OptionsSheet<T extends string | number>({
  open,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  options: PickerOption<T>[];
  value: T;
  onPick: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} label={title} themed>
      <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-[calc(28px+env(safe-area-inset-bottom))] pt-1.5">
        <h2 tabIndex={-1} className={`px-1 py-1.5 text-[17px] font-bold outline-none ${TEXT_STRONG}`}>{title}</h2>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => onPick(o.value)}
              aria-pressed={selected}
              className={`flex h-12 items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                selected ? 'bg-electric-ghost dark:bg-electric/20' : 'hover:bg-[var(--zafi-hover)]'
              }`}
            >
              {o.lead !== undefined && (
                <span className={`w-[34px] font-outfit text-base font-bold ${TEXT_STRONG}`}>{o.lead}</span>
              )}
              <span className={`flex-1 text-[15px] font-semibold ${TEXT_STRONG}`}>{o.label}</span>
              <span aria-hidden className="font-extrabold text-electric dark:text-electric-pale">{selected ? '✓' : ''}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

/** Toast corto de confirmación ("✓ Moneda: Quetzal"). */
export function SavedToast({ message, onDone }: { message: { text: string; key: number } | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-8"
    >
      <div
        key={message.key}
        className="flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(13,31,54,0.3)] animate-in slide-in-from-bottom-2 fade-in duration-300 dark:bg-ink-700"
      >
        <span aria-hidden className="text-success">✓</span>
        {message.text}
      </div>
    </div>
  );
}
