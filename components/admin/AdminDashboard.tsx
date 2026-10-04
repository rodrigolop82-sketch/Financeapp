'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ResumenTab } from './ResumenTab';
import { RetencionTab } from './RetencionTab';
import { ReactivarTab } from './ReactivarTab';
import { FeedbackTab } from './FeedbackTab';
import { AdminToast, type ToastMsg } from './ui';

type Tab = 'resumen' | 'ret' | 'inact' | 'fb';

const TABS: { key: Tab; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'ret', label: 'Retención' },
  { key: 'inact', label: 'Para reactivar' },
  { key: 'fb', label: 'Feedback' },
];

function tabFromHash(): Tab {
  if (typeof window === 'undefined') return 'resumen';
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.key === h) ? (h as Tab) : 'resumen';
}

/**
 * Panel de admin (fase 12): barra navy con pestañas y una vista por pestaña.
 * Las pestañas visitadas quedan montadas (ocultas) para no recargar sus datos.
 */
export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('resumen');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(['resumen']));
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<ToastMsg | null>(null);

  useEffect(() => {
    const t = tabFromHash();
    setTab(t);
    setVisited((v) => new Set(v).add(t));
  }, []);

  const go = useCallback((t: Tab) => {
    setTab(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
    window.history.replaceState(null, '', t === 'resumen' ? window.location.pathname : `#${t}`);
    window.scrollTo({ top: 0 });
  }, []);

  const showToast = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => setToast({ text, tone, key: Date.now() }), []);
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--zafi-bg)' }}>
      <header className="sticky top-0 z-20 bg-navy-deep text-white">
        <div className="mx-auto flex min-h-16 max-w-[1240px] items-center gap-5 px-6 max-sm:gap-3 max-sm:px-4">
          <Link href="/dashboard" className="flex flex-none items-center gap-2.5" aria-label="Volver a Zafi">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/10 bg-navy font-outfit text-[19px] font-extrabold">
              Z
            </span>
            <span className="whitespace-nowrap text-base font-bold max-sm:hidden">Zafi · Admin</span>
          </Link>
          <nav
            role="tablist"
            aria-label="Secciones del admin"
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => go(t.key)}
                  className={`flex h-10 flex-none items-center gap-2 whitespace-nowrap rounded-[10px] px-3.5 text-[14.5px] font-semibold transition-colors ${
                    active ? 'bg-electric-pale/20 text-white' : 'text-[#CBD8E8] hover:text-white'
                  }`}
                >
                  {t.label}
                  {t.key === 'fb' && unread > 0 && (
                    <span
                      aria-label={`${unread} sin leer`}
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-extrabold text-ink-900"
                    >
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <span
            className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full bg-success/15 px-3 py-1.5 text-[13px] font-semibold text-success-light"
            title="Solo conteos: nunca se muestran montos de movimientos"
          >
            🔒<span className="max-sm:hidden"> Datos agregados</span>
          </span>
        </div>
      </header>

      <main className="mx-auto box-border flex w-full max-w-[1240px] flex-col gap-5 px-6 pb-[60px] pt-7 max-sm:px-4">
        {visited.has('resumen') && (
          <div hidden={tab !== 'resumen'}>
            <ResumenTab onGo={go} onUnread={setUnread} />
          </div>
        )}
        {visited.has('ret') && (
          <div hidden={tab !== 'ret'}>
            <RetencionTab />
          </div>
        )}
        {visited.has('inact') && (
          <div hidden={tab !== 'inact'}>
            <ReactivarTab toast={showToast} />
          </div>
        )}
        {visited.has('fb') && (
          <div hidden={tab !== 'fb'}>
            <FeedbackTab toast={showToast} onUnread={setUnread} />
          </div>
        )}
      </main>

      <AdminToast toast={toast} onDone={clearToast} />
    </div>
  );
}
