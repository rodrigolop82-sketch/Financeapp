'use client';

// Hoja "¿Te avisamos lo importante?" (fase 13.1). Se monta una vez en
// AppShell. Se abre:
// - tras guardar un gasto (evento EXPENSE_SAVED_EVENT de la hoja de agregar),
//   si lib/push-offer.ts dice que toca (primera vez, o una vez más a los 14
//   días de "Ahora no");
// - desde Mi cuenta › Recordatorios con openPushOffer().
// En iPhone sin instalar muestra antes "Agrega Zafi a tu pantalla de inicio".

import { useCallback, useEffect, useState } from 'react';
import { Share } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { Switch } from '@/components/cuenta/AccountUI';
import { SuccessCheck } from '@/components/motion/SuccessCheck';
import { getPlatformContext } from '@/lib/platform-detection';
import { enablePush, getPushStatus } from '@/lib/push-client';
import { saveNotificationPrefs } from '@/lib/notification-prefs';
import {
  AVISO_TYPES, DEFAULT_SWITCHES, decideOffer, enabledCountText, markAnswered, markOffered, parseOfferState,
  type AvisoSwitches, type OfferAnswer, type OfferState, type OfferTrigger,
} from '@/lib/push-offer';
import type { PushStatus } from '@/lib/push-status';
import { PRIMARY_BUTTON, SOFT_BG, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';

/** Lo emite la hoja de agregar cuando se cierra el toast de un gasto guardado (sin "Deshacer"). */
export const EXPENSE_SAVED_EVENT = 'zafi:expense-saved';
const OPEN_EVENT = 'zafi:open-push-offer';
/** Lo emite esta hoja cuando cambia el estado de los avisos (Mi cuenta lo escucha). */
export const PUSH_STATUS_EVENT = 'zafi:push-status';

const STORAGE_KEY = 'zafi:push-offer';

/** Abre la hoja desde Mi cuenta (o cualquier pantalla con AppShell). */
export function openPushOffer() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function readState(): OfferState {
  try { return parseOfferState(localStorage.getItem(STORAGE_KEY)); } catch { return parseOfferState(null); }
}

function writeState(s: OfferState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* modo privado: no se recuerda */ }
}

type Stage = 'install' | 'ask' | 'done';

