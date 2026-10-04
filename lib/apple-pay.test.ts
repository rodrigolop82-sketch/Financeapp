import { describe, it, expect } from 'vitest';
import {
  RATE_LIMIT, cardLabel, cleanText, looksLikeShortcutToken, parseAmount, parseApplePayBody, parseDate, rateLimitStep, tokenSummary,
} from './apple-pay';
import { generateShortcutToken, hashShortcutToken } from './apple-pay-token';

const TODAY = '2026-10-04';

describe('clave del atajo', () => {
  it('aleatoria, con prefijo y guardada como SHA-256', () => {
    const a = generateShortcutToken();
    const b = generateShortcutToken();
    expect(a.token).not.toBe(b.token);
    expect(looksLikeShortcutToken(a.token)).toBe(true);
    expect(a.token.startsWith('zafi_')).toBe(true);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashShortcutToken(a.token)).toBe(a.hash);
    expect(a.hash).not.toContain(a.token.slice(5));
  });
  it('rechaza formatos raros', () => {
    expect(looksLikeShortcutToken('zafi_corto')).toBe(false);
    expect(looksLikeShortcutToken('eyJhbGciOi.jwt.token')).toBe(false);
    expect(looksLikeShortcutToken(null)).toBe(false);
  });
});

describe('parseAmount', () => {
  it('entiende los formatos de Wallet', () => {
    expect(parseAmount('Q 85.00')).toEqual({ amount: 85, currency: 'GTQ' });
    expect(parseAmount('Q1,250.50')).toEqual({ amount: 1250.5, currency: 'GTQ' });
    expect(parseAmount('$12.50')).toEqual({ amount: 12.5, currency: 'USD' });
    expect(parseAmount('US$ 3')).toEqual({ amount: 3, currency: 'USD' });
    expect(parseAmount('85,50')).toEqual({ amount: 85.5, currency: 'GTQ' });
    expect(parseAmount('1.250,75 €')).toEqual({ amount: 1250.75, currency: 'EUR' });
    expect(parseAmount('1,250')).toEqual({ amount: 1250, currency: 'GTQ' });
    expect(parseAmount(42.129)).toEqual({ amount: 42.13, currency: 'GTQ' });
  });
  it('rechaza montos inválidos', () => {
    for (const v of ['', 'abc', '-5', '0', 0, -3, 2_000_000, '9999999', null, undefined, {}, NaN]) {
      expect(parseAmount(v)).toBeNull();
    }
  });
});

describe('parseDate', () => {
  it('sin fecha es hoy', () => {
    expect(parseDate(undefined, TODAY)).toBe(TODAY);
    expect(parseDate('', TODAY)).toBe(TODAY);
  });
  it('ISO con la zona del teléfono o en UTC', () => {
    expect(parseDate('2026-10-03', TODAY)).toBe('2026-10-03');
    expect(parseDate('2026-10-04T21:30:00-06:00', TODAY)).toBe('2026-10-04');
    expect(parseDate('2026-10-05T02:00:00Z', TODAY)).toBe('2026-10-04');
  });
  it('fuera de rango o inválida', () => {
    expect(parseDate('2026-10-07', TODAY)).toBeNull();
    expect(parseDate('2024-01-01', TODAY)).toBeNull();
    expect(parseDate('2026-02-30', TODAY)).toBeNull();
    expect(parseDate('4 oct 2026', TODAY)).toBeNull();
    expect(parseDate(20261004, TODAY)).toBeNull();
  });
});

describe('parseApplePayBody', () => {
  it('valida y limpia', () => {
    const r = parseApplePayBody({ amount: 'Q 85.00', merchant: '  Starbucks\nOakland ', card: 'BI Visa ··4821', date: TODAY }, TODAY);
    expect(r).toEqual({ ok: true, value: { amount: 85, currency: 'GTQ', merchant: 'Starbucks Oakland', card: 'BI Visa ··4821', date: TODAY } });
  });
  it('sin comercio queda "Apple Pay"; sin tarjeta, null', () => {
    const r = parseApplePayBody({ amount: 10 }, TODAY);
    expect(r.ok && r.value.merchant).toBe('Apple Pay');
    expect(r.ok && r.value.card).toBeNull();
  });
  it('errores claros', () => {
    expect(parseApplePayBody(null, TODAY)).toMatchObject({ ok: false });
    expect(parseApplePayBody({ amount: 'x' }, TODAY)).toEqual({ ok: false, error: 'Monto inválido.' });
    expect(parseApplePayBody({ amount: 5, date: 'ayer' }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining('Fecha') });
  });
  it('cleanText recorta', () => {
    expect(cleanText('a'.repeat(100), 10)).toBe('a'.repeat(10));
    expect(cleanText(5, 10)).toBe('');
  });
});

describe('rateLimitStep', () => {
  it(`hasta ${RATE_LIMIT} por hora por clave`, () => {
    const now = Date.parse('2026-10-04T10:00:00Z');
    let state = { start: null as string | null, count: 0 };
    for (let i = 0; i < RATE_LIMIT; i++) {
      const r = rateLimitStep(state, now + i * 1000);
      expect(r.allowed).toBe(true);
      state = r.next;
    }
    expect(rateLimitStep(state, now + 60_000).allowed).toBe(false);
    // Pasada la hora, se reinicia.
    const later = rateLimitStep(state, now + 3_600_000);
    expect(later).toEqual({ allowed: true, next: { start: new Date(now + 3_600_000).toISOString(), count: 1 } });
  });
});

describe('cardLabel', () => {
  it('etiqueta de la hoja', () => {
    expect(cardLabel('BI Visa ··4821')).toBe('Apple Pay · BI Visa ··4821');
    expect(cardLabel(null)).toBe('Apple Pay');
  });
});

describe('tokenSummary', () => {
  it('creada y usada', () => {
    const now = new Date(2026, 9, 4, 12).getTime();
    expect(tokenSummary({ created_at: new Date(2026, 9, 1, 9).toISOString(), last_used_at: null }, now)).toBe('Creada el 1 oct · sin usar todavía');
    expect(tokenSummary({ created_at: new Date(2026, 9, 1, 9).toISOString(), last_used_at: new Date(2026, 9, 4, 8).toISOString() }, now)).toBe('Creada el 1 oct · usada hoy');
    expect(tokenSummary({ created_at: new Date(2026, 8, 1, 9).toISOString(), last_used_at: new Date(2026, 9, 2, 8).toISOString() }, now)).toBe('Creada el 1 sep · usada el 2 oct');
  });
});
