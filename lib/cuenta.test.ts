import { describe, it, expect } from 'vitest';
import {
  CURRENCY_OPTIONS,
  accountDeletionMailto,
  currencyOption,
  decimalsHint,
  initialsFrom,
  planPill,
  shortDate,
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

describe('planPill', () => {
  it('solo el plan: premium o gratis', () => {
    expect(planPill({ isPremium: true })).toEqual({ label: 'Premium', tone: 'premium' });
    expect(planPill({ isPremium: false })).toEqual({ label: 'Gratis', tone: 'free' });
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
  it('eliminar cuenta lleva el correo del usuario', () => {
    const url = accountDeletionMailto('r@x.com');
    expect(url.startsWith('mailto:hola@zafiapp.com?subject=Eliminar%20mi%20cuenta&body=')).toBe(true);
    expect(decodeURIComponent(url.split('body=')[1])).toContain('Correo de la cuenta: r@x.com');
  });
});
