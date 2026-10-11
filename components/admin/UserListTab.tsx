'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Mail, Search } from 'lucide-react';
import { matchesUserSearch, type UserRow } from '@/lib/admin/metrics';
import {
  REMINDER_MAX_PER_CALL,
  emailReminderToast,
  reminderToast,
  type EmailReminderSummary,
  type ReminderSummary,
} from '@/lib/admin/access';
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

export interface UserListTabProps<F extends string> {
  title: string;
  subtitle: string;
  tableLabel: string;
  emptyText: string;
  /** GET → { rows, pushEnabled, emailEnabled } */
  endpoint: string;
  /** scope del CSV (ver /api/admin/inactivos/csv). */
  csvScope?: 'usuarios';
  filters: readonly F[];
  matches: (row: UserRow, filter: F) => boolean;
  /** Muestra la búsqueda por correo o nombre. */
  searchable?: boolean;
  toast: (text: string, tone?: 'ok' | 'error') => void;
}

/**
 * Lista de usuarios con filtros, selección y acciones: exportar a Mailchimp,
 * recordatorio push y recordatorio por correo. La usan Usuarios y Para reactivar.
 */
export function UserListTab<F extends string>({
  title,
  subtitle,
  tableLabel,
  emptyText,
  endpoint,
  csvScope,
  filters,
  matches,
  searchable,
  toast,
}: UserListTabProps<F>) {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<F>(filters[0]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [mailing, setMailing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const res = await fetchJson<{ rows: UserRow[]; pushEnabled: boolean; emailEnabled?: boolean }>(endpoint);
    if (res.ok) {
      setRows(res.data.rows);
      setPushEnabled(res.data.pushEnabled);
      setEmailEnabled(res.data.emailEnabled === true);
    } else setError(res.error);
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const searched = useMemo(() => (rows ?? []).filter((r) => matchesUserSearch(r, query)), [rows, query]);
  const visible = useMemo(() => searched.filter((r) => matches(r, filter)), [searched, matches, filter]);
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
      // Con búsqueda activa y sin selección, exporta exactamente lo que se ve.
      const ids = selCount ? Array.from(selected) : query.trim() ? visible.map((r) => r.id) : [];
      const res = await fetch('/api/admin/inactivos/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, filter, scope: csvScope }),
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
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'zafi-usuarios.csv';
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

  function checkSelection(): boolean {
    if (!selCount) return false;
    if (selCount > REMINDER_MAX_PER_CALL) {
      toast(`Máximo ${REMINDER_MAX_PER_CALL} personas por envío`, 'error');
      return false;
    }
    return true;
  }

  async function sendReminder() {
    if (!checkSelection()) return;
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

  async function sendEmailReminder() {
    if (!checkSelection()) return;
    const withConsent = (rows ?? []).filter((r) => selected.has(r.id) && r.marketingOptIn).length;
    if (withConsent === 0) {
      toast('Nadie de los seleccionados aceptó recibir correos', 'error');
      return;
    }
    const ok = window.confirm(
      `¿Enviar el correo de recordatorio a ${withConsent} ${withConsent === 1 ? 'persona' : 'personas'}?` +
        (withConsent < selCount ? `\n${selCount - withConsent} no aceptaron correos y no lo recibirán.` : ''),
    );
    if (!ok) return;
    setMailing(true);
    const res = await fetchJson<EmailReminderSummary>('/api/admin/correo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: Array.from(selected) }),
    });
    setMailing(false);
    if (!res.ok) {
      toast(res.error, 'error');
      return;
    }
    setSelected(new Set());
    toast(emailReminderToast(res.data), res.data.sent > 0 ? 'ok' : 'error');
  }

  const exportCount = selCount || visible.length;

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={title} subtitle={subtitle} />
      {error && <LoadError message={error} onRetry={load} />}

      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <label className={`flex h-9 min-w-[220px] items-center gap-2 rounded-full border-[1.5px] border-ink-100 bg-[var(--zafi-card)] px-3.5 dark:border-[var(--zafi-border)] ${TEXT_STRONG}`}>
            <Search className={`h-4 w-4 flex-none ${TEXT_SECONDARY}`} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar correo o nombre"
              aria-label="Buscar por correo o nombre"
              className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-ink-400"
            />
          </label>
        )}
        {filters.map((f) => (
          <FilterChip
            key={f}
            label={f}
            count={rows ? searched.filter((r) => matches(r, f)).length : undefined}
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
          onClick={sendEmailReminder}
          disabled={!emailEnabled || !selCount || mailing}
          title={emailEnabled ? 'Correo de recordatorio a los seleccionados que aceptaron correos' : 'El correo no está configurado (falta RESEND_API_KEY)'}
        >
          {mailing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Mail className="h-3.5 w-3.5" aria-hidden />}
          Enviar correo ({selCount})
        </PillButton>
        <PillButton
          primary
          onClick={sendReminder}
          disabled={!pushEnabled || !selCount || sending}
          title={pushEnabled ? 'Aviso push a los seleccionados (1 al día como máximo)' : 'Los avisos push no están configurados'}
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Enviar push ({selCount})
        </PillButton>
      </div>
      <p className={`text-[13px] leading-[1.45] ${TEXT_SECONDARY}`}>
        El CSV sale listo para importar en Mailchimp: correo, nombre, plan, días sin entrar y una etiqueta con la situación para segmentar.
        El CSV y el correo solo llegan a quienes aceptaron recibir correos. Quien nunca capturó recibe el correo «Empieza hoy»; quien ya usó
        Zafi, «Tu mes te espera». Vista previa:{' '}
        <a href="/api/admin/correo?kind=empezar" target="_blank" rel="noreferrer" className="font-semibold text-electric underline-offset-2 hover:underline">Empieza hoy</a>
        {' · '}
        <a href="/api/admin/correo?kind=volver" target="_blank" rel="noreferrer" className="font-semibold text-electric underline-offset-2 hover:underline">Tu mes te espera</a>.
        {rows && !pushEnabled && ' El push no está disponible: faltan las llaves VAPID en el servidor.'}
        {rows && !emailEnabled && ' El correo no está disponible: falta RESEND_API_KEY en el servidor.'}
      </p>

      <div className={`${CARD} overflow-x-auto`}>
        <div role="table" aria-label={tableLabel} className="flex min-w-[820px] flex-col">
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
            <p className={`px-4 py-8 text-center text-sm ${TEXT_SECONDARY}`}>{query.trim() ? 'Nadie coincide con la búsqueda' : emptyText}</p>
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
                <span role="cell" className="flex items-center gap-1.5 text-ink-700 dark:text-[var(--zafi-text-secondary)]">
                  <span
                    aria-hidden
                    className={`h-2 w-2 flex-none rounded-full ${u.status === 'Activo' ? 'bg-success' : 'bg-ink-200 dark:bg-ink-500'}`}
                  />
                  {u.situation}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
