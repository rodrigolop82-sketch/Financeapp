'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  INACTIVE_FILTERS,
  matchesInactiveFilter,
  type InactiveFilter,
  type InactiveRow,
} from '@/lib/admin/metrics';
import { REMINDER_MAX_PER_CALL, reminderToast, type ReminderSummary } from '@/lib/admin/access';
import { CARD, FilterChip, LoadError, PageTitle, PillButton, TEXT_SECONDARY, TEXT_STRONG, fetchJson } from './ui';
import { SkeletonRows } from '@/components/motion/PageSkeleton';

const COLS = 'grid grid-cols-[44px_minmax(200px,2fr)_1fr_1fr_1fr_1fr_1.2fr] items-center gap-2';

const PLAN_CLASS: Record<string, string> = {
  Premium: 'bg-success-light text-success-text',
  Prueba: 'bg-warning-light text-warning-text',
  Gratis: 'bg-ink-100 text-ink-700',
};

function lastLabel(days: number): string {
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

function lastClass(days: number): string {
  if (days > 30) return 'text-danger-text dark:text-danger';
  if (days > 14) return 'text-warning-text dark:text-warning';
  return TEXT_STRONG;
}

export function ReactivarTab({ toast }: { toast: (text: string, tone?: 'ok' | 'error') => void }) {
  const [rows, setRows] = useState<InactiveRow[] | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<InactiveFilter>('Todos');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const res = await fetchJson<{ rows: InactiveRow[]; pushEnabled: boolean }>('/api/admin/inactivos');
    if (res.ok) {
      setRows(res.data.rows);
      setPushEnabled(res.data.pushEnabled);
    } else setError(res.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => (rows ?? []).filter((r) => matchesInactiveFilter(r, filter)), [rows, filter]);
  const selCount = selected.size;
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((r) => (allSelected ? next.delete(r.id) : next.add(r.id)));
      return next;
    });
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/inactivos/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), filter }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error || 'No se pudo exportar.', 'error');
        return;
      }
      const exported = Number(res.headers.get('X-Export-Count') || 0);
      const skipped = Number(res.headers.get('X-Export-Skipped') || 0);
      if (exported === 0) {
        toast(skipped > 0 ? 'Nadie de esta lista aceptó recibir correos' : 'No hay a quién exportar', 'error');
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'zafi-reactivar.csv';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(
        `${exported} ${exported === 1 ? 'correo exportado' : 'correos exportados'} para Mailchimp` +
          (skipped > 0 ? ` · ${skipped} sin permiso de correo` : ''),
      );
    } catch {
      toast('No se pudo exportar.', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function sendReminder() {
    if (!selCount) return;
    if (selCount > REMINDER_MAX_PER_CALL) {
      toast(`Máximo ${REMINDER_MAX_PER_CALL} personas por envío`, 'error');
      return;
    }
    setSending(true);
    const res = await fetchJson<ReminderSummary>('/api/admin/recordatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: Array.from(selected) }),
    });
    setSending(false);
    if (!res.ok) {
      toast(res.error, 'error');
      return;
    }
    setSelected(new Set());
    toast(reminderToast(res.data), res.data.sent > 0 ? 'ok' : 'error');
  }

  const exportCount = selCount || visible.length;

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Para reactivar" subtitle="Usuarios sin actividad reciente. Solo se ve el conteo de movimientos, nunca montos." />
      {error && <LoadError message={error} onRetry={load} />}

      <div className="flex flex-wrap items-center gap-2">
        {INACTIVE_FILTERS.map((f) => (
          <FilterChip
            key={f}
            label={f}
            count={rows ? rows.filter((r) => matchesInactiveFilter(r, f)).length : undefined}
            active={filter === f}
            onClick={() => setFilter(f)}
          />
        ))}
        <div className="flex-1" />
        <PillButton onClick={toggleAll} disabled={!visible.length}>{allSelected ? 'Quitar selección' : 'Seleccionar todos'}</PillButton>
        <PillButton onClick={exportCsv} disabled={exporting || !rows || exportCount === 0}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
          Exportar {exportCount} (CSV)
        </PillButton>
        <PillButton
          primary
          onClick={sendReminder}
          disabled={!pushEnabled || !selCount || sending}
          title={pushEnabled ? 'Aviso push a los seleccionados (1 al día como máximo)' : 'Los avisos push no están configurados'}
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Enviar recordatorio ({selCount})
        </PillButton>
      </div>
      <p className={`text-[13px] leading-[1.45] ${TEXT_SECONDARY}`}>
        El CSV sale listo para importar en Mailchimp: correo, nombre, plan, días sin entrar y una etiqueta con la situación para segmentar.
        Solo incluye a quienes aceptaron recibir correos.
        {rows && !pushEnabled && ' El recordatorio push no está disponible: faltan las llaves VAPID en el servidor.'}
      </p>

      <div className={`${CARD} overflow-x-auto`}>
        <div role="table" aria-label="Usuarios para reactivar" className="flex min-w-[820px] flex-col">
          <div role="row" className={`${COLS} border-b border-ink-100 px-4 py-3 text-[12.5px] font-bold uppercase tracking-[0.04em] dark:border-[var(--zafi-border)] ${TEXT_SECONDARY}`}>
            <span role="columnheader"><span className="sr-only">Seleccionar</span></span>
            <span role="columnheader">Usuario</span>
            <span role="columnheader">Registro</span>
            <span role="columnheader">Último acceso</span>
            <span role="columnheader">Movimientos</span>
            <span role="columnheader">Plan</span>
            <span role="columnheader">Situación</span>
          </div>
          {!rows && !error && <SkeletonRows count={6} className="p-3" />}
          {rows && visible.length === 0 && (
            <p className={`px-4 py-8 text-center text-sm ${TEXT_SECONDARY}`}>Nadie por reactivar en este filtro 🎉</p>
          )}
          {visible.map((u) => {
            const on = selected.has(u.id);
            return (
              <div
                key={u.id}
                role="row"
                aria-selected={on}
                tabIndex={0}
                onClick={() => toggle(u.id)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggle(u.id);
                  }
                }}
                className={`${COLS} cursor-pointer border-b border-[var(--zafi-border-light)] px-4 py-3 text-sm outline-none transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-electric ${TEXT_STRONG} ${
                  on ? 'bg-[#EFF6FF] dark:bg-electric/15' : 'hover:bg-[var(--zafi-hover)]'
                }`}
              >
                <span role="cell">
                  <span
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`Seleccionar ${u.email}`}
                    className={`flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] text-xs font-extrabold text-white transition-colors ${
                      on ? 'border-electric bg-electric' : 'border-ink-200 bg-[var(--zafi-card)] dark:border-ink-500'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                </span>
                <span role="cell" className="truncate font-semibold" title={u.email}>{u.email}</span>
                <span role="cell" className="text-ink-700 dark:text-[var(--zafi-text-secondary)]">{u.registeredLabel}</span>
                <span role="cell" className={`font-semibold ${lastClass(u.daysInactive)}`}>{lastLabel(u.daysInactive)}</span>
                <span role="cell" className="font-outfit font-semibold">{u.txCount}</span>
                <span role="cell">
                  <span className={`rounded-full px-[9px] py-[3px] text-[12.5px] font-bold ${PLAN_CLASS[u.plan]}`}>{u.plan}</span>
                </span>
                <span role="cell" className="text-ink-700 dark:text-[var(--zafi-text-secondary)]">{u.situation}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
