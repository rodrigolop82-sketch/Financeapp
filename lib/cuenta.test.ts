import { describe, it, expect } from 'vitest';
import {
  CURRENCY_OPTIONS,
  accountDeletionMailto,
  currencyOption,
  decimalsHint,
  feedbackMailto,
  initialsFrom,
  planPill,
  shortDate,
  trialDaysLeft,
  usageMeter,
} from './cuenta';

describe('monedas', () => {
  it('ofrece las 7 monedas en orden', () => {
    expect(CURRENCY_OPTIONS.map((c) => c.code)).toEqual(['GTQ', 'USD', 'MXN', 'COP', 'HNL', 'NIO', 'CRC']);
  });
  it('cae en Quetzal con un código desconocido o vacío', () => {
    expect(currencyOption('EUR').code).toBe('GTQ');
    expect(currencyOption(null).name).toBe('Quetzal');
    expect(currencyOption('CRC').symbol).toBe('₡');
  });
});

describe('decimalsHint', () => {
  it('muestra el ejemplo redondeado o con centavos en la moneda elegida', () => {
    expect(decimalsHint(false, 'GTQ')).toBe('Q 8,501 · más fácil de leer');
    expect(decimalsHint(true, 'USD')).toBe('$ 8,500.75 · precisión total');
  });
});

describe('initialsFrom', () => {
  it('usa primera y última palabra del nombre', () => {
    expect(initialsFrom('Rodrigo López', 'r@x.com')).toBe('RL');
    expect(initialsFrom('  ana maría de león ', '')).toBe('AL');
  });
  it('usa una sola palabra o el correo si no hay nombre', () => {
    expect(initialsFrom('Rodrigo', null)).toBe('RO');
    expect(initialsFrom('', 'rodrigo.lop@correo.com')).toBe('RO');
    expect(initialsFrom(null, null)).toBe('?');
  });
});

describe('trialDaysLeft', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  it('redondea hacia arriba y nunca es negativo', () => {
    expect(trialDaysLeft('2026-10-13T12:00:00Z', now)).toBe(9);
    expect(trialDaysLeft('2026-10-04T13:00:00Z', now)).toBe(1);
    expect(trialDaysLeft('2026-10-01T00:00:00Z', now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBe(0);
    expect(trialDaysLeft('no es fecha', now)).toBe(0);
  });
});

describe('planPill', () => {
  it('prueba con días, premium o gratis', () => {
    expect(planPill({ isPremium: true, isTrialing: true, daysLeft: 9 })).toEqual({ label: 'Prueba · 9 días', tone: 'trial' });
    expect(planPill({ isPremium: true, isTrialing: true, daysLeft: 1 }).label).toBe('Prueba · 1 día');
    expect(planPill({ isPremium: true, isTrialing: false, daysLeft: 0 })).toEqual({ label: 'Premium', tone: 'premium' });
    expect(planPill({ isPremium: false, isTrialing: false, daysLeft: 0 })).toEqual({ label: 'Gratis', tone: 'free' });
  });
});

describe('shortDate', () => {
  it('día y mes corto', () => {
    expect(shortDate('2026-10-13T12:00:00')).toBe('13 oct');
    expect(shortDate(null)).toBe('');
  });
});

describe('usageMeter', () => {
  it('cambia de color al acercarse y al llegar al límite', () => {
    expect(usageMeter(1, 2)).toEqual({ pct: 50, tone: 'ok' });
    expect(usageMeter(8, 10)).toEqual({ pct: 80, tone: 'warn' });
    expect(usageMeter(12, 10)).toEqual({ pct: 100, tone: 'full' });
    expect(usageMeter(0, 0)).toEqual({ pct: 100, tone: 'full' });
  });
});

describe('mailto', () => {
  it('feedback va a hola@zafiapp.com', () => {
    expect(feedbackMailto()).toBe('mailto:hola@zafiapp.com?subject=Idea%20para%20Zafi');
  });
  it('eliminar cuenta lleva el correo del usuario', () => {
    const url = accountDeletionMailto('r@x.com');
    expect(url.startsWith('mailto:hola@zafiapp.com?subject=Eliminar%20mi%20cuenta&body=')).toBe(true);
    expect(decodeURIComponent(url.split('body=')[1])).toContain('Correo de la cuenta: r@x.com');
  });
});
