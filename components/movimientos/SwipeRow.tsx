'use client';

import { useRef, useState } from 'react';
import type { SearchTransaction } from '@/types';
import { getEmoji } from '@/lib/categories-ui';
import { CARD_BG, TEXT_MUTED, TEXT_STRONG, TILE_BG } from './ui';

const OPEN_X = -150;
const SETTLE = 'transform .22s cubic-bezier(0.32,0.72,0,1)';

export interface SwipeRowData {
  id: string;
  emoji: string;
  name: string;
  /** Solo el nombre de la categoría (y la moneda original si hay). */
  sub: string;
  amountLabel: string;
  isIncome: boolean;
}

/** Datos de fila a partir de un movimiento: emoji, nombre, categoría y monto. */
export function txRowData(tx: SearchTransaction, fmt: (n: number) => string): SwipeRowData {
  const isIncome = tx.type === 'income';
  const symbol = tx.original_currency === 'USD' ? '$' : tx.original_currency === 'EUR' ? '€' : `${tx.original_currency} `;
  const forex = tx.original_currency
    ? ` · ${symbol}${Number(tx.original_amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '';
  return {
    id: tx.id,
    emoji: getEmoji({ name: tx.category_name, bucket: tx.category_bucket, icon: tx.category_icon }),
    name: tx.description || tx.category_name || 'Sin nombre',
    sub: (tx.category_name || 'Sin categoría') + (tx.source === 'statement' ? ' · del banco' : '') + forex,
    amountLabel: `${isIncome ? '+' : ''}${fmt(Number(tx.amount))}`,
    isIncome,
  };
}

/** Contenido visible de una fila: tile con emoji, nombre, categoría y monto. */
function RowContent({ row, amountClassName = '' }: { row: SwipeRowData; amountClassName?: string }) {
  return (
    <>
      <span aria-hidden className={`flex-none w-10 h-10 rounded-xl flex items-center justify-center text-xl ${TILE_BG}`}>
        {row.emoji}
      </span>
      <span className="flex-1 min-w-0 flex flex-col text-left">
        <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{row.name}</span>
        <span className={`truncate text-[13px] ${TEXT_MUTED}`}>{row.sub}</span>
      </span>
      <span className={`flex-none font-outfit font-bold text-base ${row.isIncome ? 'text-success-dark' : TEXT_STRONG} ${amountClassName}`}>
        {row.amountLabel}
      </span>
    </>
  );
}

/** Fila sin swipe (por ejemplo "Lo último" en Inicio): un toque abre el detalle. */
export function TxRow({ row, flash, onSelect }: { row: SwipeRowData; flash?: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      data-tx-row={row.id}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 h-16 px-3.5 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-electric-pale ${CARD_BG} ${flash ? 'zafi-row-flash' : ''}`}
    >
      <RowContent row={row} />
    </button>
  );
}

interface SwipeRowProps {
  row: SwipeRowData;
  isOpen: boolean;
  /** Hay alguna fila abierta en la lista (un toque solo la cierra). */
  anyOpen: boolean;
  flash?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
  onChange: () => void;
  onDelete: () => void;
  /** Se llama cada vez que el usuario abre una fila deslizando. */
  onSwiped?: () => void;
}

/**
 * Fila de movimiento. En táctil se desliza a la izquierda para mostrar
 * Cambiar y Borrar; en escritorio esas acciones aparecen con hover.
 */
export function SwipeRow({ row, isOpen, anyOpen, flash, onOpenChange, onSelect, onChange, onDelete, onSwiped }: SwipeRowProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const [dragX, setDragX] = useState<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    dragged.current = false;
    // Con mouse no hay swipe: en escritorio las acciones salen con hover.
    start.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!dragged.current) {
      if (Math.abs(dx) < 6) return;
      // Gesto vertical: es scroll, se suelta la fila.
      if (Math.abs(dy) > Math.abs(dx)) { start.current = null; return; }
      dragged.current = true;
    }
    const base = isOpen ? OPEN_X : 0;
    setDragX(Math.min(0, Math.max(OPEN_X, base + dx)));
  }

  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    setDragX(null);
    if (!s || !dragged.current) return;
    const dx = e.clientX - s.x;
    if (dx < -30) {
      if (!isOpen) onSwiped?.();
      onOpenChange(true);
    } else if (dx > 30) {
      onOpenChange(false);
    }
  }

  function onPointerCancel() {
    start.current = null;
    setDragX(null);
  }

  function onClick() {
    if (dragged.current) { dragged.current = false; return; }
    if (anyOpen) onOpenChange(false);
    else onSelect();
  }

  const x = dragX ?? (isOpen ? OPEN_X : 0);
  const hiddenActions = isOpen ? {} : { tabIndex: -1, 'aria-hidden': true as const };

  return (
    <div className="group relative h-16 rounded-[14px] overflow-hidden">
      {/* Acciones detrás de la fila (táctil) */}
      <div className="absolute inset-y-0 right-0 flex w-[150px] lg:hidden">
        <button
          type="button"
          {...hiddenActions}
          onClick={onChange}
          className="w-[75px] h-full bg-electric text-white text-[13.5px] font-semibold"
        >
          Cambiar
        </button>
        <button
          type="button"
          {...hiddenActions}
          onClick={onDelete}
          aria-label={`Borrar ${row.name}`}
          className="w-[75px] h-full bg-danger text-white text-[13.5px] font-semibold"
        >
          Borrar
        </button>
      </div>

      {/* Capa de la fila */}
      <div
        role="button"
        tabIndex={0}
        data-tx-row={row.id}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
        className={`absolute inset-0 flex items-center gap-3 px-3.5 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-electric-pale ${CARD_BG} ${flash ? 'zafi-row-flash' : ''}`}
        style={{ transform: `translateX(${x}px)`, transition: dragX === null ? SETTLE : 'none', touchAction: 'pan-y' }}
      >
        <RowContent row={row} amountClassName="lg:group-hover:opacity-0 lg:group-focus-within:opacity-0" />
      </div>

      {/* Acciones con hover (escritorio) */}
      <div className="absolute inset-y-0 right-2 hidden items-center gap-1.5 lg:group-hover:flex lg:group-focus-within:flex">
        <button
          type="button"
          onClick={onChange}
          className="h-9 px-3 rounded-full bg-electric text-white text-[13px] font-semibold"
        >
          Cambiar
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Borrar ${row.name}`}
          className="h-9 px-3 rounded-full bg-danger text-white text-[13px] font-semibold"
        >
          Borrar
        </button>
      </div>
    </div>
  );
}
