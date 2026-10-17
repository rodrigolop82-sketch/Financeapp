'use client';

// Mis cuentas › Android (C15): dos formas de que los avisos del banco
// lleguen a Zafi. 1) Compartir a Zafi (Web Share Target del manifest).
// 2) Automático con MacroDroid/Tasker, con la misma clave personal del
// atajo de Apple Pay (POST /api/parse-notification, source 'android').

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';
import { ClaveAtajo } from '@/components/fuentes/ClaveAtajo';
import { BADGE_INFO, BADGE_NEUTRAL } from '@/components/layout/Pantalla';
import { MACRODROID_BODY, PASOS_COMPARTIR, PASOS_MACRODROID } from '@/lib/android';
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';

const CARD = 'rounded-[18px] border border-[var(--zafi-border)] bg-[var(--zafi-card)]';

function Pasos({ pasos }: { pasos: { title: string; detail: string }[] }) {
  return (
    <ol className={`${CARD} px-4 py-1.5`}>
      {pasos.map((p, i) => (
        <li key={p.title} className={`flex items-start gap-3 py-3 ${i < pasos.length - 1 ? 'border-b border-[var(--zafi-border-light)]' : ''}`}>
          <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-electric-ghost text-sm font-extrabold text-electric-dark dark:bg-electric/20 dark:text-electric-soft">
            {i + 1}
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>{p.title}</span>
            <span className={`text-[13.5px] leading-[1.4] ${TEXT_MUTED}`}>{p.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function AndroidPage() {
  const router = useRouter();
  const [fresh, setFresh] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [endpoint, setEndpoint] = useState('/api/parse-notification');

  useEffect(() => { setEndpoint(`${window.location.origin}/api/parse-notification`); }, []);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ text: `${what} copiado.`, tone: 'ok' });
    } catch {
      setMessage({ text: 'No pudimos copiarlo: selecciónalo y cópialo a mano.', tone: 'error' });
    }
  }

  /** Un aviso de prueba por el mismo camino que MacroDroid (con la clave recién creada). */
  async function testNotice() {
    if (!fresh) return;
    setTesting(true);
    try {
      const res = await fetch('/api/parse-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${fresh}` },
        body: 'Zafi: Compra aprobada por Q1.00 en PRUEBA DE ANDROID',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'La prueba no funcionó.');
      if (!data.id) throw new Error(data?.message || 'La prueba no registró nada.');
      router.push(`/transacciones?applepay=${data.id}`);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'La prueba no funcionó.', tone: 'error' });
      setTesting(false);
    }
  }

  const clearMessage = useCallback(() => setMessage(null), []);

  const config: { label: string; value: string }[] = [
    { label: 'Dirección (POST)', value: endpoint },
    { label: 'Encabezado', value: `Authorization: Bearer ${fresh ?? 'tu clave'}` },
    { label: 'Tipo de contenido', value: 'text/plain' },
    { label: 'Cuerpo', value: MACRODROID_BODY },
  ];

  return (
    <AppShell title="Android" currentPath="/mis-fuentes" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col pb-10 lg:mx-0 zafi-stagger">
        <div className="-mx-4 flex flex-col items-start gap-0.5 px-5 pt-[env(safe-area-inset-top)]">
          <Link href="/mis-fuentes" className="flex h-11 items-center text-[15px] font-semibold text-electric-dark dark:text-electric-soft">
            ‹ Mis cuentas
          </Link>
          <h1 className={`font-serif text-[30px] leading-[1.15] ${TEXT_STRONG}`}>Android</h1>
          <p className={`text-[14.5px] leading-[1.45] ${TEXT_MUTED}`}>
            Dos formas de que los avisos de tu banco lleguen a Zafi. Puedes usar una o las dos.
          </p>
        </div>

        {/* 1 · Compartir */}
        <div className="mt-5 flex items-center gap-2 px-1">
          <h2 className={`text-[17px] font-bold ${TEXT_STRONG}`}>Compartir a Zafi</h2>
          <span className={BADGE_NEUTRAL}>Sin configurar nada</span>
        </div>
        <p className={`mb-2.5 mt-0.5 px-1 text-[13.5px] leading-[1.4] ${TEXT_MUTED}`}>
          Tú decides qué compartir. Cada gasto se confirma antes de guardarlo.
        </p>
        <Pasos pasos={PASOS_COMPARTIR} />
        <Link
          href="/notificacion"
          className={`mt-3 flex h-[46px] items-center justify-center rounded-full border border-ink-200 bg-[var(--zafi-card)] text-[14.5px] font-semibold no-underline transition-transform active:scale-[0.97] dark:border-white/15 ${TEXT_STRONG}`}
        >
          Pegar una notificación
        </Link>

        {/* 2 · Automático */}
        <div className="mt-7 flex items-center gap-2 px-1">
          <h2 className={`text-[17px] font-bold ${TEXT_STRONG}`}>Automático con MacroDroid</h2>
          <span className={BADGE_INFO}>Avanzado</span>
        </div>
        <p className={`mb-2.5 mt-0.5 px-1 text-[13.5px] leading-[1.4] ${TEXT_MUTED}`}>
          Cada aviso de compra de tu banco se registra solo y te llega un aviso de Zafi para confirmar la categoría. Con Tasker funciona igual.
        </p>
        <Pasos pasos={PASOS_MACRODROID} />

        <section className={`mt-3 flex flex-col ${CARD} px-4 py-1.5`} aria-label="Datos para la solicitud HTTP">
          {config.map((c, i) => (
            <div key={c.label} className={`flex items-center gap-3 py-2.5 ${i < config.length - 1 ? 'border-b border-[var(--zafi-border-light)]' : ''}`}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-[12.5px] ${TEXT_MUTED}`}>{c.label}</span>
                <code className={`select-all break-all font-mono text-[13px] ${TEXT_STRONG}`}>{c.value}</code>
              </span>
              <button
                type="button"
                onClick={() => copy(c.value, c.label)}
                aria-label={`Copiar ${c.label}`}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-electric-dark transition-transform active:scale-95 dark:text-electric-soft"
              >
                <Copy className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </section>

        <ClaveAtajo usadaPor="MacroDroid" path="/mis-fuentes/android" fresh={fresh} onFresh={setFresh} onMessage={setMessage} />

        <button
          type="button"
          onClick={testNotice}
          disabled={!fresh || testing}
          className={`mt-3.5 flex h-[46px] items-center justify-center gap-2 rounded-full border border-ink-200 bg-[var(--zafi-card)] text-[14.5px] font-semibold transition-transform active:scale-[0.97] disabled:opacity-60 dark:border-white/15 ${TEXT_STRONG}`}
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <span aria-hidden>▶</span>}
          Probar con un aviso
        </button>
        {!fresh && (
          <p className={`mt-1.5 px-2 text-center text-[13px] ${TEXT_MUTED}`}>
            Para probar, genera tu clave. Registraremos un gasto de prueba de Q 1.00.
          </p>
        )}

        <div className="mt-3.5 rounded-[14px] bg-ink-100 px-3.5 py-3 text-[13.5px] leading-[1.4] text-ink-700 dark:bg-white/10 dark:text-ink-200">
          <b>Tu privacidad:</b> Zafi solo recibe los avisos de las apps que elijas en MacroDroid. El texto se lee con IA para sacar el monto y el comercio, y no se guarda. Los avisos sin monto o de ingresos no registran nada.
        </div>
      </div>

      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  );
}
