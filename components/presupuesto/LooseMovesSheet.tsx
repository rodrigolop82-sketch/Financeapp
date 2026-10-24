'use client';

import { BORDER, SHEET_TITLE, TEXT_BODY, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui';

export interface LooseMove {
  id: string;
  date: string;
  description: string | null;
  amount: number;
}

interface LooseMovesSheetProps {
  emoji: string;
  categoryName: string;
  moves: LooseMove[];
  parts: { id: string; name: string }[];
  fmt: (n: number) => string;
  /** Movimiento que se está guardando. */
  savingId: string | null;
  onAssign: (txId: string, partId: string) => void;
}

function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/** Movimientos de una categoría que no tienen parte: se asigna una a cada uno. */
export function LooseMovesSheet({ emoji, categoryName, moves, parts, fmt, savingId, onAssign }: LooseMovesSheetProps) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-1.5 [&>*]:shrink-0">
      <div className="flex items-center gap-3">
        <span aria-hidden className={`flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[15px] text-[26px] ${TILE_BG}`}>
          {emoji}
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 tabIndex={-1} className={`${SHEET_TITLE} truncate`}>{categoryName}</h2>
          <span className={`text-sm ${TEXT_MUTED}`}>Movimientos sin parte</span>
        </div>
      </div>

      <span className={`text-[13.5px] leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>
        Cuentan en la categoría pero en ninguna parte. Elige a cuál va cada uno.
      </span>

      {moves.length === 0 ? (
        <span className={`py-6 text-center text-[15px] font-semibold ${TEXT_BODY}`}>Todo tiene parte ✓</span>
      ) : (
        moves.map((m) => (
          <div key={m.id} className={`flex flex-col gap-2.5 rounded-[14px] border p-3.5 ${BORDER}`}>
            <div className="flex items-baseline gap-2">
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={`truncate text-[14.5px] font-semibold ${TEXT_STRONG}`}>{m.description || 'Sin descripción'}</span>
                <span className={`text-[12.5px] ${TEXT_MUTED}`}>{shortDate(m.date)}</span>
              </span>
              <span className={`flex-none font-outfit text-[15px] font-bold ${TEXT_STRONG}`}>{fmt(m.amount)}</span>
            </div>
            {savingId === m.id ? (
              <span className={`flex h-9 items-center text-[13.5px] font-semibold ${TEXT_MUTED}`}>Guardando…</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {parts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={savingId !== null}
                    onClick={() => onAssign(m.id, p.id)}
                    className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-semibold disabled:opacity-60 ${BORDER} bg-[var(--zafi-card)] ${TEXT_BODY}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
