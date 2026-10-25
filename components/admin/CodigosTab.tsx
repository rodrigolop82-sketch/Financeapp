'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import {
  codeStatus, discountLabel, normalizeCode, randomCode, type CodeStatus, type DiscountCode,
} from '@/lib/descuentos';
import type { Cycle, Tier } from '@/lib/plans';
import { CARD, LoadError, PageTitle, PillButton, TEXT_SECONDARY, TEXT_STRONG, fetchJson } from './ui';
import { SkeletonRows } from '@/components/motion/PageSkeleton';

const COLS = 'grid grid-cols-[1.2fr_1.3fr_1fr_0.7fr_0.9fr_0.8fr_172px] items-center gap-3';
const FIELD = `h-10 w-full rounded-[10px] border-[1.5px] border-ink-100 bg-[var(--zafi-card)] px-3 text-sm outline-none focus:border-electric dark:border-[var(--zafi-border)] ${TEXT_STRONG}`;
const LABEL = `flex flex-col gap-1 text-[12.5px] font-bold uppercase tracking-[0.04em] ${TEXT_SECONDARY}`;

const STATUS_CLASS: Record<CodeStatus, string> = {
  Activo: 'bg-success-light text-success-text',
  Pausado: 'bg-ink-100 text-ink-700',
  Vencido: 'bg-warning-light text-warning-text',
  Agotado: 'bg-warning-light text-warning-text',
};

const TIER_NAME: Record<Tier, string> = { premium: 'Premium', family: 'Familiar' };
const CYCLE_NAME: Record<Cycle, string> = { monthly: 'Mensual', annual: 'Anual' };

interface Form {
  code: string;
  percentOff: string;
  indefinite: boolean;
  durationMonths: string;
  tiers: Tier[];
  cycles: Cycle[];
  maxRedemptions: string;
  expiresAt: string;
  note: string;
}

const EMPTY: Form = {
  code: '', percentOff: '100', indefinite: false, durationMonths: '3',
  tiers: ['premium', 'family'], cycles: ['monthly', 'annual'], maxRedemptions: '', expiresAt: '', note: '',
};