export function PushOfferSheet() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('ask');
  const [trigger, setTrigger] = useState<OfferTrigger>('manual');
  const [switches, setSwitches] = useState<AvisoSwitches>(DEFAULT_SWITCHES);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OfferAnswer | null>(null);
  /** "Ahora no" en la primera oferta automática: se vuelve a ofrecer en 14 días. */
  const [willReoffer, setWillReoffer] = useState(false);

  const offer = useCallback(async (t: OfferTrigger) => {
    let status: PushStatus;
    try { status = await getPushStatus(); } catch { status = 'unsupported'; }
    const state = readState();
    const sheet = decideOffer({ trigger: t, status, isIOS: getPlatformContext().os === 'ios', state, now: Date.now() });
    if (sheet === 'none') return false;
    writeState(markOffered(state, t, Date.now()));

    // Los switches arrancan con lo guardado (o los valores por defecto).
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
        if (data) {
          const next = { ...DEFAULT_SWITCHES };
          for (const k of Object.keys(next) as (keyof AvisoSwitches)[]) {
            if (typeof data[k] === 'boolean') next[k] = data[k];
          }
          setSwitches(next);
        }
      }
    } catch { /* se quedan los valores por defecto */ }

    setTrigger(t);
    setResult(null);
    setStage(sheet === 'install' ? 'install' : 'ask');
    setOpen(true);
    return true;
  }, []);

  useEffect(() => {
    // La hoja de agregar avisa cuando se cierra el toast de "Guardado"; un respiro y se ofrece.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSaved = () => { clearTimeout(timer); timer = setTimeout(() => { void offer('expense-saved'); }, 400); };
    const onOpen = () => { void offer('manual'); };
    window.addEventListener(EXPENSE_SAVED_EVENT, onSaved);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(EXPENSE_SAVED_EVENT, onSaved);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [offer]);

  const answer = useCallback((a: OfferAnswer) => {
    writeState(markAnswered(readState(), a));
  }, []);

  const close = useCallback(() => {
    // Cerrar sin elegir cuenta como "Ahora no".
    if (stage !== 'done' && trigger === 'expense-saved') answer('later');
    setOpen(false);
  }, [stage, trigger, answer]);

  async function activate() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await saveNotificationPrefs(supabase, user.id, switches);
    } catch { /* las preferencias se pueden cambiar luego en Mi cuenta */ }
    const status = await enablePush().catch((): PushStatus => 'off');
    setBusy(false);
    const a: OfferAnswer = status === 'on' ? 'enabled' : status === 'denied' ? 'denied' : 'later';
    answer(a);
    setResult(a);
    setStage('done');
    navigator.vibrate?.(status === 'on' ? 15 : 8);
    window.dispatchEvent(new CustomEvent<PushStatus>(PUSH_STATUS_EVENT, { detail: status }));
  }

  function later() {
    setWillReoffer(trigger === 'expense-saved' && readState().offers < 2);
    answer('later');
    setResult('later');
    setStage('done');
  }

  return (
    <BottomSheet themed open={open} onClose={close} label="Avisos en el teléfono">
      <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {stage === 'install' && (
          <>
            <div className="flex h-[60px] w-[60px] items-center justify-center self-center rounded-[18px] bg-electric-ghost text-[30px] dark:bg-electric/20" aria-hidden>
              📲
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 tabIndex={-1} className={`text-[20px] font-bold outline-none ${TEXT_STRONG}`}>Agrega Zafi a tu pantalla de inicio</h2>
              <p className={`max-w-[310px] text-[14.5px] leading-[1.45] ${TEXT_MUTED}`}>
                En iPhone los avisos solo llegan si Zafi está en tu pantalla de inicio. Toma 10 segundos.
              </p>
            </div>
            <ol className={`flex flex-col rounded-2xl px-3.5 ${SOFT_BG}`}>
              {[
                <>Toca <Share className="inline h-4 w-4 -translate-y-px text-electric" aria-label="Compartir" /> <b>Compartir</b> abajo en Safari.</>,
                <>Elige <b>Agregar a inicio</b> y toca <b>Agregar</b>.</>,
                <>Abre Zafi desde tu pantalla de inicio y activa los avisos en <b>Mi cuenta › Recordatorios</b>.</>,
              ].map((text, i) => (
                <li key={i} className={`flex items-start gap-3 py-3 ${i < 2 ? 'border-b border-[var(--zafi-border-light)]' : ''}`}>
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-electric-ghost text-sm font-extrabold text-electric-dark dark:bg-electric/20 dark:text-electric-soft">
                    {i + 1}
                  </span>
                  <span className={`text-[14.5px] leading-[1.4] ${TEXT_STRONG}`}>{text}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={close} className={PRIMARY_BUTTON + ' rounded-full'}>Entendido</button>
          </>
        )}

        {stage === 'ask' && (
          <>
            <div className="flex h-[60px] w-[60px] items-center justify-center self-center rounded-[18px] bg-electric-ghost text-[30px] dark:bg-electric/20">
              <span className="inline-block animate-bell" aria-hidden>🔔</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 tabIndex={-1} className={`text-[20px] font-bold outline-none ${TEXT_STRONG}`}>¿Te avisamos lo importante?</h2>
              <p className={`max-w-[300px] text-[14.5px] leading-[1.45] ${TEXT_MUTED}`}>
                Solo lo que te ayuda a no pasarte. Máximo un aviso al día; tú eliges cuáles.
              </p>
            </div>
            <div className={`rounded-2xl px-3.5 ${SOFT_BG}`}>
              {AVISO_TYPES.map((t, i) => (
                <div
                  key={t.key}
                  className={`flex items-center gap-3 py-[11px] ${i < AVISO_TYPES.length - 1 ? 'border-b border-[var(--zafi-border)]' : ''}`}
                >
                  <span className="text-lg" aria-hidden>{t.emoji}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[14.5px] font-semibold ${TEXT_STRONG}`}>{t.name}</span>
                    <span className={`text-[12.5px] ${TEXT_MUTED}`}>{t.hint}</span>
                  </span>
                  <Switch
                    checked={switches[t.key]}
                    label={t.name}
                    onChange={(v) => setSwitches((s) => ({ ...s, [t.key]: v }))}
                  />
                </div>
              ))}
            </div>
            <button type="button" onClick={activate} disabled={busy} className={PRIMARY_BUTTON + ' rounded-full font-bold'}>
              {busy ? 'Activando…' : 'Activar avisos'}
            </button>
            <button type="button" onClick={later} disabled={busy} className={`h-11 text-sm font-semibold ${TEXT_MUTED}`}>
              Ahora no
            </button>
          </>
        )}

        {stage === 'done' && (
          <div className="flex flex-col items-center gap-3 pt-4 text-center" role="status">
            {result === 'enabled' ? (
              <SuccessCheck size={84} />
            ) : (
              <div className="flex h-[84px] w-[84px] animate-pop items-center justify-center rounded-full bg-ink-100 text-4xl dark:bg-white/10" aria-hidden>
                🔕
              </div>
            )}
            <h2 tabIndex={-1} className={`animate-fade-up text-[20px] font-bold outline-none [animation-delay:.4s] ${TEXT_STRONG}`}>
              {result === 'enabled' ? 'Listo, te avisaremos' : 'Sin problema'}
            </h2>
            <p className={`max-w-[290px] animate-fade-up text-[14.5px] leading-[1.45] [animation-delay:.5s] ${TEXT_MUTED}`}>
              {result === 'enabled'
                ? `${enabledCountText(switches)} Puedes cambiarlos en Mi cuenta › Recordatorios.`
                : result === 'denied'
                  ? 'Si cambias de idea, actívalos en los ajustes del teléfono.'
                  : willReoffer
                    ? 'Puedes activarlos cuando quieras desde Mi cuenta. Te lo recordaremos una sola vez en 2 semanas.'
                    : 'Puedes activarlos cuando quieras desde Mi cuenta.'}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 h-[46px] animate-fade-up rounded-full bg-electric px-[26px] text-[15px] font-bold text-white transition-transform [animation-delay:.6s] active:scale-[0.96]"
            >
              Listo
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
