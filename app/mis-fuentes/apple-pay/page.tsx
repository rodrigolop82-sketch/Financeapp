'use client';

// Mis bancos › Apple Pay (fase 13.3): cómo conectar el atajo de iOS, la
// clave personal (se muestra una sola vez; se puede revocar) y "Probar con
// un pago". Los pasos para construir y publicar el atajo están en
// docs/apple-pay-atajo.md.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, Loader2 } from 'lucide-react';
import { localToday } from '@/lib/dates';
import { AppShell } from '@/components/layout/AppShell';
import { UndoToast } from '@/components/transactions/UndoToast';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';
import { SHORTCUT_STEPS, tokenSummary } from '@/lib/apple-pay';
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';

const SHORTCUT_URL = process.env.NEXT_PUBLIC_APPLE_PAY_SHORTCUT_URL || '';
const STEPS_KEY = 'zafi:applepay-steps';

interface TokenRow {
  id: string;
  created_at: string;
  last_used_at: string | null;
}

function readSteps(): boolean[] {
  try {
    const v = JSON.parse(localStorage.getItem(STEPS_KEY) || '[]');
    return SHORTCUT_STEPS.map((_, i) => v?.[i] === true);
  } catch {
    return SHORTCUT_STEPS.map(() => false);
  }
}

