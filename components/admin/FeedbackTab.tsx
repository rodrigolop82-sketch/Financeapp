'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  FEEDBACK_FILTERS,
  feedbackDate,
  matchesFeedbackFilter,
  screenLabel,
  statusLabel,
  typeLabel,
  type AdminFeedbackItem,
  type FeedbackFilter,
  type FeedbackStatus,
} from '@/lib/admin/feedback';
import { CARD, FilterChip, LoadError, PageTitle, TEXT_SECONDARY, TEXT_STRONG, fetchJson } from './ui';
import { SkeletonRows } from '@/components/motion/PageSkeleton';

const TYPE_CLASS: Record<string, string> = {
  bug: 'bg-danger-light text-danger-text',
  idea: 'bg-electric-ghost text-electric-dark',
  otro: 'bg-ink-100 text-ink-700',
};

const STATUS_CLASS: Record<FeedbackStatus, string> = {
  nuevo: 'text-electric-dark dark:text-electric-pale',
  leido: TEXT_SECONDARY,
  respondido: 'text-success-text dark:text-success',
};

interface Shot {
  url: string | null;
  loading: boolean;
}

export function FeedbackTab({ toast, onUnread }: { toast: (text: string, tone?: 'ok' | 'error') => void; onUnread: (n: number) => void }) {
  const [items, setItems] = useState<AdminFeedbackItem[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FeedbackFilter>('Sin responder');
  const [selId, setSelId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [shots, setShots] = useState<Record<string, Shot>>({});
  const now = Date.now();

  const load = useCallback(async () => {
    setError('');
    const res = await fetchJson<{ items: AdminFeedbackItem[]; error?: string }>('/api/admin/feedback');
    if (res.ok) {
      setItems(res.data.items);
      if (res.data.error) setError(res.data.error);
    } else setError(res.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (items) onUnread(items.filter((m) => m.status === 'nuevo').length);
  }, [items, onUnread]);

  const list = useMemo(() => (items ?? []).filter((m) => matchesFeedbackFilter(m, filter)), [items, filter]);
  const sel = items?.find((m) => m.id === selId) ?? null;

  function setStatus(id: string, status: FeedbackStatus) {
    setItems((prev) => prev?.map((m) => (m.id === id ? { ...m, status } : m)) ?? prev);
  }

  async function open(m: AdminFeedbackItem) {
    setSelId(m.id);
    setReply('');
    if (m.status === 'nuevo') setStatus(m.id, 'leido');
    if (m.hasScreenshot && !shots[m.id]?.url) setShots((s) => ({ ...s, [m.id]: { url: null, loading: true } }));
    const res = await fetchJson<{ status: FeedbackStatus; screenshotUrl: string | null }>(`/api/admin/feedback/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'abrir' }),
    });
    if (res.ok) {
      setStatus(m.id, res.data.status);
      if (m.hasScreenshot) setShots((s) => ({ ...s, [m.id]: { url: res.data.screenshotUrl, loading: false } }));
    } else {
      if (m.status === 'nuevo') setStatus(m.id, 'nuevo');
      if (m.hasScreenshot) setShots((s) => ({ ...s, [m.id]: { url: null, loading: false } }));
      toast(res.error, 'error');
    }
  }

  async function sendReply() {
    if (!sel || !reply.trim() || sending) return;
    setSending(true);
    const res = await fetchJson<{ status: FeedbackStatus; to: string }>(`/api/admin/feedback/${sel.id}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply }),
    });
    setSending(false);
    if (!res.ok) {
      toast(res.error, 'error');
      return;
    }
    setStatus(sel.id, 'respondido');
    setReply('');
    toast(`Respuesta enviada a ${res.data.to}`);
  }

  async function toggleResolved() {
    if (!sel) return;
    const action = sel.status === 'respondido' ? 'reabrir' : 'resolver';
    const prev = sel.status;
    setStatus(sel.id, action === 'resolver' ? 'respondido' : 'leido');
    const res = await fetchJson<{ status: FeedbackStatus }>(`/api/admin/feedback/${sel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setStatus(sel.id, prev);
      toast(res.error, 'error');
      return;
    }
    setStatus(sel.id, res.data.status);
    toast(action === 'resolver' ? 'Marcado como resuelto' : 'Mensaje reabierto');
  }

  const shot = sel ? shots[sel.id] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Feedback" subtitle="Mensajes de “Envíanos tu idea”. También llegan a hola@zafiapp.com." />
      {error && <LoadError message={error} onRetry={load} />}
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_FILTERS.map((f) => (
          <FilterChip
            key={f}
            label={f}
            count={items ? items.filter((m) => matchesFeedbackFilter(m, f)).length : undefined}
            active={filter === f}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-3.5">
        <div className={`${CARD} overflow-hidden`}>
          {!items && !error && <SkeletonRows count={5} className="p-3" />}
          {items && list.length === 0 && (
            <p className={`px-4 py-8 text-center text-sm ${TEXT_SECONDARY}`}>No hay mensajes en este filtro.</p>
          )}
          <ul>
            {list.map((m) => {
              const on = m.id === selId;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => open(m)}
                    aria-current={on}
                    className={`flex w-full flex-col gap-1.5 border-b border-l-[3px] border-b-[var(--zafi-border-light)] px-4 py-3.5 text-left transition-colors ${
                      on ? 'border-l-electric bg-[#EFF6FF] dark:bg-electric/15' : 'border-l-transparent hover:bg-[var(--zafi-hover)]'
                    }`}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className={`flex-none rounded-full px-[9px] py-[3px] text-xs font-bold ${TYPE_CLASS[m.type] ?? TYPE_CLASS.otro}`}>{typeLabel(m.type)}</span>
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${TEXT_SECONDARY}`}>{m.email ?? 'Usuario eliminado'}</span>
                      <span className={`flex-none text-[12.5px] ${TEXT_SECONDARY}`}>{feedbackDate(m.createdAt, now)}</span>
                    </span>
                    <span className={`line-clamp-2 text-[14.5px] leading-[1.4] ${TEXT_STRONG} ${m.status === 'nuevo' ? 'font-bold' : 'font-normal'}`}>
                      {m.message}
                    </span>
                    <span className={`text-[12.5px] font-semibold ${STATUS_CLASS[m.status]}`}>{statusLabel(m.status)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {sel ? (
          <section aria-label="Mensaje" className={`${CARD} sticky top-[84px] flex flex-col gap-3.5 p-5`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-[3px] text-[12.5px] font-bold ${TYPE_CLASS[sel.type] ?? TYPE_CLASS.otro}`}>{typeLabel(sel.type)}</span>
              <span className={`text-[13.5px] ${TEXT_SECONDARY}`}>
                {feedbackDate(sel.createdAt, now)} · desde {screenLabel(sel.screen)}
              </span>
            </div>
            <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>{sel.email ?? 'Usuario eliminado'}</span>
            <p className={`whitespace-pre-wrap text-[15.5px] leading-[1.55] ${TEXT_STRONG}`}>{sel.message}</p>
            {sel.hasScreenshot && (
              shot?.url ? (
                <a href={shot.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-ink-100 dark:border-[var(--zafi-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shot.url} alt="Captura adjunta" onError={() => setShots((st) => ({ ...st, [sel.id]: { url: null, loading: false } }))} className="max-h-[260px] w-full bg-surface-bg object-contain dark:bg-[var(--zafi-card-alt)]" />
                </a>
              ) : (
                <div className={`flex h-[120px] items-center justify-center gap-2 rounded-xl border border-dashed border-ink-200 bg-surface-bg text-[13.5px] dark:border-[var(--zafi-border)] dark:bg-[var(--zafi-card-alt)] ${TEXT_SECONDARY}`}>
                  {shot?.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : '📎'}
                  {shot?.loading ? 'Cargando captura…' : 'Captura adjunta (no se pudo cargar)'}
                </div>
              )
            )}
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escribe tu respuesta…"
              aria-label="Tu respuesta"
              disabled={!sel.email}
              className={`h-[110px] resize-none rounded-xl border border-ink-100 bg-surface-tint px-3.5 py-3 text-[14.5px] leading-[1.45] outline-none focus:border-electric dark:border-[var(--zafi-border)] dark:bg-[var(--zafi-input-bg)] ${TEXT_STRONG}`}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sendReply}
                disabled={!reply.trim() || sending || !sel.email}
                className="flex h-11 min-w-[200px] flex-1 items-center justify-center gap-2 rounded-full bg-electric text-[14.5px] font-bold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Responder desde hola@zafiapp.com
              </button>
              <button
                type="button"
                onClick={toggleResolved}
                className={`h-11 rounded-full border border-ink-200 bg-[var(--zafi-card)] px-4 text-sm font-semibold dark:border-[var(--zafi-border)] ${TEXT_STRONG}`}
              >
                {sel.status === 'respondido' ? 'Reabrir' : 'Marcar resuelto'}
              </button>
            </div>
          </section>
        ) : (
          items && items.length > 0 && (
            <div className={`${CARD} flex h-[180px] items-center justify-center p-5 text-sm ${TEXT_SECONDARY}`}>
              Elige un mensaje para leerlo.
            </div>
          )
        )}
      </div>
    </div>
  );
}
