import { describe, it, expect } from 'vitest';
import { cobroDesdeExtraccion, esCuerpoAndroid, pareceCobro, parseAndroidBody, sharedNotice } from './android';

const TODAY = '2026-10-17';
const notice = { text: 'BAM: Compra por Q85.50 en WALMART', app: 'BAM' };

describe('cuerpo de MacroDroid', () => {
  it('texto plano o JSON con text; el del atajo de Apple Pay no', () => {
    expect(esCuerpoAndroid('BAM: Compra por Q85.50')).toBe(true);
    expect(esCuerpoAndroid({ text: 'x', app: 'BAM' })).toBe(true);
    expect(esCuerpoAndroid({ amount: '1.00', merchant: 'Prueba' })).toBe(false);
    expect(esCuerpoAndroid(null)).toBe(false);
  });

  it('limpia el texto y toma la app', () => {
    expect(parseAndroidBody('  BAM:\nCompra   por Q85 ')).toEqual({ ok: true, value: { text: 'BAM: Compra por Q85', app: null } });
    expect(parseAndroidBody({ text: 'Compra por Q85', app: 'BAM' })).toEqual({ ok: true, value: { text: 'Compra por Q85', app: 'BAM' } });
    expect(parseAndroidBody('hola').ok).toBe(false);
  });
});

describe('pareceCobro', () => {
  it('solo avisos con un monto en moneda', () => {
    expect(pareceCobro('Compra por Q85.50 en Walmart')).toBe(true);
    expect(pareceCobro('Cargo de GTQ 1,250.00')).toBe(true);
    expect(pareceCobro('Netflix USD 9.99')).toBe(true);
    expect(pareceCobro('Tu código de verificación es 482913')).toBe(false);
    expect(pareceCobro('Tienes 2 mensajes nuevos')).toBe(false);
  });
});

describe('cobroDesdeExtraccion', () => {
  it('gasto con banco como tarjeta y fecha de hoy', () => {
    const r = cobroDesdeExtraccion({ amount: 85.5, merchant: 'Walmart', bank: 'BAM', currency: 'GTQ', type: 'expense' }, notice, TODAY);
    expect(r).toEqual({ ok: true, value: { amount: 85.5, currency: 'GTQ', merchant: 'Walmart', card: 'BAM', date: TODAY } });
  });

  it('sin comercio usa el banco; sin banco, la app', () => {
    const r = cobroDesdeExtraccion({ amount: 20, merchant: '', bank: '', currency: 'USD', type: 'expense' }, notice, TODAY);
    expect(r.ok && r.value).toMatchObject({ merchant: 'BAM', card: 'BAM', currency: 'USD' });
  });

  it('ingresos y montos en cero no se registran', () => {
    expect(cobroDesdeExtraccion({ amount: 500, merchant: '', bank: 'BAM', currency: 'GTQ', type: 'income' }, notice, TODAY))
      .toEqual({ ok: false, reason: 'ingreso' });
    expect(cobroDesdeExtraccion({ amount: 0, merchant: '', bank: '', currency: 'GTQ', type: 'expense' }, notice, TODAY))
      .toEqual({ ok: false, reason: 'sin_monto' });
    expect(cobroDesdeExtraccion(null, notice, TODAY)).toEqual({ ok: false, reason: 'sin_monto' });
  });
});

describe('sharedNotice (Compartir a Zafi)', () => {
  it('une título y texto sin repetir', () => {
    expect(sharedNotice('BAM', 'Compra por Q85')).toBe('BAM: Compra por Q85');
    expect(sharedNotice('BAM', 'BAM Compra por Q85')).toBe('BAM Compra por Q85');
    expect(sharedNotice(null, 'Compra por Q85')).toBe('Compra por Q85');
    expect(sharedNotice('Compra por Q85', null)).toBe('Compra por Q85');
    expect(sharedNotice(null, '  ')).toBeNull();
  });
});
