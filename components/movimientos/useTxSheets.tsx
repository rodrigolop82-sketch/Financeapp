'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createClient } from '@/lib/supabase';
import type { BudgetCategory, SearchTransaction } from '@/types';
import { useReclassifyFlow } from '@/lib/transactions/useReclassifyFlow';
import { useUndoableDelete } from '@/lib/transactions/useUndoableDelete';
import { DELETE_UNDO_MS } from '@/lib/transactions/undo-delete';
import { deriveTransactionType } from '@/lib/transactions/transaction-type';
import { PAYMENT_OPTIONS, type PaymentMethod } from '@/lib/categories-ui';
import { sameMerchantOthers } from '@/lib/movimientos';
import { UndoToast } from '@/components/transactions/UndoToast';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { TxDetailSheet } from './TxDetailSheet';
import { CategorySheet } from './CategorySheet';
import { DateSheet, OptionSheet } from './OptionSheet';
import { StatusToast, type StatusMessage } from './StatusToast';
import type { SubItemOption } from './SubItemPicker';

type SheetView = 'detail' | 'category' | 'date' | 'payment';

interface SheetState {
  view: SheetView;
  txId: string;
  /** Vista a la que vuelven "Escape" o tocar fuera (null cierra la hoja). */
  back: SheetView | null;
}

const SHEET_LABEL: Record<SheetView, string> = {
  detail: 'Detalle del movimiento',
  category: 'Elegir categoría',
  date: 'Elegir fecha',
  payment: 'Forma de pago',
};

const FLASH_MS = 1600;

