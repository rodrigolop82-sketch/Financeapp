'use client';

import { useCallback, useEffect, useState } from 'react';
import { COHORT_WEEKS, fmtPct, heatCell, type Retencion } from '@/lib/admin/metrics';
import { CARD, LoadError, LoadingBlocks, PageTitle, StatCard, TEXT_SECONDARY, TEXT_STRONG, fetchJson } from './ui';

const HEAD = `text-[12.5px] font-bold uppercase tracking-[0.04em] ${TEXT_SECONDARY}`;

export function RetencionTab() {
  const [data, setData] = useState<Retencion | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const res = await fetchJson<Retencion>('/api/admin/retencion');
    if (res.ok) setData(res.data);
    else setError(res.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Retención" subtitle="% de cada grupo semanal de registros que siguió usando Zafi" />
      {error && <LoadError message={error} onRetry={load} />}
      {!data && !error && <LoadingBlocks rows={1} />}
      {data && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
            <StatCard label="Semana 1" value={fmtPct(data.s1)}>
              <span className={`text-[13px] ${TEXT_SECONDARY}`}>vuelven después de su primera semana</span>
            </StatCard>
            <StatCard label="Semana 4" value={fmtPct(data.s4)}>
              <span className={`text-[13px] ${TEXT_SECONDARY}`}>siguen activos al mes</span>
            </StatCard>
            <div
              className={`flex animate-fade-up flex-col gap-1 rounded-[18px] p-[18px] ${
                data.retains.positive ? 'bg-success-light text-success-text' : `${CARD} ${TEXT_STRONG}`
              }`}
            >
              <span className="text-[13.5px] font-bold">Lo que más retiene</span>
              <span className="font-outfit text-[26px] font-extrabold leading-tight">{data.retains.title}</span>
              <span className="text-[13px]">{data.retains.sub}</span>
            </div>
          </div>

          <div className={`${CARD} overflow-x-auto p-5`}>
            <div
              role="table"
              aria-label="Retención por grupo semanal"
              className="grid min-w-[620px] grid-cols-[140px_80px_repeat(5,minmax(0,1fr))] items-center gap-1.5"
            >
              <span role="columnheader" className={HEAD}>Se registraron</span>
              <span role="columnheader" className={HEAD}>Usuarios</span>
              {Array.from({ length: COHORT_WEEKS }, (_, k) => (
                <span key={k} role="columnheader" className={`${HEAD} text-center`}>Sem {k}</span>
              ))}
              {data.cohorts.map((c) => (
                <div key={c.label} role="row" className="contents">
                  <span role="cell" className={`text-sm font-semibold ${TEXT_STRONG}`}>{c.label}</span>
                  <span role="cell" className="font-outfit text-sm font-semibold text-ink-700 dark:text-[var(--zafi-text-secondary)]">{c.size}</span>
                  {c.cells.map((v, k) => {
                    const h = heatCell(v);
                    return (
                      <div
                        key={k}
                        role="cell"
                        className={`flex h-11 items-center justify-center rounded-lg font-outfit text-[14.5px] font-bold ${
                          v === null
                            ? 'bg-[var(--zafi-card-alt)] text-ink-200 dark:text-ink-500'
                            : h.light
                              ? 'text-white'
                              : 'text-ink-900 dark:text-ink-100'
                        }`}
                        style={v === null ? undefined : { background: h.bg }}
                      >
                        {v === null ? '—' : `${v}%`}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <p className="max-w-[820px] rounded-[14px] bg-warning-light px-4 py-3.5 text-[14.5px] leading-normal text-warning-text">
            <b>Lectura:</b> {data.reading}
          </p>
        </>
      )}
    </div>
  );
}
