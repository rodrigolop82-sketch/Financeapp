'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { localMonth } from '@/lib/dates';
import { addMonths } from '@/lib/como-te-fue';
import { previousMonth } from '@/lib/plan-del-mes';
import { loadComoTeFue, type CtfData } from './loadComoTeFue';

function validMonth(m: string | null): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

/**
 * Datos de "Cómo te fue" para el mes de `?mes=`. Sin `mes`, el último mes
 * cerrado (o el actual si todavía no hay meses anteriores con datos).
 */
export function useComoTeFue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const current = localMonth();
  const raw = searchParams.get('mes');
  const requested = validMonth(raw) && raw <= current ? raw : null;
  const tentative = requested ?? previousMonth(current);

  const [loaded, setLoaded] = useState<{ key: string; data: CtfData } | null>(null);
  const [gen, setGen] = useState(0);
  const reload = useCallback(() => setGen((g) => g + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadComoTeFue(supabase, {
        from: addMonths(tentative, -5),
        to: current,
        snapshotMonth: tentative === current ? null : tentative,
      });
      if (cancelled) return;
      if (res.status === 'login') { router.push('/login'); return; }
      if (res.status === 'onboarding') { router.push('/onboarding'); return; }
      setLoaded({ key: tentative, data: res.data });
    })();
    return () => { cancelled = true; };
  }, [supabase, router, tentative, current, gen]);

  // Al cambiar de mes no se muestran los datos del anterior mientras carga.
  const data = loaded && loaded.key === tentative ? loaded.data : null;
  const month = requested
    ?? (data && (!data.earliest || data.earliest > tentative) ? current : tentative);
  // Si sin datos previos se cae al mes actual, el plan guardado de `tentative` no aplica.
  const view = useMemo(() => (data && month !== tentative ? { ...data, snapshots: {} } : data), [data, month, tentative]);

  const goTo = useCallback((m: string, path = '/resumen') => {
    router.push(`${path}?mes=${m}`, { scroll: false });
  }, [router]);

  return {
    supabase,
    data: view,
    reload,
    month,
    current,
    isCurrent: month === current,
    canPrev: !!data?.earliest && addMonths(month, -1) >= data.earliest,
    canNext: month < current,
    goTo,
  };
}
