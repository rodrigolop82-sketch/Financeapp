import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SWITCHES, EMPTY_OFFER_STATE, REOFFER_AFTER_MS, autoOfferDue, decideOffer, enabledCountText,
  markAnswered, markOffered, parseOfferState, type OfferState,
} from './push-offer';

const NOW = 1_800_000_000_000;
const base = { trigger: 'expense-saved' as const, status: 'off' as const, isIOS: false, state: EMPTY_OFFER_STATE, now: NOW };

describe('decideOffer', () => {
  it('tras el primer gasto guardado ofrece los avisos', () => {
    expect(decideOffer(base)).toBe('permission');
  });
  it('iPhone sin instalar: primero la hoja de agregar a inicio', () => {
    expect(decideOffer({ ...base, status: 'needs-install', isIOS: true })).toBe('install');
    // En otros navegadores sin instalar no hay nada que hacer.
    expect(decideOffer({ ...base, status: 'needs-install', isIOS: false })).toBe('none');
  });
  it('sin soporte, activos o bloqueados: nada', () => {
    for (const status of ['unsupported', 'on', 'denied'] as const) {
      expect(decideOffer({ ...base, status })).toBe('none');
      expect(decideOffer({ ...base, status, trigger: 'manual' })).toBe('none');
    }
  });
  it('desde Mi cuenta siempre se puede abrir', () => {
    const done: OfferState = { offers: 2, lastOfferAt: NOW, answer: 'later' };
    expect(decideOffer({ ...base, trigger: 'manual', state: done })).toBe('permission');
    expect(decideOffer({ ...base, trigger: 'manual', state: done, status: 'needs-install', isIOS: true })).toBe('install');
  });
});

describe('"Ahora no" → una sola vez más a los 14 días', () => {
  it('sigue la secuencia', () => {
    let s = markOffered(EMPTY_OFFER_STATE, 'expense-saved', NOW);
    s = markAnswered(s, 'later');
    expect(autoOfferDue(s, NOW + 1000)).toBe(false);
    expect(autoOfferDue(s, NOW + REOFFER_AFTER_MS - 1)).toBe(false);
    expect(autoOfferDue(s, NOW + REOFFER_AFTER_MS)).toBe(true);
    s = markAnswered(markOffered(s, 'expense-saved', NOW + REOFFER_AFTER_MS), 'later');
    expect(autoOfferDue(s, NOW + 10 * REOFFER_AFTER_MS)).toBe(false);
  });
  it('si los activó o los bloqueó no vuelve a ofrecer', () => {
    const offered = markOffered(EMPTY_OFFER_STATE, 'expense-saved', NOW);
    expect(autoOfferDue(markAnswered(offered, 'enabled'), NOW + 2 * REOFFER_AFTER_MS)).toBe(false);
    expect(autoOfferDue(markAnswered(offered, 'denied'), NOW + 2 * REOFFER_AFTER_MS)).toBe(false);
  });
  it('abrir desde Mi cuenta no gasta las ofertas automáticas', () => {
    expect(markOffered(EMPTY_OFFER_STATE, 'manual', NOW)).toEqual(EMPTY_OFFER_STATE);
  });
});

describe('parseOfferState', () => {
  it('tolera basura', () => {
    expect(parseOfferState(null)).toEqual(EMPTY_OFFER_STATE);
    expect(parseOfferState('{')).toEqual(EMPTY_OFFER_STATE);
    expect(parseOfferState('{"offers":1,"lastOfferAt":5,"answer":"later"}')).toEqual({ offers: 1, lastOfferAt: 5, answer: 'later' });
    expect(parseOfferState('{"offers":"x","answer":"otro"}')).toEqual(EMPTY_OFFER_STATE);
  });
});

describe('switches', () => {
  it('ingresos apagado por defecto; texto de éxito', () => {
    expect(DEFAULT_SWITCHES.income_enabled).toBe(false);
    expect(enabledCountText(DEFAULT_SWITCHES)).toBe('Activaste 4 tipos de aviso.');
    expect(enabledCountText({ ...DEFAULT_SWITCHES, due_enabled: false, cap_enabled: false, inactivity_enabled: false, month_close_enabled: false, income_enabled: true })).toBe('Activaste 1 tipo de aviso.');
  });
});
