'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { planSection, type PlanSection } from '@/lib/navigation';
import { localMonth } from '@/lib/dates';
import { monthName } from '@/lib/plan-del-mes';
import { AppShell } from '@/components/layout/AppShell';
import { PillButton, Segmented } from '@/components/layout/Pantalla';
import { BORDER, TEXT_STRONG } from '@/components/movimientos/ui';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import { PresupuestoView } from '@/components/presupuesto/PresupuestoView';
import { MetasView } from '@/components/goals/MetasView';
import { DeudasView } from '@/components/deudas/DeudasView';

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
  // Cada toque en "+ Nueva meta" / "+ Agregar" abre la hoja de la sección.
  const [addMeta, setAddMeta] = useState(0);
  const [addDeuda, setAddDeuda] = useState(0);

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

  const month = monthName(localMonth());
  const right =
    section === 'metas' ? <PillButton onClick={() => setAddMeta((n) => n + 1)}>+ Nueva meta</PillButton>
    : section === 'deudas' ? <PillButton onClick={() => setAddDeuda((n) => n + 1)}>+ Agregar</PillButton>
    : (
      <span className={`flex h-11 flex-none items-center rounded-full border bg-[var(--zafi-card)] px-4 text-sm font-semibold capitalize ${BORDER} ${TEXT_STRONG}`}>
        {month}
      </span>
    );

  return (
    <AppShell title="Plan" currentPath="/plan" titleRight={right} headerRight={right}>
      <div className="max-w-2xl">
        <Segmented label="Sección del plan" options={SECTIONS} value={section} onChange={select} />
      </div>
      {section === 'mes' && <PresupuestoView />}
      {section === 'metas' && <MetasView addRequest={addMeta} />}
      {section === 'deudas' && <DeudasView addRequest={addDeuda} />}
    </AppShell>
  );
}
