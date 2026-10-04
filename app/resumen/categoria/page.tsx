'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { getEmoji } from '@/lib/categories-ui';
import { analyzeMonth, categoryStatus, monthTitle } from '@/lib/como-te-fue';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import { DIVIDER, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { useComoTeFue } from '@/components/resumen/useComoTeFue';
import { AMBER_TEXT, CARD, GREEN_TEXT, NAVY_BG } from '@/components/resumen/ctf-ui';

export default function PorCategoriaPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PorCategoria />
    </Suspense>
  );
}

function PorCategoria() {
  const fmt = useFormatMoney();
  const { data, month, current } = useComoTeFue();
  const a = useMemo(() => (data ? analyzeMonth(data, month, data.caps, fmt) : null), [data, month, fmt]);

  if (!data || !a) return <PageSkeleton variant="list" />;

  const total = a.current.spent;
  const overKeys = new Set(a.recs.over.map((r) => r.key));
  const rows = Object.values(a.spend)
    .filter((s) => s.spent > 0)
    .sort((x, y) => y.spent - x.spent);
  const max = Math.max(1, ...rows.map((r) => r.spent));
  const title = monthTitle(month, current);

  return (
    <AppShell title="Por categoría" currentPath="/resumen" hideMobileBar userName={data.userName} householdName={data.householdName}>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <div className="-mx-4 flex flex-col items-start gap-0.5 px-5 pt-[env(safe-area-inset-top)]">
          <Link href={`/resumen?mes=${month}`} className="flex h-11 items-center text-[15px] font-semibold text-electric">‹ Cómo te fue</Link>
          <h1 className="font-serif text-[30px] leading-[1.15] text-ink-900 dark:text-ink-100 lg:hidden">Por categoría</h1>
          <span className={`text-sm ${TEXT_MUTED}`}>{title} · {fmt(total)} gastados</span>
        </div>

        {rows.length === 0 ? (
          <div className={`mt-3.5 p-5 text-sm ${CARD} ${TEXT_MUTED}`}>No hay gastos registrados en este mes.</div>
        ) : (
          <ul className={`mt-3.5 px-4 py-0.5 zafi-stagger ${CARD}`}>
            {rows.map((r, i) => {
              const cat = data.categories.find((c) => c.id === r.id)!;
              const key = a.capKeyOf[r.id];
              const plan = a.planOf[r.id] ?? 0;
              const st = categoryStatus({ capOver: !!key && overKeys.has(key), cap: key ? data.caps[key] : null, spent: r.spent, plan }, fmt);
              const fixed = a.kindOf[r.id] === 'fijo';
              const pct = total > 0 ? Math.round((r.spent / total) * 100) : 0;
              return (
                <li key={r.id} className={i > 0 ? `border-t ${DIVIDER}` : ''}>
                  <Link
                    href={`/resumen/categoria/${r.id}?mes=${month}`}
                    className="flex flex-col gap-[7px] py-3 transition-transform duration-150 active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden className="text-lg">{getEmoji(cat)}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`truncate text-[14.5px] font-semibold ${TEXT_STRONG}`}>{r.name}</span>
                        <span className={`text-[12.5px] ${TEXT_MUTED}`}>{pct}% de tus gastos · {fixed ? 'Fijo' : 'Variable'}</span>
                      </span>
                      <span className="flex flex-col items-end">
                        <span className={`font-outfit text-[15.5px] font-bold ${TEXT_STRONG}`}>{fmt(r.spent)}</span>
                        <span className={`text-[12.5px] font-semibold ${st.tone === 'warning' ? AMBER_TEXT : GREEN_TEXT}`}>{st.text}</span>
                      </span>
                      <span aria-hidden className={`font-bold ${TEXT_FAINT}`}>›</span>
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded bg-[var(--zafi-border-light)]">
                      <span
                        className={`block h-full rounded ${fixed ? NAVY_BG : 'bg-warning'}`}
                        style={{ width: `${(r.spent / max) * 100}%` }}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
