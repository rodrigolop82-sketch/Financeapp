import { describe, it, expect } from 'vitest';
import { efectoPagoExtra, motivoOrden, ordenAvalancha, type DebtTermsInput } from './plan-de-pago';
import { amortizar } from './amortizacion';

const visa: DebtTermsInput = { id: 'v', name: 'Visa', balance: 9000, interest_rate: 36, min_payment: 450 };
const carro: DebtTermsInput = { id: 'c', name: 'Carro', balance: 60000, interest_rate: 12, min_payment: 1800 };
const tio: DebtTermsInput = { id: 't', name: 'Préstamo del tío', balance: 2000, interest_rate: 0, min_payment: 200 };

describe('ordenAvalancha', () => {
  it('primero la de mayor interés', () => {
    expect(ordenAvalancha([tio, carro, visa]).map((d) => d.id)).toEqual(['v', 'c', 't']);
  });

  it('cada deuda trae su plazo al ritmo actual (el mismo que el motor)', () => {
    const [primera] = ordenAvalancha([visa]);
    expect(primera.ritmoActual).toEqual(amortizar({ saldo: 9000, tasaAnual: 36, cuota: 450 }));
    expect(primera.ritmoActual.ok && primera.ritmoActual.meses).toBe(31);
  });

  it('marca la cuota que no cubre los intereses', () => {
    const [d] = ordenAvalancha([{ ...visa, min_payment: 200 }]);
    expect(d.ritmoActual).toMatchObject({ ok: false, advertencia: 'cuota_no_cubre_intereses' });
  });
});

describe('motivoOrden', () => {
  it('explica en una línea', () => {
    expect(motivoOrden(ordenAvalancha([visa, carro])[0])).toMatch(/Visa.*36%/);
    expect(motivoOrden(ordenAvalancha([tio])[0])).toMatch(/interés/);
    expect(motivoOrden(undefined)).toBe('');
  });
});

describe('efectoPagoExtra', () => {
  it('sin extra no ahorras nada', () => {
    const e = efectoPagoExtra([visa], 0);
    expect(e.mesesAhorrados).toBe(0);
    expect(e.interesesAhorrados).toBe(0);
    expect(e.sinExtra.meses).toBe(31);
  });

  it('con extra terminas antes y pagas menos intereses', () => {
    const e = efectoPagoExtra([visa, carro], 500);
    expect(e.mesesAhorrados).toBeGreaterThan(0);
    expect(e.interesesAhorrados).toBeGreaterThan(0);
    expect(e.sinFin).toBe(false);
  });

  it('una deuda que nunca baja se marca como sin fin', () => {
    expect(efectoPagoExtra([{ ...visa, min_payment: 100 }], 0).sinFin).toBe(true);
  });
});
