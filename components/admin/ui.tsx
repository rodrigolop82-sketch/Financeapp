'use client';

import { useEffect, type ReactNode } from 'react';
import { SkeletonBlock } from '@/components/motion/PageSkeleton';

// Piezas compartidas del panel de admin (fase 12). Escritorio, fluido.

export const TEXT_STRONG = 'text-ink-900 dark:text-ink-100';
export const TEXT_SECONDARY = 'text-[var(--zafi-text-secondary)]';
export const CARD =
  'rounded-[18px] border border-[rgba(30,58,95,0.08)] bg-[var(--zafi-card)] dark:border-[var(--zafi-border)]';

export function PageTitle({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className={`font-serif text-[34px] leading-tight ${TEXT_STRONG}`}>{title}</h1>
        <p className={`text-[14.5px] ${TEXT_SECONDARY}`}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, children, valueClass = 'text-[36px]' }: { label: string; value: string; children?: ReactNode; valueClass?: string }) {
  return (
    <div className={`${CARD} flex animate-fade-up flex-col gap-1.5 p-[18px]`}>
      <span className={`text-[13.5px] font-semibold ${TEXT_SECONDARY}`}>{label}</span>
      <span className={`font-outfit font-extrabold leading-[1.05] tracking-[-0.02em] ${valueClass} ${TEXT_STRONG}`}>{value}</span>
      {children}
    </div>
  );
}

export function FilterChip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-[13.5px] font-semibold transition-colors ${TEXT_STRONG} ${
        active
          ? 'border-electric bg-electric-ghost dark:bg-electric/20'
          : 'border-ink-100 bg-[var(--zafi-card)] hover:border-ink-200 dark:border-[var(--zafi-border)]'
      }`}
    >
      {label}
      {count !== undefined && <span className={TEXT_SECONDARY}>{count}</span>}
    </button>
  );
}

export function PillButton({ children, onClick, disabled, title, primary }: { children: ReactNode; onClick: () => void; disabled?: boolean; title?: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        primary
          ? 'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-electric px-4 text-[13.5px] font-bold text-white transition-colors active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-ink-200 dark:disabled:bg-ink-700'
          : `flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-200 bg-[var(--zafi-card)] px-3.5 text-[13.5px] font-semibold transition-transform active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--zafi-border)] ${TEXT_STRONG}`
      }
    >
      {children}
    </button>
  );
}

export function LoadingBlocks({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-3.5">
      <SkeletonBlock className="h-10 w-[260px]" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        {Array.from({ length: 4 }, (_, i) => <SkeletonBlock key={i} className="h-[118px] !rounded-[18px]" />)}
      </div>
      {Array.from({ length: rows }, (_, i) => <SkeletonBlock key={i} className="h-[180px] !rounded-[18px]" />)}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${CARD} flex flex-col items-start gap-3 p-5`} role="alert">
      <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{message}</span>
      <PillButton onClick={onRetry}>Reintentar</PillButton>
    </div>
  );
}

export interface ToastMsg {
  text: string;
  tone: 'ok' | 'error';
  key: number;
}

/** Toast oscuro abajo al centro (2.6 s). */
export function AdminToast({ toast, onDone }: { toast: ToastMsg | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-7 z-50 flex justify-center px-4">
      <div
        key={toast.key}
        className="flex animate-pop items-center gap-2.5 rounded-[14px] bg-ink-900 px-[18px] py-3 text-[14.5px] font-semibold text-white shadow-[0_10px_30px_rgba(13,31,54,0.3)] dark:bg-ink-700"
      >
        <span aria-hidden className={toast.tone === 'ok' ? 'font-extrabold text-success' : 'font-extrabold text-warning'}>
          {toast.tone === 'ok' ? '✓' : '!'}
        </span>
        {toast.text}
      </div>
    </div>
  );
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Algo salió mal.', status: res.status };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta de nuevo.', status: 0 };
  }
}