export default function ApplePayPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<boolean[]>(() => SHORTCUT_STEPS.map(() => false));
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [undo, setUndo] = useState<TokenRow | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/shortcut-tokens', { cache: 'no-store' });
      if (res.status === 401) { router.push('/login?next=/mis-fuentes/apple-pay'); return; }
      const data = await res.json();
      setTokens((data.tokens ?? []) as TokenRow[]);
      setUnavailable(!!data.unavailable || !res.ok);
    } catch {
      setTokens([]);
      setUnavailable(true);
    }
  }, [router]);

  useEffect(() => {
    setSteps(readSteps());
    void loadTokens();
  }, [loadTokens]);

  function toggleStep(i: number) {
    setSteps((prev) => {
      const next = prev.map((v, j) => (j === i ? !v : v));
      try { localStorage.setItem(STEPS_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
      return next;
    });
  }

  async function createToken() {
    setCreating(true);
    try {
      const res = await fetch('/api/shortcut-tokens', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'No pudimos crear la clave.');
      setFresh(data.token as string);
      setCopied(false);
      await loadTokens();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'No pudimos crear la clave.', tone: 'error' });
    }
    setCreating(false);
  }

  async function copyToken() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
      setMessage({ text: 'Clave copiada. Pégala en el atajo.', tone: 'ok' });
    } catch {
      setMessage({ text: 'No pudimos copiarla: selecciónala y cópiala a mano.', tone: 'error' });
    }
  }

  async function revoke(t: TokenRow) {
    setTokens((prev) => prev?.filter((x) => x.id !== t.id) ?? prev);
    const res = await fetch(`/api/shortcut-tokens/${t.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      setMessage({ text: 'No pudimos revocar la clave. Intenta de nuevo.', tone: 'error' });
      void loadTokens();
      return;
    }
    setFresh(null);
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
    if (!res?.ok) setMessage({ text: 'Ya no se puede deshacer. Genera una clave nueva.', tone: 'error' });
    void loadTokens();
  }

  /** Un gasto de prueba por el mismo camino que el atajo (con la clave recién creada). */
  async function testPayment() {
    if (!fresh) return;
    setTesting(true);
    try {
      const res = await fetch('/api/parse-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh}` },
        body: JSON.stringify({ amount: '1.00', merchant: 'Prueba de Apple Pay', card: 'Prueba', date: localToday() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'La prueba no funcionó.');
      router.push(`/transacciones?applepay=${data.id}`);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'La prueba no funcionó.', tone: 'error' });
      setTesting(false);
    }
  }

  const dismissUndo = useCallback(() => setUndo(null), []);
  const clearMessage = useCallback(() => setMessage(null), []);
  const now = Date.now();

  return (
    <AppShell title="Apple Pay" currentPath="/mis-fuentes" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col pb-10 lg:mx-0 zafi-stagger">
        <div className="-mx-4 flex flex-col items-start gap-0.5 px-5 pt-[env(safe-area-inset-top)]">
          <Link href="/mis-fuentes" className="flex h-11 items-center text-[15px] font-semibold text-electric-dark dark:text-electric-soft">
            ‹ Mis bancos
          </Link>
          <h1 className={`font-serif text-[30px] leading-[1.15] ${TEXT_STRONG}`}>Apple Pay</h1>
          <p className={`text-[14.5px] leading-[1.45] ${TEXT_MUTED}`}>
            Cada vez que pagues con el iPhone, el gasto llega solo a Zafi. Solo tienes que confirmar la categoría.
          </p>
        </div>

        {/* Pasos */}
        <ol className="mt-4 rounded-[18px] border border-[var(--zafi-border)] bg-[var(--zafi-card)] px-4 py-1.5">
          {SHORTCUT_STEPS.map((st, i) => {
            const done = steps[i];
            return (
              <li key={st.title} className={i < SHORTCUT_STEPS.length - 1 ? 'border-b border-[var(--zafi-border-light)]' : ''}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  onClick={() => toggleStep(i)}
                  className="flex w-full items-start gap-3 py-3 text-left"
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-extrabold transition-all duration-[250ms] ease-spring ${
                      done
                        ? 'scale-[1.08] bg-success-dark text-white'
                        : 'bg-electric-ghost text-electric-dark dark:bg-electric/20 dark:text-electric-soft'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>{st.title}</span>
                    <span className={`text-[13.5px] leading-[1.4] ${TEXT_MUTED}`}>{st.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-3.5 flex flex-col gap-2">
          {SHORTCUT_URL ? (
            <a
              href={SHORTCUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[50px] items-center justify-center rounded-full bg-ink-900 text-[15px] font-bold text-white no-underline transition-transform active:scale-[0.97] dark:bg-white dark:text-ink-900"
            >
              Instalar el atajo de Zafi
            </a>
          ) : (
            <>
              <button
                type="button"
                disabled
                className="h-[50px] rounded-full bg-ink-900 text-[15px] font-bold text-white opacity-50 dark:bg-white dark:text-ink-900"
              >
                Instalar el atajo de Zafi
              </button>
              <p className={`px-2 text-center text-[13px] ${TEXT_MUTED}`}>
                El atajo todavía no está publicado. Mientras tanto, créalo con los pasos de arriba.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={testPayment}
            disabled={!fresh || testing}
            className={`flex h-[46px] items-center justify-center gap-2 rounded-full border border-ink-200 bg-[var(--zafi-card)] text-[14.5px] font-semibold transition-transform active:scale-[0.97] disabled:opacity-60 dark:border-white/15 ${TEXT_STRONG}`}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <span aria-hidden>▶</span>}
            Probar con un pago
          </button>
          {!fresh && (
            <p className={`px-2 text-center text-[13px] ${TEXT_MUTED}`}>
              Para probar, genera tu clave abajo. Registraremos un gasto de prueba de Q 1.00.
            </p>
          )}
        </div>

        {/* Clave personal */}
        <section className="mt-5 flex flex-col gap-3 rounded-[18px] border border-[var(--zafi-border)] bg-[var(--zafi-card)] p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className={`text-[15px] font-bold ${TEXT_STRONG}`}>Tu clave para el atajo</h2>
            <p className={`text-[13.5px] leading-[1.4] ${TEXT_MUTED}`}>
              El atajo la usa para registrar tus pagos en tu cuenta. No la compartas.
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
                Pégala ahora en el atajo: por seguridad no la volveremos a mostrar.
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
        </section>

        <div className="mt-3.5 rounded-[14px] bg-ink-100 px-3.5 py-3 text-[13.5px] leading-[1.4] text-ink-700 dark:bg-white/10 dark:text-ink-200">
          <b>Android:</b> llega en una siguiente etapa. Leer los pagos de Google Wallet requiere una app nativa.
        </div>
      </div>

      <UndoToast
        visible={!!undo}
        title="Clave revocada"
        subtitle="El atajo dejará de registrar tus pagos"
        onUndo={undoRevoke}
        onDismiss={dismissUndo}
        duration={6000}
      />
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  );
}
