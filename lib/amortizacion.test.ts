import { describe, it, expect } from 'vitest';
import { ahorroConExtra, amortizar } from './amortizacion';
import { simulatePayoff } from './deudas';
import type { Debt } from '@/types';

// Plazo con la fórmula cerrada: n = −ln(1 − r·B/P) / ln(1 + r).
function mesesFormula(saldo: number, tasaAnual: number, cuota: number): number {
  const r = tasaAnual / 100 / 12;
  return Math.ceil(-Math.log(1 - (r * saldo) / cuota) / Math.log(1 + r));
}

describe('amortizar', () => {
  it('tarjeta de Q 9,000 al 36% anual con cuota de Q 450', () => {
    const a = amortizar({ saldo: 9000, tasaAnual: 36, cuota: 450 });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.meses).toBe(mesesFormula(9000, 36, 450)); // 31
    expect(a.meses).toBe(31);
    // Primer mes: 3% de 9,000 = 270 de intereses, 180 a capital.
    expect(a.calendario[0]).toEqual({ mes: 1, pago: 450, interes: 270, capital: 180, saldo: 8820 });
    expect(a.totalPagado).toBeCloseTo(9000 + a.interesesTotales, 1);
    expect(a.interesesTotales).toBeGreaterThan(4800);
    expect(a.interesesTotales).toBeLessThan(5000);
    expect(a.calendario[a.calendario.length - 1].saldo).toBe(0);
  });

  it('sin intereses: saldo entre cuota', () => {
    const a = amortizar({ saldo: 1000, tasaAnual: 0, cuota: 300 });
    expect(a.ok && a.meses).toBe(4);
    expect(a.ok && a.interesesTotales).toBe(0);
    expect(a.ok && a.calendario[3].pago).toBe(100);
  });

  it('cuota que no cubre los intereses: advertencia, no plazo infinito', () => {
    const a = amortizar({ saldo: 9000, tasaAnual: 36, cuota: 250 });
    expect(a).toEqual({ ok: false, advertencia: 'cuota_no_cubre_intereses', interesMensual: 270 });
    // Igual a los intereses tampoco alcanza.
    expect(amortizar({ saldo: 9000, tasaAnual: 36, cuota: 270 }).ok).toBe(false);
  });

  it('sin cuota: advertencia', () => {
    expect(amortizar({ saldo: 500, tasaAnual: 10, cuota: 0 })).toMatchObject({ ok: false, advertencia: 'sin_cuota' });
  });

  it('saldo en cero: nada que pagar', () => {
    expect(amortizar({ saldo: 0, tasaAnual: 36, cuota: 450 })).toEqual({ ok: true, meses: 0, interesesTotales: 0, totalPagado: 0, calendario: [] });
  });

  it('el pago extra baja el plazo y los intereses', () => {
    const base = amortizar({ saldo: 9000, tasaAnual: 36, cuota: 450 });
    const con = amortizar({ saldo: 9000, tasaAnual: 36, cuota: 450, extra: 150 });
    expect(con.ok && base.ok && con.meses < base.meses).toBe(true);
    expect(con.ok && con.meses).toBe(mesesFormula(9000, 36, 600));
    const ahorro = ahorroConExtra({ saldo: 9000, tasaAnual: 36, cuota: 450 }, 150)!;
    expect(ahorro.meses).toBe(31 - mesesFormula(9000, 36, 600));
    expect(ahorro.intereses).toBeGreaterThan(0);
  });

  it('el pago extra puede rescatar una cuota que no cubre los intereses', () => {
    expect(ahorroConExtra({ saldo: 9000, tasaAnual: 36, cuota: 250 }, 200)).toBeNull();
    expect(amortizar({ saldo: 9000, tasaAnual: 36, cuota: 250, extra: 200 }).ok).toBe(true);
  });

  it('da el mismo plazo e intereses que el simulador actual de Deudas', () => {
    const debt = { id: 'd', name: 'Visa', balance: 9000, interest_rate: 36, min_payment: 450 } as Debt;
    const sim = simulatePayoff([debt], 0, 'avalanche');
    const a = amortizar({ saldo: 9000, tasaAnual: 36, cuota: 450 });
    expect(a.ok && a.meses).toBe(sim.totalMonths);
    expect(a.ok && Math.round(a.interesesTotales)).toBe(sim.totalInterest);
  });
});
