'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { createClient } from '@/lib/supabase';
import { DELETE_ERROR_MESSAGE, DELETE_UNDO_MS, reinsertAt } from '@/lib/transactions/undo-delete';

interface PendingDelete<T> {
  tx: T;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Borrado optimista con "Deshacer": la fila sale de la lista al instante y
 * solo se borra en Supabase cuando vence el toast, cuando se borra otra fila
 * o cuando el usuario sale de la página.
 */
export function useUndoableDelete<T extends { id: string }>(
  setItems: Dispatch<SetStateAction<T[]>>,
  /** Se llama cuando el borrado ya se confirmó en la base. */
  onCommitted?: () => void,
) {
  const onCommittedRef = useRef(onCommitted);
  onCommittedRef.current = onCommitted;
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const pendingRef = useRef<PendingDelete<T> | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const [pending, setPending] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El token se guarda para poder confirmar el borrado al cerrar o recargar
  // la página, cuando ya no hay tiempo de esperar una llamada async.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      accessTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const commit = useCallback(async () => {
    const p = pendingRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingRef.current = null;
    setPending(null);

    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', p.tx.id);
    if (deleteError) {
      setItems((prev) => reinsertAt(prev, p.tx, p.index));
      setError(DELETE_ERROR_MESSAGE);
      return;
    }
    onCommittedRef.current?.();
  }, [supabase, setItems]);

  /** Quita `tx` (que está en `index`) y abre la ventana para deshacer. */
  const remove = useCallback((tx: T, index: number) => {
    if (pendingRef.current) void commit();
    setError(null);
    setItems((prev) => prev.filter((t) => t.id !== tx.id));
    const timer = setTimeout(() => { void commit(); }, DELETE_UNDO_MS);
    pendingRef.current = { tx, index, timer };
    setPending(tx);
  }, [commit, setItems]);

  const undo = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingRef.current = null;
    setPending(null);
    setItems((prev) => reinsertAt(prev, p.tx, p.index));
  }, [setItems]);

  // Al salir (navegación interna, recarga o cierre de pestaña) se confirma el
  // borrado pendiente. `keepalive` deja que la petición termine aunque la
  // página se esté descargando.
  useEffect(() => {
    function flush() {
      const p = pendingRef.current;
      if (!p) return;
      clearTimeout(p.timer);
      pendingRef.current = null;

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const token = accessTokenRef.current;
      if (!url || !key || !token) {
        void supabase.from('transactions').delete().eq('id', p.tx.id);
        return;
      }
      fetch(`${url}/rest/v1/transactions?id=eq.${encodeURIComponent(p.tx.id)}`, {
        method: 'DELETE',
        keepalive: true,
        headers: { apikey: key, Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [supabase]);

  const getPendingId = useCallback(() => pendingRef.current?.tx.id ?? null, []);

  return {
    /** Fila borrada que todavía se puede recuperar. */
    pending,
    error,
    clearError: useCallback(() => setError(null), []),
    remove,
    undo,
    commit,
    getPendingId,
  };
}
