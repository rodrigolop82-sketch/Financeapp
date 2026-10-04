'use client';

// Hoja de confirmación de un pago con Apple Pay (fase 13.3). Se abre en
// Movimientos con /transacciones?applepay={id}: es la URL del push
// "Registramos {Q} en {comercio} con Apple Pay. Toca para elegir categoría."
// Reusa las APIs de reclasificación: /api/transactions/reclassify para la
// categoría y /api/transactions/confirm-reclassify (ids: [], remember) para
// "Recordar para {comercio}" (merchant_category_overrides).

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { localDaysAgo, localToday } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { getEmoji } from '@/lib/categories-ui';
import { cardLabel } from '@/lib/apple-pay';
import { dayLabel, topCategories } from '@/lib/movimientos';
import { getMerchantKey } from '@/lib/transactions/merchant-key';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { CategoryGrid, CATEGORY_TILE_CLASS, CHIP_SELECTED_SCALE } from '@/components/transactions/CategoryGrid';
import { SuccessCheck } from '@/components/motion/SuccessCheck';
import { SubItemPicker, type SubItemOption } from './SubItemPicker';
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from './ui';
import type { BudgetCategory } from '@/types';

interface ApplePayTx {
  id: string;
  amount: number | string;
  description: string | null;
  date: string;
  category_id: string | null;
  budget_sub_item_id?: string | null;
  payment_card?: string | null;
  source: string;
}

interface ApplePaySheetProps {
  txId: string | null;
  householdId: string;
  categories: BudgetCategory[];
  onClose: () => void;
  /** Guardado: la lista recarga y resalta el movimiento. */
  onSaved: (tx: { id: string; date: string }) => void;
  onError: (text: string) => void;
}

const SUCCESS_HOLD_MS = 1700;

