'use client';

import { useState, useRef, useCallback } from 'react';
import type { SearchTransaction, BudgetCategory } from '@/types';

type Step = 'idle' | 'editing' | 'reclassifying';

interface MatchItem {
  id: string;
  description: string | null;
  date: string;
  amount: string | number;
  category_source: string;
}

interface UndoPayload {
  items: { id: string; categoryId: string; categorySource: string }[];
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
  const undoRef = useRef<UndoPayload | null>(null);

  const openEdit = useCallback((tx: SearchTransaction) => {
    setEditingTx(tx);
    setStep('editing');
  }, []);

  const closeEdit = useCallback(() => {
    setEditingTx(null);
    setStep('idle');
  }, []);

  const saveCategory = useCallback(
    async (categoryId: string) => {
      if (!editingTx) return;
      setSaving(true);

      try {
        const res = await fetch('/api/transactions/reclassify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: editingTx.id,
            categoryId,
          }),
        });

        if (!res.ok) {
          setSaving(false);
          return;
        }

        const data = await res.json();
        firstSnapshotRef.current = data.snapshot;
        newCategoryIdRef.current = categoryId;

        const catObj = categories.find((c) => c.id === categoryId);
        const catName = catObj?.name ?? '';

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
            merchantKey: null,
            householdId: editingTx.household_id,
            title: 'Categoría actualizada',
            subtitle: `${editingTx.description ?? ''} → ${catName}`,
          };
          setUndoTitle('Categoría actualizada');
          setUndoSubtitle(`${editingTx.description ?? ''} → ${catName}`);
          setUndoVisible(true);
          setStep('idle');
          setEditingTx(null);
          setSaving(false);
          onMutation();
        }
      } catch {
        setSaving(false);
      }
    },
    [editingTx, categories, onMutation],
  );

  const confirmBulk = useCallback(
    async (selectedIds: string[], remember: boolean) => {
      if (!editingTx || !firstSnapshotRef.current) return;
      setSaving(true);

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
          merchantKey: null,
          householdId: editingTx.household_id,
          title: `${1 + bulkCount} ${1 + bulkCount === 1 ? 'gasto' : 'gastos'} reclasificados`,
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
              merchantKey: null,
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
          merchantKey: null,
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
    doUndo,
    dismissUndo,
  };
}
