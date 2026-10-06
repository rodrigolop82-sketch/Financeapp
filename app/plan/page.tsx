'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { planSection, type PlanSection } from '@/lib/navigation';
import { localMonth } from '@/lib/dates';
import { monthName } from '@/lib/plan-del-mes';
import { AppShell } from '@/components/layout/AppShell';
import { Segmented } from '@/components/layout/Pantalla';
import { BORDER, TEXT_STRONG } from '@/components/movimientos/ui';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import { PresupuestoView } from '@/components/presupuesto/PresupuestoView';
import { MetasView } from '@/components/goals/MetasView';
import { DeudasView } from '@/components/deudas/DeudasView';
import { ScorePill } from '@/components/score/ScoreUI';
import { useHealthScore } from '@/hooks/useHealthScore';
import { createClient } from '@/lib/supabase';
import { getUserHousehold } from '@/lib/household';
import { SCORE_INPUTS_CHANGED } from '@/lib/score-feedback';

const SECTIONS: { value: PlanSection; label: string }[] = [
  { value: 'mes', label: 'Del mes' },
  { value: 'metas', label: 'Metas' },
  { value: 'deudas', label: 'Deudas' },
];

export default function PlanPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PlanHub />
    </Suspense>
  );
}

/** Pestaña Plan: Plan del mes, Metas y Deudas con un selector (?s=mes|metas|deudas). */
function PlanHub() {
  const router = useRouter();
  const params = useSearchParams();
  const section = planSection(params.get('s'));
  // /metas/nueva abre la hoja de nueva meta (crear se hace al final de cada lista).
  const [addMeta, setAddMeta] = useState(0);

  function replaceQuery(edit: (q: URLSearchParams) => void) {
    const q = new URLSearchParams(params.toString());
    edit(q);
    const qs = q.toString();
    router.replace(qs ? `/plan?${qs}` : '/plan', { scroll: false });
  }

  function select(s: PlanSection) {
    replaceQuery((q) => {
      if (s === 'mes') q.delete('s');
      else q.set('s', s);
    });
  }

  // /metas/nueva llega con ?nueva=1: abre la hoja una vez.
  const wantsNew = params.get('nueva') === '1';
  useEffect(() => {
    if (!wantsNew) return;
    setAddMeta((n) => n + 1);
    replaceQuery((q) => q.delete('nueva'));
  }, [wantsNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // El detalle de meta llega con ?eliminada={id}: MetasView la quita con "Deshacer".
  const clearDeleted = useCallback(() => {
    if (params.get('eliminada')) replaceQuery((q) => q.delete('eliminada'));
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pastilla de la salud financiera: se recalcula con cada cambio de metas o deudas.
  const [householdId, setHouseholdId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: { id: string } | null } }) => {
      if (!user) return;
      const hh = await getUserHousehold(supabase, user.id);
      if (hh) setHouseholdId(hh.id);
    });
  }, []);
  const { score, recalculate } = useHealthScore(householdId);
  useEffect(() => {
    const onChange = () => { void recalculate(); };
    window.addEventListener(SCORE_INPUTS_CHANGED, onChange);
    return () => window.removeEventListener(SCORE_INPUTS_CHANGED, onChange);
  }, [recalculate]);

  const month = monthName(localMonth());
  const right = (
    <div className="flex flex-none items-center gap-2">
      {score && score.components.length > 0 && <ScorePill score={score} href="/score?from=plan" />}
      {section === 'mes' && (
        <span className={`flex h-9 flex-none items-center rounded-full border bg-[var(--zafi-card)] px-3.5 text-sm font-semibold capitalize ${BORDER} ${TEXT_STRONG}`}>
          {month}
        </span>
      )}
    </div>
  );

  return (
    <AppShell title="Plan" currentPath="/plan" titleRight={right} headerRight={right}>
      <div className="max-w-2xl">
        <Segmented label="Sección del plan" options={SECTIONS} value={section} onChange={select} />
      </div>
      {section === 'mes' && <PresupuestoView />}
      {section === 'metas' && (
        <MetasView addRequest={addMeta} deletedId={params.get('eliminada')} onDeletedHandled={clearDeleted} />
      )}
      {section === 'deudas' && <DeudasView />}
    </AppShell>
  );
}
