'use client';

// La clave personal con la que el atajo de Apple Pay o MacroDroid (Android)
// registran pagos: se muestra una sola vez, se copia y se puede revocar.
// La usan Mis cuentas › Apple Pay y Mis cuentas › Android (C15).

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Loader2 } from 'lucide-react';
import { UndoToast } from '@/components/transactions/UndoToast';
import type { StatusMessage } from '@/components/movimientos/StatusToast';
import { tokenSummary } from '@/lib/apple-pay';
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';

interface TokenRow {
  id: string;
  created_at: string;
  last_used_at: string | null;
}

interface ClaveAtajoProps {
  /** "el atajo" o "MacroDroid": quién usa la clave. */
  usadaPor: string;
  /** Ruta de esta pantalla, para volver después de iniciar sesión. */
  path: string;
  /** La clave recién creada (solo existe mientras no se sale de la pantalla). */
  fresh: string | null;
  onFresh: (token: string | null) => void;
  onMessage: (m: StatusMessage) => void;
}

export function ClaveAtajo({ usadaPor, path, fresh, onFresh, onMessage }: ClaveAtajoProps) {
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [undo, setUndo] = useState<TokenRow | null>(null);

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/shortcut-tokens', { cache: 'no-store' });
      if (res.status === 401) { router.push(`/login?next=${path}`); return; }
      const data = await res.json();
      setTokens((data.tokens ?? []) as TokenRow[]);
      setUnavailable(!!data.unavailable || !res.ok);
    } catch {
      setTokens([]);
      setUnavailable(true);
    }
  }, [router, path]);

  useEffect(() => { void loadTokens(); }, [loadTokens]);

  async function createToken() {
    setCreating(true);
    try {
      const res = await fetch('/api/shortcut-tokens', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'No pudimos crear la clave.');
      onFresh(data.token as string);
      setCopied(false);
      await loadTokens();
    } catch (e) {
      onMessage({ text: e instanceof Error ? e.message : 'No pudimos crear la clave.', tone: 'error' });
    }
    setCreating(false);
  }

  async function copyToken() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
      onMessage({ text: `Clave copiada. Pégala en ${usadaPor}.`, tone: 'ok' });
    } catch {
      onMessage({ text: 'No pudimos copiarla: selecciónala y cópiala a mano.', tone: 'error' });
    }
  }

  async function revoke(t: TokenRow) {
    setTokens((prev) => prev?.filter((x) => x.id !== t.id) ?? prev);
    const res = await fetch(`/api/shortcut-tokens/${t.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      onMessage({ text: 'No pudimos revocar la clave. Intenta de nuevo.', tone: 'error' });
      void loadTokens();
      return;
    }
    onFresh(null);
    setUndo(t);
  }

  async function undoRevoke() {
    const t = undo;
    setUndo(null);
    if (!t) return;
    const res = await fetch(`/api/shortcut-tokens/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    }).catch(() => null);
    if (!res?.ok) onMessage({ text: 'Ya no se puede deshacer. Genera una clave nueva.', tone: 'error' });
    void loadTokens();
  }

  const dismissUndo = useCallback(() => setUndo(null), []);
  const now = Date.now();

  return (
    <section className="mt-5 flex flex-col gap-3 rounded-[18px] border border-[var(--zafi-border)] bg-[var(--zafi-card)] p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className={`text-[15px] font-bold ${TEXT_STRONG}`}>Tu clave para {usadaPor}</h2>
        <p className={`text-[13.5px] leading-[1.4] ${TEXT_MUTED}`}>
          Con ella {usadaPor} registra tus pagos en tu cuenta. No la compartas. Sirve igual para Apple Pay y Android.
        </p>
      </div>

      {fresh && (
        <div className="flex flex-col gap-2 rounded-[14px] bg-warning-light p-3 dark:bg-warning/15">
          <code className="select-all break-all font-mono text-[13px] text-ink-900 dark:text-ink-100" aria-label="Tu clave nueva">
            {fresh}
          </code>
          <button
            type="button"
            onClick={copyToken}
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-electric text-sm font-bold text-white transition-transform active:scale-[0.97]"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Copiada' : 'Copiar clave'}
          </button>
          <p className="text-[12.5px] text-warning-text dark:text-warning">
            Pégala ahora en {usadaPor}: por seguridad no la volveremos a mostrar.
          </p>
        </div>
      )}

      {tokens === null ? (
        <span className={`text-sm ${TEXT_MUTED}`}>Cargando…</span>
      ) : unavailable ? (
        <p className={`text-sm ${TEXT_MUTED}`}>Las claves todavía no están disponibles. Intenta más tarde.</p>
      ) : (
        <>
          {tokens.length > 0 && (
            <ul className="flex flex-col">
              {tokens.map((t, i) => (
                <li
                  key={t.id}
                  className={`flex min-h-[52px] items-center gap-3 ${i < tokens.length - 1 ? 'border-b border-[var(--zafi-border-light)]' : ''}`}
                >
                  <span aria-hidden className="text-lg">🔑</span>
                  <span className={`flex-1 text-[13.5px] ${TEXT_STRONG}`}>{tokenSummary(t, now)}</span>
                  <button
                    type="button"
                    onClick={() => revoke(t)}
                    className="h-9 rounded-full px-3 text-[13.5px] font-semibold text-danger transition-transform active:scale-95"
                  >
                    Revocar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={createToken}
            disabled={creating}
            className={`flex h-11 items-center justify-center gap-2 rounded-full border border-ink-200 text-sm font-semibold transition-transform active:scale-[0.97] disabled:opacity-60 dark:border-white/15 ${TEXT_STRONG}`}
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {tokens.length > 0 ? 'Generar otra clave' : 'Generar mi clave'}
          </button>
        </>
      )}

      <UndoToast
        visible={!!undo}
        title="Clave revocada"
        subtitle={`${usadaPor.charAt(0).toUpperCase()}${usadaPor.slice(1)} dejará de registrar tus pagos`}
        onUndo={undoRevoke}
        onDismiss={dismissUndo}
        duration={6000}
      />
    </section>
  );
}