export function ApplePaySheet({ txId, householdId, categories, onClose, onSaved, onError }: ApplePaySheetProps) {
  const [tx, setTx] = useState<ApplePayTx | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [subItems, setSubItems] = useState<SubItemOption[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subItemId, setSubItemId] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!txId) return;
    let cancelled = false;
    setTx(null);
    setDone(false);
    setShowAll(false);
    setRemember(true);
    (async () => {
      const supabase = createClient();
      const [{ data, error }, { data: recent }, { data: subs }] = await Promise.all([
        supabase.from('transactions').select('*').eq('id', txId).maybeSingle(),
        supabase.from('transactions').select('category_id').eq('household_id', householdId).gte('date', localDaysAgo(90)).limit(1000),
        supabase.from('budget_sub_items').select('id, category_id, name').eq('household_id', householdId).order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;
      if (error || !data) {
        onError('No encontramos ese pago. Puede que ya lo hayas borrado.');
        onClose();
        return;
      }
      const counts: Record<string, number> = {};
      for (const r of (recent ?? []) as { category_id: string | null }[]) {
        if (r.category_id) counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
      }
      const t = data as ApplePayTx;
      setUsage(counts);
      setSubItems((subs ?? []) as SubItemOption[]);
      setTx(t);
      setCategoryId(t.category_id);
      setSubItemId(t.budget_sub_item_id ?? null);
    })();
    return () => { cancelled = true; };
  }, [txId, householdId, onClose, onError]);

  const pool = useMemo(
    () => categories.filter((c) => c.bucket !== 'income' && !c.archived_at),
    [categories],
  );
  const suggested = useMemo(() => {
    const first = pool.find((c) => c.id === tx?.category_id);
    const top = topCategories(pool.filter((c) => c.id !== first?.id), usage, first ? 3 : 4);
    return first ? [first, ...top] : top;
  }, [pool, tx, usage]);

  const merchant = tx?.description || 'Apple Pay';
  const amount = formatMoney(Number(tx?.amount ?? 0), { showDecimals: true });
  const chosen = pool.find((c) => c.id === categoryId) ?? null;
  const parts = chosen ? subItems.filter((p) => p.category_id === chosen.id) : [];
  const missingPart = parts.length > 0 && !parts.some((p) => p.id === subItemId);
  const canRemember = !!getMerchantKey(merchant);

  function pick(id: string) {
    setCategoryId(id);
    if (!subItems.some((p) => p.category_id === id && p.id === subItemId)) setSubItemId(null);
  }

  async function save() {
    if (!tx || !chosen || saving) return;
    if (missingPart) { onError('Elige de qué parte.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/transactions/reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: tx.id, categoryId: chosen.id, subItemId: parts.length > 0 ? subItemId : undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'No pudimos guardar el gasto. Intenta de nuevo.');
      }
      if (remember && canRemember) {
        const r2 = await fetch('/api/transactions/confirm-reclassify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceTransactionId: tx.id, categoryId: chosen.id, ids: [], remember: true }),
        });
        if (!r2.ok) onError(`Guardamos el gasto, pero no pudimos recordar ${merchant}.`);
      }
    } catch (e) {
      setSaving(false);
      onError(e instanceof Error ? e.message : 'Error de conexión. Intenta de nuevo.');
      return;
    }
    setSaving(false);
    setDone(true);
    navigator.vibrate?.(15);
    const saved = { id: tx.id, date: tx.date };
    setTimeout(() => { onClose(); onSaved(saved); }, SUCCESS_HOLD_MS);
  }

  const open = !!txId;

  return (
    <BottomSheet themed open={open} onClose={() => { if (!done) onClose(); }} label="Pago con Apple Pay">
      <div className="flex min-h-[400px] flex-col gap-3.5 overflow-y-auto px-5 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {!tx ? (
          <div className="flex flex-1 items-center justify-center" aria-busy="true">
            <span className={`text-sm ${TEXT_MUTED}`}>Cargando…</span>
          </div>
        ) : done ? (
          <div role="status" className="flex flex-1 flex-col items-center justify-center py-6">
            <SuccessCheck
              size={90}
              title={amount}
              titleClassName={`font-outfit text-[34px] font-extrabold leading-tight ${TEXT_STRONG}`}
              subtitle={`${chosen ? `${getEmoji(chosen)} ${chosen.name}` : ''} · guardado${remember && canRemember ? ` · ${merchant} recordado` : ''}`}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-0.5">
              <span className="rounded-full bg-ink-900 px-2.5 py-1 text-[13px] font-bold text-white dark:bg-white dark:text-ink-900">
                {cardLabel(tx.payment_card)}
              </span>
              <h2 tabIndex={-1} className={`font-outfit text-[46px] font-extrabold leading-[1.15] outline-none ${TEXT_STRONG}`}>{amount}</h2>
              <span className={`text-[15px] ${TEXT_MUTED}`}>{merchant} · {dayLabel(tx.date, localToday()).toLowerCase()}</span>
            </div>

            <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Sugerimos</span>
            {showAll ? (
              <CategoryGrid themed name="applepay-category" categories={pool} selectedId={categoryId ?? ''} onSelect={pick} />
            ) : (
              <div role="radiogroup" aria-label="Categoría" className="grid grid-cols-4 gap-2">
                {suggested.map((c) => {
                  const on = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pick(c.id)}
                      className={`${CATEGORY_TILE_CLASS} ${on
                        ? `border-electric bg-electric-ghost dark:bg-electric/20 ${CHIP_SELECTED_SCALE}`
                        : 'border-[var(--zafi-border-light)] bg-[var(--zafi-card)]'}`}
                    >
                      <span className="text-[24px] leading-none" aria-hidden>{getEmoji(c)}</span>
                      <span className={`w-full truncate text-[12.5px] font-semibold ${TEXT_STRONG}`}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!showAll && pool.length > suggested.length && (
              <button type="button" onClick={() => setShowAll(true)} className="-mt-1 self-start text-sm font-semibold text-electric-dark dark:text-electric-soft">
                Ver todas las categorías
              </button>
            )}

            {parts.length > 0 && (
              <SubItemPicker options={parts} selectedId={subItemId} onSelect={setSubItemId} />
            )}

            {canRemember && (
              <button
                type="button"
                role="checkbox"
                aria-checked={remember}
                onClick={() => setRemember((r) => !r)}
                className="flex min-h-[44px] items-center gap-2.5 text-left"
              >
                <span
                  aria-hidden
                  className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] text-[13px] font-extrabold text-white transition-colors ${
                    remember ? 'border-electric bg-electric' : 'border-ink-400 bg-transparent'
                  }`}
                >
                  {remember ? '✓' : ''}
                </span>
                <span className={`text-sm ${TEXT_STRONG}`}>Recordar para {merchant} la próxima vez</span>
              </button>
            )}

            <button type="button" onClick={save} disabled={!chosen || saving} className={`${PRIMARY_BUTTON} rounded-full font-bold`}>
              {saving ? 'Guardando…' : 'Guardar gasto'}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