function byDateDesc(a: SearchTransaction, b: SearchTransaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

interface UseTxSheetsOptions {
  rows: SearchTransaction[];
  setRows: Dispatch<SetStateAction<SearchTransaction[]>>;
  categories: BudgetCategory[];
  fmt: (n: number) => string;
  today: string;
  /** Algo cambió en la base (reclasificación, deshacer o borrado confirmado). */
  onChanged: () => void;
  /** Mientras la hoja carga datos nuevos no se cierra por "movimiento no encontrado". */
  loading?: boolean;
}

/**
 * Detalle de un movimiento y sus sub-hojas (categoría, fecha, forma de
 * pago), con borrado y reclasificación con "Deshacer". Lo usan Movimientos
 * e Inicio; `element` va una vez en la página.
 */
export function useTxSheets({ rows, setRows, categories, fmt, today, onChanged, loading = false }: UseTxSheetsOptions) {
  const supabase = useMemo(() => createClient(), []);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const flow = useReclassifyFlow(categories, onChanged);

  // Partes del Plan del mes de estas categorías (para "¿De qué parte?" y el detalle).
  const [subItems, setSubItems] = useState<SubItemOption[]>([]);
  const catIds = categories.map((c) => c.id).sort().join(',');
  useEffect(() => {
    if (!catIds) return;
    let cancelled = false;
    supabase
      .from('budget_sub_items')
      .select('id, category_id, name')
      .in('category_id', catIds.split(','))
      .order('created_at', { ascending: true })
      .then(({ data }: { data: SubItemOption[] | null }) => { if (!cancelled) setSubItems(data ?? []); });
    return () => { cancelled = true; };
  }, [supabase, catIds]);
  const deletion = useUndoableDelete(setRows, onChanged);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((id: string) => {
    setFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), FLASH_MS);
  }, []);

  const selected = sheet ? rows.find((r) => r.id === sheet.txId) ?? null : null;

  // Si el movimiento abierto desaparece (se borró o cambió de filtro), se cierra la hoja.
  useEffect(() => {
    if (sheet && !loading && !selected) setSheet(null);
  }, [sheet, selected, loading]);

  function closeSheet() {
    setSheet((s) => (s?.back ? { ...s, view: s.back, back: null } : null));
    flow.clearError();
  }

  const openDetail = useCallback((id: string) => setSheet({ view: 'detail', txId: id, back: null }), []);

  const openCategory = useCallback((id: string, fromDetail = false) => {
    flow.clearError();
    setSheet({ view: 'category', txId: id, back: fromDetail ? 'detail' : null });
  }, [flow]);

  function deleteTx(tx: SearchTransaction) {
    const index = rows.findIndex((r) => r.id === tx.id);
    if (index === -1) return;
    setSheet(null);
    if (flow.undoVisible) flow.dismissUndo();
    deletion.remove(tx, index);
  }

  /** Cambio optimista de un campo; si Supabase falla, se revierte. */
  async function updateTx(id: string, patch: Partial<Pick<SearchTransaction, 'date' | 'payment_method' | 'description' | 'note'>>) {
    const prev = rows.find((r) => r.id === id);
    if (!prev) return;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)).sort(byDateDesc));
    const { error } = await supabase.from('transactions').update(patch).eq('id', id);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === id ? prev : r)).sort(byDateDesc));
      setMessage({ text: 'No se pudo guardar el cambio. Intenta de nuevo.', tone: 'error' });
      return;
    }
    flash(id);
    if (patch.date) onChanged();
  }

  async function saveCategory(
    tx: SearchTransaction, categoryId: string, type: 'expense' | 'income', applyToOthers: boolean, subItemId: string | null,
  ) {
    const subChanged = subItemId !== (tx.budget_sub_item_id ?? null);
    if (categoryId === tx.category_id && type === tx.type && !subChanged) {
      setSheet({ view: 'detail', txId: tx.id, back: null });
      return;
    }
    if (flow.undoVisible) flow.dismissUndo();
    // Sin partes en juego no se toca la columna (funciona aunque falte la migración).
    const sub = subItemId !== null || tx.budget_sub_item_id ? subItemId : undefined;
    const ok = await flow.reclassifyDirect(tx, categoryId, type, applyToOthers, sub);
    if (!ok) return;
    const cat = categories.find((c) => c.id === categoryId);
    setRows((rs) => rs.map((r) => (r.id === tx.id ? {
      ...r,
      category_id: categoryId,
      category_name: cat?.name ?? r.category_name,
      category_bucket: (cat?.bucket ?? r.category_bucket) as SearchTransaction['category_bucket'],
      category_icon: cat?.icon ?? null,
      type,
      transaction_type: deriveTransactionType(type, cat?.bucket),
      budget_sub_item_id: subItemId,
    } : r)));
    flash(tx.id);
    setSheet({ view: 'detail', txId: tx.id, back: null });
  }

  const element = (
    <>
      <BottomSheet themed open={!!sheet && !!selected} onClose={closeSheet} label={sheet ? SHEET_LABEL[sheet.view] : undefined}>
        {sheet?.view === 'detail' && selected && (
          <TxDetailSheet
            tx={selected}
            today={today}
            fmt={fmt}
            onOpenCategory={() => openCategory(selected.id, true)}
            onOpenDate={() => setSheet({ view: 'date', txId: selected.id, back: 'detail' })}
            onOpenPayment={() => setSheet({ view: 'payment', txId: selected.id, back: 'detail' })}
            onSaveText={(id, patch) => { void updateTx(id, patch); }}
            onDelete={() => deleteTx(selected)}
            onDone={() => setSheet(null)}
            subItemName={subItems.find((p) => p.id === selected.budget_sub_item_id)?.name}
          />
        )}
        {sheet?.view === 'category' && selected && (
          <CategorySheet
            key={selected.id}
            categories={categories}
            type={selected.type}
            subtitle={`${selected.description || selected.category_name} · ${fmt(Number(selected.amount))}`}
            initialCategoryId={selected.category_id}
            othersCount={(catId) => sameMerchantOthers(rows, selected, catId).length}
            merchantName={selected.description ?? ''}
            saving={flow.saving}
            error={flow.error}
            subItems={subItems}
            initialSubItemId={selected.budget_sub_item_id ?? null}
            onMissingSubItem={() => setMessage({ text: 'Elige de qué parte.', tone: 'error' })}
            onSave={(catId, type, applyAll, subId) => { void saveCategory(selected, catId, type, applyAll, subId); }}
          />
        )}
        {sheet?.view === 'date' && selected && (
          <DateSheet
            today={today}
            selected={selected.date}
            onSelect={(date) => {
              void updateTx(selected.id, { date });
              setSheet({ view: 'detail', txId: selected.id, back: null });
            }}
          />
        )}
        {sheet?.view === 'payment' && selected && (
          <OptionSheet<PaymentMethod>
            title={selected.type === 'income' ? '¿Cómo lo recibiste?' : '¿Con qué pagaste?'}
            options={PAYMENT_OPTIONS}
            selected={selected.payment_method}
            onSelect={(pm) => {
              void updateTx(selected.id, { payment_method: pm });
              setSheet({ view: 'detail', txId: selected.id, back: null });
            }}
          />
        )}
      </BottomSheet>

      <UndoToast
        visible={flow.undoVisible}
        title={flow.undoTitle}
        subtitle={flow.undoSubtitle || undefined}
        onUndo={flow.doUndo}
        onDismiss={flow.dismissUndo}
        duration={DELETE_UNDO_MS}
      />

      <UndoToast
        key={deletion.pending?.id}
        visible={!!deletion.pending}
        title={deletion.pending
          ? `Borraste ${deletion.pending.description || deletion.pending.category_name} · ${fmt(Number(deletion.pending.amount))}`
          : ''}
        onUndo={deletion.undo}
        onDismiss={deletion.commit}
        duration={DELETE_UNDO_MS}
      />

      <StatusToast message={message} onDone={() => setMessage(null)} />
    </>
  );

  return {
    element,
    openDetail,
    openCategory,
    deleteTx,
    flash,
    flashId,
    /** Id con borrado pendiente: hay que filtrarlo al recargar. */
    getPendingDeleteId: deletion.getPendingId,
    deleteError: deletion.error,
    showMessage: setMessage,
  };
}
