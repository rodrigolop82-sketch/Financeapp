// Cuándo ofrecer los avisos (fase 13.1). Puro: el estado vive en
// localStorage (lib/push-offer-storage.ts) y el componente
// components/avisos/PushOfferSheet.tsx muestra la hoja que esto decide.
//
// - Nunca al abrir la app: solo tras guardar un gasto o desde Mi cuenta.
// - Primera vez: el primer gasto guardado.
// - "Ahora no" → se vuelve a ofrecer una sola vez, 14 días después.
// - Si los activó o los bloqueó en el sistema, no se vuelve a ofrecer solo.
// - iPhone sin instalar (no standalone): antes, "Agrega Zafi a tu pantalla
//   de inicio" (en iOS los avisos solo funcionan con la app instalada).

import type { PushStatus } from './push-status';

export const REOFFER_AFTER_MS = 14 * 86_400_000;
/** Ofertas automáticas como máximo: la primera y una más. */
export const MAX_AUTO_OFFERS = 2;

export type OfferAnswer = 'later' | 'enabled' | 'denied';

export interface OfferState {
  /** Veces que se ofreció solo (tras un gasto). */
  offers: number;
  /** Última vez (ms) que se ofreció. */
  lastOfferAt: number | null;
  /** Última respuesta. */
  answer: OfferAnswer | null;
}

export const EMPTY_OFFER_STATE: OfferState = { offers: 0, lastOfferAt: null, answer: null };

export type OfferTrigger = 'expense-saved' | 'manual';

/** Qué hoja abrir: nada, la de instalar (iPhone) o la de permisos. */
export type OfferSheet = 'none' | 'install' | 'permission';

export interface OfferInput {
  trigger: OfferTrigger;
  status: PushStatus;
  isIOS: boolean;
  state: OfferState;
  now: number;
}

/** ¿Toca ofrecer solo? (ignora la plataforma). */
export function autoOfferDue(state: OfferState, now: number): boolean {
  if (state.answer === 'enabled' || state.answer === 'denied') return false;
  if (state.offers <= 0) return true;
  if (state.offers >= MAX_AUTO_OFFERS) return false;
  return state.answer === 'later' && state.lastOfferAt !== null && now - state.lastOfferAt >= REOFFER_AFTER_MS;
}

export function decideOffer({ trigger, status, isIOS, state, now }: OfferInput): OfferSheet {
  // Sin soporte (o sin llave VAPID), ya activos o bloqueados: nada que ofrecer.
  if (status === 'unsupported' || status === 'on' || status === 'denied') return 'none';
  if (trigger === 'expense-saved' && !autoOfferDue(state, now)) return 'none';
  if (status === 'needs-install') return isIOS ? 'install' : 'none';
  return 'permission';
}

/** Estado tras mostrar una oferta automática. */
export function markOffered(state: OfferState, trigger: OfferTrigger, now: number): OfferState {
  if (trigger !== 'expense-saved') return state;
  return { ...state, offers: state.offers + 1, lastOfferAt: now };
}

/** Estado tras la respuesta (cerrar la hoja sin elegir cuenta como "Ahora no"). */
export function markAnswered(state: OfferState, answer: OfferAnswer): OfferState {
  return { ...state, answer };
}

export function parseOfferState(raw: string | null): OfferState {
  if (!raw) return EMPTY_OFFER_STATE;
  try {
    const v = JSON.parse(raw) as Partial<OfferState>;
    const answer = v.answer === 'later' || v.answer === 'enabled' || v.answer === 'denied' ? v.answer : null;
    return {
      offers: Number.isFinite(v.offers) ? Math.max(0, Number(v.offers)) : 0,
      lastOfferAt: Number.isFinite(v.lastOfferAt) ? Number(v.lastOfferAt) : null,
      answer,
    };
  } catch {
    return EMPTY_OFFER_STATE;
  }
}

// ── Tipos de aviso de la hoja ──────────────────────────

export type AvisoPrefKey = 'due_enabled' | 'cap_enabled' | 'inactivity_enabled' | 'month_close_enabled' | 'income_enabled';

export const AVISO_TYPES: { key: AvisoPrefKey; emoji: string; name: string; hint: string }[] = [
  { key: 'due_enabled', emoji: '📅', name: 'Pagos por vencer', hint: 'Un día antes de cada pago fijo' },
  { key: 'cap_enabled', emoji: '⚠️', name: 'Cerca de tu tope', hint: 'Cuando una categoría llega al 85%' },
  { key: 'inactivity_enabled', emoji: '⏰', name: 'Si dejas de registrar', hint: 'Después de 5 días' },
  { key: 'month_close_enabled', emoji: '✅', name: 'Cierre de mes', hint: 'Tu resumen y dónde ahorrar' },
  { key: 'income_enabled', emoji: '💼', name: 'Ingresos recibidos', hint: 'Cuando registras un ingreso' },
];

export type AvisoSwitches = Record<AvisoPrefKey, boolean>;

export const DEFAULT_SWITCHES: AvisoSwitches = {
  due_enabled: true,
  cap_enabled: true,
  inactivity_enabled: true,
  month_close_enabled: true,
  income_enabled: false,
};

/** "Activaste 4 tipos de aviso." */
export function enabledCountText(s: AvisoSwitches): string {
  const n = Object.values(s).filter(Boolean).length;
  return n === 1 ? 'Activaste 1 tipo de aviso.' : `Activaste ${n} tipos de aviso.`;
}
