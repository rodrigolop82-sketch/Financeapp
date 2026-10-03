'use client';

import { useEffect, useRef, useState } from 'react';
import type { SearchTransaction } from '@/types';
import { getEmoji, paymentLabel } from '@/lib/categories-ui';
import { dayLabel, longDate } from '@/lib/movimientos';
import { BORDER, DIVIDER, TEXT_BODY, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG, TILE_BG } from './ui';

interface TxDetailSheetProps {
  tx: SearchTransaction;
  today: string;
  fmt: (n: number) => string;
  onOpenCategory: () => void;
  onOpenDate: () => void;
  onOpenPayment: () => void;
  /** Guarda un cambio de texto (nombre o nota). */
  onSaveText: (id: string, patch: { description?: string | null; note?: string | null }) => void;
  onDelete: () => void;
  onDone: () => void;
  /** Nombre de la parte del Plan del mes, si tiene. */
  subItemName?: string | null;
}

const NOTE_DEBOUNCE_MS = 600;

/** Contenido de hoja: detalle de un movimiento; cada dato se toca para cambiarlo. */
export function TxDetailSheet({ tx, today, fmt, onOpenCategory, onOpenDate, onOpenPayment, onSaveText, onDelete, onDone, subItemName }: TxDetailSheetProps) {
  const isIncome = tx.type === 'income';
  const [name, setName] = useState(tx.description ?? '');
  const [note, setNote] = useState(tx.note ?? '');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNote = useRef<string | null>(null);

  // Si el movimiento cambia desde afuera (otro movimiento, o se revirtió), se resincroniza.
  useEffect(() => { setName(tx.description ?? ''); }, [tx.id, tx.description]);
  useEffect(() => { if (pendingNote.current === null) setNote(tx.note ?? ''); }, [tx.id, tx.note]);

  // Al cerrar el detalle con una nota a medio escribir, se guarda igual.
  const saveRef = useRef(onSaveText);
  saveRef.current = onSaveText;
  useEffect(() => {
    const id = tx.id;
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
      const v = pendingNote.current;
      pendingNote.current = null;
      if (v !== null) saveRef.current(id, { note: v.trim() || null });
    };
  }, [tx.id]);

  function changeNote(value: string) {
    setNote(value);
    pendingNote.current = value;
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      const v = pendingNote.current;
      pendingNote.current = null;
      if (v !== null && v !== (tx.note ?? '')) onSaveText(tx.id, { note: v.trim() || null });
    }, NOTE_DEBOUNCE_MS);
  }

  function commitName() {
    const v = name.trim();
    if (v !== (tx.description ?? '').trim()) onSaveText(tx.id, { description: v || null });
  }

  const cat = { name: tx.category_name, bucket: tx.category_bucket, icon: tx.category_icon };
  const rowClass = `flex items-center gap-3 w-full px-4 h-14 border-b text-left ${DIVIDER}`;
  const label = `w-[88px] flex-none text-sm ${TEXT_MUTED}`;
  const value = `flex-1 min-w-0 truncate font-semibold text-[15px] ${TEXT_STRONG}`;
  const chevron = <span aria-hidden className={`text-lg ${TEXT_FAINT}`}>›</span>;

  return (
    <div className="flex flex-col gap-[18px] px-5 pt-1.5 pb-[calc(30px+env(safe-area-inset-bottom))] overflow-y-auto">
      <div className="flex flex-col items-center gap-1.5 pt-1">
        <span aria-hidden className={`w-[62px] h-[62px] rounded-[18px] flex items-center justify-center text-[30px] ${TILE_BG}`}>
          {getEmoji(cat)}
        </span>
        <h2 className="sr-only" tabIndex={-1}>Detalle del movimiento</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder={tx.category_name || 'Sin nombre'}
          aria-label="Nombre del movimiento"
          maxLength={80}
          className={`mt-1 w-full text-center bg-transparent outline-none rounded-lg font-semibold text-base focus:bg-[var(--zafi-card-alt)] ${TEXT_BODY}`}
        />
        <p className={`font-outfit font-extrabold text-[44px] leading-none tracking-[-0.02em] ${isIncome ? 'text-success-dark' : TEXT_STRONG}`}>
          {isIncome ? '+' : ''}{fmt(Number(tx.amount))}
        </p>
        <p className={`text-sm ${TEXT_MUTED}`}>{longDate(tx.date, today)}</p>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${BORDER}`}>
        <button type="button" onClick={onOpenCategory} className={rowClass}>
          <span className={label}>Categoría</span>
          <span className={value}>
            {getEmoji(cat)} {tx.category_name || 'Sin categoría'}{subItemName ? ` · ${subItemName}` : ''}
          </span>
          {chevron}
        </button>
        <button type="button" onClick={onOpenDate} className={rowClass}>
          <span className={label}>Fecha</span>
          <span className={value}>{dayLabel(tx.date, today)}</span>
          {chevron}
        </button>
        <button type="button" onClick={onOpenPayment} className={rowClass}>
          <span className={label}>{isIncome ? 'Lo recibí por' : 'Pagué con'}</span>
          <span className={value}>{paymentLabel(tx.payment_method)}</span>
          {chevron}
        </button>
        <label className="flex items-center gap-3 px-4 h-14">
          <span className={label}>Nota</span>
          <input
            value={note}
            onChange={(e) => changeNote(e.target.value)}
            placeholder="Agregar nota"
            maxLength={200}
            className={`flex-1 min-w-0 bg-transparent outline-none font-semibold text-[15px] placeholder:font-normal placeholder:text-ink-400 ${TEXT_STRONG}`}
          />
        </label>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 h-[52px] rounded-full bg-[var(--zafi-error-bg)] text-[var(--zafi-error-text)] font-semibold text-[15px]"
        >
          Borrar
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-[2] h-[52px] rounded-full bg-electric text-white font-semibold text-[15px] hover:bg-electric-dark"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
