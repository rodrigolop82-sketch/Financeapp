'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PeriodDays, Resumen, Trend } from '@/lib/admin/metrics';
import { CARD, LoadError, LoadingBlocks, PageTitle, StatCard, TEXT_SECONDARY, TEXT_STRONG, fetchJson } from './ui';

export interface ResumenData extends Resumen {
  accesos: { reactivar: number; nuncaCapturo: number; sinLeer: number };
}

const PERIOD_OPTIONS: { days: PeriodDays; label: string }[] = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const DELTA_CLASS: Record<Trend, string> = {
  up: 'bg-success-light text-success-text',
  down: 'bg-danger-light text-danger-text',
  flat: 'bg-ink-100 text-ink-700',
};

const SOURCE_COLOR: Record<string, string> = {
  manual: 'bg-navy dark:bg-navy-light',
  importacion: 'bg-electric',
  voz: 'bg-electric-pale',
  foto: 'bg-warning',
};

export function ResumenTab({ onGo, onUnread }: { onGo: (tab: 'inact' | 'fb') => void; onUnread: (n: number) => void }) {
  const [days, setDays] = useState<PeriodDays>(30);
  const [data, setData] = useState<ResumenData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: PeriodDays) => {
    setLoading(true);
    setError('');
    const res = await fetchJson<ResumenData>(`/api/admin/resumen?days=${d}`);
    if (res.ok) {
      setData(res.data);
      onUnread(res.data.accesos.sinLeer);
    } else setError(res.error);
    setLoading(false);
  }, [onUnread]);

  useEffect(() => { load(days); }, [days, load]);

  const periodPicker = (
    <div role="radiogroup" aria-label="Periodo" className="flex rounded-full bg-[var(--zafi-tab-bg)] p-[3px]">
      {PERIOD_OPTIONS.map((p) => {
        const active = p.days === days;
        return (
          <button
            key={p.days}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setDays(p.days)}
            className={`h-[34px] rounded-full px-4 text-[13.5px] font-semibold transition-all ${TEXT_STRONG} ${
              active ? 'bg-[var(--zafi-tab-active)] shadow-[var(--zafi-tab-shadow)]' : ''
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Cómo va Zafi" subtitle="Lo que necesitas para decidir: ¿la gente vuelve?, ¿paga?, ¿a quién rescatar?">
        {periodPicker}
      </PageTitle>

      {error && !loading && <LoadError message={error} onRetry={() => load(days)} />}
      {loading && !data && <LoadingBlocks rows={1} />}

      {data && (
        <div className={`flex flex-col gap-5 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
            {data.kpis.map((k) => (
              <StatCard key={k.key} label={k.label} value={k.value}>
                <span className={`flex flex-wrap items-center gap-1.5 text-[13px] ${TEXT_SECONDARY}`}>
                  <span className={`rounded-full px-2 py-0.5 font-bold ${DELTA_CLASS[k.delta.trend]}`}>{k.delta.label}</span>
                  {k.sub}
                </span>
              </StatCard>
            ))}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-3.5">
            <Funnel data={data} />
            <Activity data={data} />
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-3.5">
            <AccessCard
              emoji="🛟"
              title={`${data.accesos.reactivar} ${data.accesos.reactivar === 1 ? 'usuario' : 'usuarios'} para reactivar`}
              sub={`${data.accesos.nuncaCapturo} nunca ${data.accesos.nuncaCapturo === 1 ? 'capturó' : 'capturaron'} un gasto`}
              onClick={() => onGo('inact')}
            />
            <AccessCard
              emoji="💬"
              title={`${data.accesos.sinLeer} ${data.accesos.sinLeer === 1 ? 'mensaje' : 'mensajes'} sin leer`}
              sub="De “Envíanos tu idea”"
              onClick={() => onGo('fb')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Funnel({ data }: { data: ResumenData }) {
  const { steps, insight } = data.funnel;
  return (
    <section className={`${CARD} flex flex-col gap-3.5 p-5`} aria-label="De registro a premium">
      <div className="flex flex-col gap-0.5">
        <h2 className={`text-[17px] font-bold ${TEXT_STRONG}`}>De registro a premium</h2>
        <span className={`text-[13.5px] ${TEXT_SECONDARY}`}>Usuarios registrados en el periodo</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {steps.map((s) => (
          <div key={s.label} className="grid grid-cols-[150px_1fr_74px] items-center gap-3">
            <span className={`text-sm font-semibold ${TEXT_STRONG}`}>{s.label}</span>
            <div className="h-7 overflow-hidden rounded-lg bg-surface-bg dark:bg-[var(--zafi-card-alt)]">
              <div
                className={`flex h-full items-center rounded-lg pl-2.5 font-outfit text-sm font-bold text-white transition-[width] duration-500 ${
                  s.final ? 'bg-success-dark' : s.worst ? 'bg-warning' : 'bg-navy dark:bg-navy-light'
                }`}
                style={{ width: `${Math.max(8, s.pctOfFirst)}%` }}
              >
                {s.value}
              </div>
            </div>
            <span className={`text-right text-[13px] font-bold ${s.worst ? 'text-warning-text dark:text-warning' : TEXT_SECONDARY}`}>
              {s.pctOfFirst}%
            </span>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-warning-light px-3.5 py-3 text-sm leading-[1.45] text-warning-text">
        {insight ? (
          <>
            <b>Mayor fuga:</b> {insight}
          </>
        ) : (
          'Aún no hay registros en este periodo.'
        )}
      </div>
    </section>
  );
}

function Activity({ data }: { data: ResumenData }) {
  const { bars, total, subtitle, weekly } = data.activity;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const gap = bars.length <= 7 ? 'gap-3.5' : weekly ? 'gap-2' : 'gap-1';
  return (
    <section className={`${CARD} flex flex-col gap-3.5 p-5`} aria-label="Movimientos registrados por día">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className={`text-[17px] font-bold ${TEXT_STRONG}`}>{weekly ? 'Movimientos registrados por semana' : 'Movimientos registrados por día'}</h2>
          <span className={`text-[13.5px] ${TEXT_SECONDARY}`}>{subtitle}</span>
        </div>
        <span className={`font-outfit text-2xl font-extrabold ${TEXT_STRONG}`}>{total.toLocaleString('en-US')}</span>
      </div>
      <div className={`flex h-[150px] items-end ${gap}`}>
        {bars.map((b, i) => (
          <div
            key={b.label + i}
            title={`${b.label}: ${b.value} ${b.value === 1 ? 'movimiento' : 'movimientos'}`}
            className={`flex-1 rounded-[4px_4px_2px_2px] transition-[height] duration-500 ${
              i === bars.length - 1 ? 'bg-electric' : 'bg-navy dark:bg-navy-light'
            }`}
            style={{ height: `${b.value > 0 ? Math.max(2, (b.value / max) * 100) : 0}%` }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_SECONDARY}`}>Cómo capturan</span>
        <div className="flex h-3.5 overflow-hidden rounded-[7px] bg-surface-bg dark:bg-[var(--zafi-card-alt)]">
          {data.sources.map((s) => (
            <div key={s.key} className={SOURCE_COLOR[s.key]} style={{ width: `${s.pct}%` }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {data.sources.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[13.5px] text-ink-700 dark:text-[var(--zafi-text-secondary)]">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${SOURCE_COLOR[s.key]}`} />
              {s.label} <b className={TEXT_STRONG}>{s.pct}%</b>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccessCard({ emoji, title, sub, onClick }: { emoji: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD} flex items-center gap-3.5 px-5 py-[18px] text-left transition-transform active:scale-[0.99]`}
    >
      <span aria-hidden className="text-[28px]">{emoji}</span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className={`text-base font-bold ${TEXT_STRONG}`}>{title}</span>
        <span className={`text-[13.5px] ${TEXT_SECONDARY}`}>{sub}</span>
      </span>
      <span className="text-sm font-bold text-electric dark:text-electric-pale">Ver ›</span>
    </button>
  );
}
