'use client';

import { useState, useRef, useCallback } from 'react';
import type { SearchTransaction, BudgetCategory } from '@/types';
import { getMerchantKey } from '@/lib/transactions/merchant-key';

type Step = 'idle' | 'editing' | 'reclassifying';

interface MatchItem {
  id: string;
  description: string | null;
  date: string;
  amount: string | number;
  category_source: string;
}

interface UndoPayload {
  items: { id: string; categoryId: string; categorySource: string; type?: string; transactionType?: string; subItemId?: string | null }[];
  overrideCreated: boolean;
  merchantKey: string | null;
  householdId: string;
  title: string;
  subtitle: string;
}

export function useReclassifyFlow(
  categories: BudgetCategory[],
  onMutation: () => void,
) {
  const [step, setStep] = useState<Step>('idle');
  const [editingTx, setEditingTx] = useState<SearchTransaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [merchantName, setMerchantName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [defaultSelectedIds, setDefaultSelectedIds] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);

  const [undoVisible, setUndoVisible] = useState(false);
  const [undoTitle, setUndoTitle] = useState('');
  const [undoSubtitle, setUndoSubtitle] = useState('');

  const firstSnapshotRef = useRef<{
    id: string;
    categoryId: string;
    categorySource: string;
  } | null>(null);
  const newCategoryIdRef = useRef<string>('');
  const merchantKeyRef = useRef<string | null>(null);
  const undoRef = useRef<UndoPayload | null>(null);

  const openEdit = useCallback((tx: SearchTransaction) => {
    setEditingTx(tx);
    setError(null);
    setStep('editing');
  }, []);

  const closeEdit = useCallback(() => {
    setEditingTx(null);
    setError(null);
    setStep('idle');
  }, []);

  const saveCategory = useCallback(
    async (categoryId: string, type?: 'expense' | 'income') => {
      if (!editingTx) return;

      if (!categoryId) {
        setError('Selecciona una categoría antes de guardar.');
        return;
      }

      setSaving(true);
      setError(null);

      const typeChanged = !!type && type !== editingTx.type;

      try {
        const res = await fetch('/api/transactions/reclassify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: editingTx.id,
            categoryId,
            type,
          }),
        });

        if (!res.ok) {
          let message = 'No pudimos guardar el cambio. Intenta de nuevo.';
          try {
            const errData = await res.json();
            if (errData?.error) message = errData.error;
          } catch {
            // keep default message
          }
          setError(message);
          setSaving(false);
          return;
        }

        const data = await res.json();
        firstSnapshotRef.current = data.snapshot;
        newCategoryIdRef.current = categoryId;
        merchantKeyRef.current = getMerchantKey(editingTx.description);

        const catObj = categories.find((c) => c.id === categoryId);
        const catName = catObj?.name ?? '';
        const label = typeChanged && categoryId === editingTx.category_id
          ? (type === 'income' ? 'Ingreso' : 'Gasto')
          : catName;
        const subtitle = typeChanged
          ? `${editingTx.description ?? ''} → ${type === 'income' ? 'Ingreso' : 'Gasto'}${categoryId !== editingTx.category_id ? ` · ${catName}` : ''}`
          : `${editingTx.description ?? ''} → ${catName}`;

        if (data.matches && data.matches.length > 0) {
          setMerchantName(editingTx.description || 'Sin descripción');
          setNewCategoryName(catName);
          setMatches(data.matches);
          setDefaultSelectedIds(data.defaultSelectedIds ?? []);
          setTruncated(data.truncated ?? false);
          setStep('reclassifying');
          setSaving(false);
          onMutation();
        } else {
          undoRef.current = {
            items: [data.snapshot],
            overrideCreated: false,
            merchantKey: merchantKeyRef.current,
            householdId: editingTx.household_id,
            title: typeChanged ? `Movimiento actualizado a ${label}` : 'Categoría actualizada',
            subtitle,
          };
          setUndoTitle(undoRef.current.title);
          setUndoSubtitle(undoRef.current.subtitle);
          setUndoVisible(true);
          setStep('idle');
          setEditingTx(null);
          setSaving(false);
          onMutation();
        }
      } catch {
        setError('Error de conexión. Intenta de nuevo.');
        setSaving(false);
      }
    },
    [editingTx, categories, onMutation],
  );

  const confirmBulk = useCallback(
    async (selectedIds: string[], remember: boolean) => {
      if (!editingTx || !firstSnapshotRef.current) return;
      setSaving(true);
      setError(null);

      try {
        const categoryId = newCategoryIdRef.current;

        const res = await fetch('/api/transactions/confirm-reclassify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceTransactionId: editingTx.id,
            categoryId,
            ids: selectedIds,
            remember,
          }),
        });

        if (!res.ok) {
          let message = 'No pudimos guardar el cambio. Intenta de nuevo.';
          try {
            const errData = await res.json();
            if (errData?.error) message = errData.error;
          } catch {
            // keep default message
          }
          setError(message);
          setSaving(false);
          return;
        }

        const data = await res.json();

        const allItems = [
          firstSnapshotRef.current,
          ...data.snapshot,
        ];

        const bulkCount = data.appliedCount ?? 0;

        undoRef.current = {
          items: allItems,
          overrideCreated: data.overrideCreated ?? false,
          merchantKey: merchantKeyRef.current,
          householdId: editingTx.household_id,
          title: `${1 + bulkCount} ${1 + bulkCount === 1 ? 'movimiento reclasificado' : 'movimientos reclasificados'}`,
          subtitle: `${merchantName} → ${newCategoryName}`,
        };

        setUndoTitle(undoRef.current.title);
        setUndoSubtitle(undoRef.current.subtitle);
        setUndoVisible(true);
        setStep('idle');
        setEditingTx(null);
        setSaving(false);
        onMutation();
      } catch {
        setError('Error de conexión. Intenta de nuevo.');
        setSaving(false);
      }
    },
    [editingTx, newCategoryName, merchantName, onMutation],
  );

  const singleOnly = useCallback(
    async (remember: boolean) => {
      if (!editingTx || !firstSnapshotRef.current) return;

      if (remember) {
        setSaving(true);
        try {
          const categoryId = newCategoryIdRef.current;

          const res = await fetch('/api/transactions/confirm-reclassify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceTransactionId: editingTx.id,
              categoryId,
              ids: [],
              remember: true,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            undoRef.current = {
              items: [firstSnapshotRef.current!],
              overrideCreated: data.overrideCreated ?? false,
              merchantKey: merchantKeyRef.current,
              householdId: editingTx.household_id,
              title: 'Categoría actualizada',
              subtitle: `${merchantName} → ${newCategoryName}`,
            };
          }
        } catch {
          // still show undo for the single edit
        }
        setSaving(false);
      } else {
        undoRef.current = {
          items: [firstSnapshotRef.current],
          overrideCreated: false,
          merchantKey: merchantKeyRef.current,
          householdId: editingTx.household_id,
          title: 'Categoría actualizada',
          subtitle: `${merchantName} → ${newCategoryName}`,
        };
      }

      setUndoTitle(undoRef.current?.title ?? 'Categoría actualizada');
      setUndoSubtitle(undoRef.current?.subtitle ?? '');
      setUndoVisible(true);
      setStep('idle');
      setEditingTx(null);
    },
    [editingTx, newCategoryName, merchantName],
  );

  /**
   * Cambia la categoría (y el tipo) de `tx` en un solo paso, sin pasar por
   * ReclassifySheet: si `applyToOthers` y hay otros movimientos del mismo
   * comercio, también los cambia y recuerda la regla. Deja listo el toast
   * con "Deshacer", que revierte todos. Devuelve true si se guardó.
   */
  const reclassifyDirect = useCallback(
    async (
      tx: Pick<SearchTransaction, 'id' | 'household_id' | 'description' | 'type'>,
      categoryId: string,
      type: 'expense' | 'income',
      applyToOthers: boolean,
      /** Parte del Plan del mes; undefined no la toca, null la quita. */
      subItemId?: string | null,
    ): Promise<boolean> => {
      setSaving(true);
      setError(null);

      const readError = async (res: Response) => {
        try {
          const errData = await res.json();
          if (errData?.error) return errData.error as string;
        } catch {
          // keep default message
        }
        return 'No pudimos guardar el cambio. Intenta de nuevo.';
      };

      try {
        const res = await fetch('/api/transactions/reclassify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: tx.id,
            categoryId,
            type: type !== tx.type ? type : undefined,
            subItemId,
          }),
        });
        if (!res.ok) {
          setError(await readError(res));
          setSaving(false);
          return false;
        }
        const data = await res.json();
        const items: UndoPayload['items'] = [data.snapshot];
        let overrideCreated = false;

        if (applyToOthers && Array.isArray(data.matches) && data.matches.length > 0) {
          const bulk = await fetch('/api/transactions/confirm-reclassify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceTransactionId: tx.id,
              categoryId,
              ids: (data.matches as MatchItem[]).map((m) => m.id),
              remember: true,
              subItemId,
            }),
          });
          if (bulk.ok) {
            const bulkData = await bulk.json();
            items.push(...(bulkData.snapshot ?? []));
            overrideCreated = bulkData.overrideCreated ?? false;
          }
        }

        const catName = categories.find((c) => c.id === categoryId)?.name ?? '';
        undoRef.current = {
          items,
          overrideCreated,
          merchantKey: getMerchantKey(tx.description),
          householdId: tx.household_id,
          title: items.length > 1 ? `${items.length} movimientos ahora son ${catName}` : `Ahora es ${catName}`,
          subtitle: '',
        };
        setUndoTitle(undoRef.current.title);
        setUndoSubtitle('');
        setUndoVisible(true);
        setSaving(false);
        onMutation();
        return true;
      } catch {
        setError('Error de conexión. Intenta de nuevo.');
        setSaving(false);
        return false;
      }
    },
    [categories, onMutation],
  );

  const doUndo = useCallback(async () => {
    const payload = undoRef.current;
    if (!payload) return;
    setUndoVisible(false);

    try {
      await fetch('/api/transactions/undo-reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payload.items,
          overrideCreated: payload.overrideCreated,
          merchantKey: payload.merchantKey,
          householdId: payload.householdId,
        }),
      });
      onMutation();
    } catch {
      // silent fail on undo
    }

    undoRef.current = null;
  }, [onMutation]);

  const dismissUndo = useCallback(() => {
    setUndoVisible(false);
    undoRef.current = null;
  }, []);

  return {
    step,
    editingTx,
    saving,
    error,
    merchantName,
    newCategoryName,
    matches,
    defaultSelectedIds,
    truncated,
    undoVisible,
    undoTitle,
    undoSubtitle,
    openEdit,
    closeEdit,
    saveCategory,
    confirmBulk,
    singleOnly,
    reclassifyDirect,
    clearError: () => setError(null),
    doUndo,
    dismissUndo,
  };
}