function toggleIn<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Check({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-[10px] border-[1.5px] px-3 text-sm font-semibold ${TEXT_STRONG} ${
        on ? 'border-electric bg-electric-ghost dark:bg-electric/20' : 'border-ink-100 bg-[var(--zafi-card)] dark:border-[var(--zafi-border)]'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center rounded border-[1.5px] text-[10px] font-extrabold text-white ${
          on ? 'border-electric bg-electric' : 'border-ink-200 dark:border-ink-500'
        }`}
      >
        {on ? '✓' : ''}
      </span>
      {label}
    </button>
  );
}

function dateLabel(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Códigos de descuento: crear, pausar y ver usos. 100% lo da la app; 1–99%
 * lo cobra Recurrente con un cupón del mismo código que hay que crear allá.
 */
export function CodigosTab({ toast }: { toast: (text: string, tone?: 'ok' | 'error') => void }) {
  const [items, setItems] = useState<DiscountCode[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastPartial, setLastPartial] = useState<DiscountCode | null>(null);
  const now = Date.now();

  const load = useCallback(async () => {
    setError('');
    const res = await fetchJson<{ items: DiscountCode[]; error?: string }>('/api/admin/codigos');
    if (res.ok) {
      setItems(res.data.items);
      if (res.data.error) setError(res.data.error);
    } else setError(res.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const free = form.percentOff.trim() === '100';
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const res = await fetchJson<{ item: DiscountCode }>('/api/admin/codigos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code,
        percentOff: form.percentOff,
        durationMonths: form.indefinite ? null : form.durationMonths,
        tiers: form.tiers,
        cycles: form.cycles,
        maxRedemptions: form.maxRedemptions,
        expiresAt: form.expiresAt,
        note: form.note,
      }),
    });
    setSaving(false);
    if (!res.ok) { setFormError(res.error); return; }
    setItems((prev) => [res.data.item, ...(prev ?? [])]);
    setLastPartial(res.data.item.percentOff < 100 ? res.data.item : null);
    setForm(EMPTY);
    toast(`Código ${res.data.item.code} creado`);
  }

  async function setActive(c: DiscountCode, active: boolean) {
    const res = await fetchJson<{ active: boolean }>(`/api/admin/codigos/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) { toast(res.error, 'error'); return; }
    setItems((prev) => prev?.map((x) => (x.id === c.id ? { ...x, active } : x)) ?? prev);
    toast(active ? `${c.code} activo` : `${c.code} pausado`);
  }

  async function copyLink(c: DiscountCode) {
    const url = `${window.location.origin}/planes?code=${encodeURIComponent(c.code)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado');
    } catch {
      toast(url, 'error');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        title="Códigos"
        subtitle="Descuentos para Premium y Familiar. 100% activa el plan gratis sin tarjeta; de 1% a 99% se cobra con el cupón de Recurrente."
      />
      {error && <LoadError message={error} onRetry={load} />}

      <form onSubmit={create} className={`${CARD} flex flex-col gap-4 p-5`}>
        <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>Nuevo código</span>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          <label className={LABEL}>
            Código
            <span className="flex gap-1.5">
              <input
                value={form.code}
                onChange={(e) => set('code', normalizeCode(e.target.value))}
                placeholder="FUNDADORES"
                maxLength={32}
                className={`${FIELD} uppercase`}
                required
              />
              <PillButton onClick={() => set('code', randomCode())} title="Código al azar">Generar</PillButton>
            </span>
          </label>
          <label className={LABEL}>
            Descuento (%)
            <input
              type="number"
              min={1}
              max={100}
              value={form.percentOff}
              onChange={(e) => set('percentOff', e.target.value)}
              className={FIELD}
              required
            />
          </label>
          <div className={LABEL}>
            Duración
            <span className="flex gap-1.5">
              <input
                type="number"
                min={1}
                max={120}
                aria-label="Meses"
                value={form.indefinite ? '' : form.durationMonths}
                onChange={(e) => set('durationMonths', e.target.value)}
                disabled={form.indefinite}
                placeholder={form.indefinite ? '—' : 'Meses'}
                className={`${FIELD} disabled:opacity-50`}
              />
              <Check on={form.indefinite} label="Indefinido" onClick={() => set('indefinite', !form.indefinite)} />
            </span>
          </div>
          <label className={LABEL}>
            Usos máximos
            <input
              type="number"
              min={1}
              value={form.maxRedemptions}
              onChange={(e) => set('maxRedemptions', e.target.value)}
              placeholder="Sin límite"
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Se puede usar hasta
            <input type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} className={FIELD} />
          </label>
          <label className={LABEL}>
            Nota interna
            <input value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Fundadores, influencer…" maxLength={200} className={FIELD} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`mr-1 text-[12.5px] font-bold uppercase tracking-[0.04em] ${TEXT_SECONDARY}`}>Planes</span>
          {(['premium', 'family'] as Tier[]).map((t) => (
            <Check key={t} on={form.tiers.includes(t)} label={TIER_NAME[t]} onClick={() => set('tiers', toggleIn(form.tiers, t))} />
          ))}
          {!free && (
            <>
              <span className={`ml-3 mr-1 text-[12.5px] font-bold uppercase tracking-[0.04em] ${TEXT_SECONDARY}`}>Cobro</span>
              {(['monthly', 'annual'] as Cycle[]).map((c) => (
                <Check key={c} on={form.cycles.includes(c)} label={CYCLE_NAME[c]} onClick={() => set('cycles', toggleIn(form.cycles, c))} />
              ))}
            </>
          )}
        </div>
        <p className={`text-[13px] leading-[1.45] ${TEXT_SECONDARY}`}>
          {free
            ? 'Gratis: la persona elige Premium o Familiar (entre los que marques) y queda activo desde hoy, sin tarjeta. Al vencer pasa a Gratis sin perder nada. Indefinido es para fundadores.'
            : 'Parcial: además crea en Recurrente un cupón con el mismo código, el mismo % y la misma duración. Recurrente es quien cobra el descuento; aquí se valida quién lo usa y cuántas veces.'}
          {' '}Cada persona puede usar un código una sola vez, y solo en su primera compra (no al cambiar de plan).
        </p>
        {formError && <p role="alert" className="text-sm font-semibold text-danger-text">{formError}</p>}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-electric px-4 text-[13.5px] font-bold text-white transition-colors active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-ink-200 dark:disabled:bg-ink-700"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Crear código
          </button>
        </div>
      </form>

      {lastPartial && (
        <div role="status" className="rounded-[14px] bg-warning-light px-4 py-3 text-sm text-warning-text">
          <b>Falta un paso en Recurrente:</b> crea el cupón <b>{lastPartial.code}</b> con {lastPartial.percentOff}% de descuento y duración{' '}
          {lastPartial.durationMonths ? `de ${lastPartial.durationMonths} ${lastPartial.durationMonths === 1 ? 'mes' : 'meses'}` : 'indefinida (para siempre)'}.
          Sin ese cupón, el pago con este código no abre.
        </div>
      )}

      <div className={`${CARD} overflow-x-auto`}>
        <div role="table" aria-label="Códigos de descuento" className="flex min-w-[860px] flex-col">
          <div role="row" className={`${COLS} border-b border-ink-100 px-4 py-3 text-[12.5px] font-bold uppercase tracking-[0.04em] dark:border-[var(--zafi-border)] ${TEXT_SECONDARY}`}>
            <span role="columnheader">Código</span>
            <span role="columnheader">Descuento</span>
            <span role="columnheader">Planes</span>
            <span role="columnheader">Usos</span>
            <span role="columnheader">Hasta</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader"><span className="sr-only">Acciones</span></span>
          </div>
          {!items && !error && <SkeletonRows count={4} className="p-3" />}
          {items && items.length === 0 && (
            <p className={`px-4 py-8 text-center text-sm ${TEXT_SECONDARY}`}>Todavía no hay códigos</p>
          )}
          {items?.map((c) => {
            const status = codeStatus(c, now);
            return (
              <div key={c.id} role="row" className={`${COLS} border-b border-[var(--zafi-border-light)] px-4 py-3 text-sm last:border-b-0 ${TEXT_STRONG}`}>
                <span role="cell" className="flex min-w-0 flex-col">
                  <span className="truncate font-outfit font-bold tracking-[0.03em]">{c.code}</span>
                  {c.note && <span className={`truncate text-[12.5px] ${TEXT_SECONDARY}`} title={c.note}>{c.note}</span>}
                </span>
                <span role="cell" className="flex flex-col">
                  <span className="font-semibold">{discountLabel(c)}</span>
                  {c.percentOff < 100 && <span className={`text-[12.5px] ${TEXT_SECONDARY}`}>Cupón en Recurrente</span>}
                </span>
                <span role="cell" className="flex flex-col text-[13px]">
                  <span>{c.tiers.map((t) => TIER_NAME[t]).join(' · ')}</span>
                  {c.percentOff < 100 && c.cycles.length < 2 && <span className={TEXT_SECONDARY}>{CYCLE_NAME[c.cycles[0]]}</span>}
                </span>
                <span role="cell" className="font-outfit font-semibold">
                  {c.redemptions}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
                </span>
                <span role="cell" className="text-[13px]">{dateLabel(c.expiresAt)}</span>
                <span role="cell">
                  <span className={`rounded-full px-[9px] py-[3px] text-[12.5px] font-bold ${STATUS_CLASS[status]}`}>{status}</span>
                </span>
                <span role="cell" className="flex gap-1.5">
                  <PillButton onClick={() => copyLink(c)} title="Copiar el link de Planes con el código puesto">
                    <Copy className="h-3.5 w-3.5" aria-hidden />Link
                  </PillButton>
                  <PillButton onClick={() => setActive(c, !c.active)}>{c.active ? 'Pausar' : 'Activar'}</PillButton>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
