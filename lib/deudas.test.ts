import { describe, it, expect } from 'vitest';
import { formatMonths, simulatePayoff } from './deudas';
import type { Debt } from '@/types';

function debt(id: string, balance: number, rate: number, min: number): Debt {
  return {
    id, household_id: 'h', name: id, type: 'credit', balance, interest_rate: rate, min_payment: min,
    due_day: 1, strategy: 'snowball', is_paid: false, created_at: '',
  };
}

describe('formatMonths', () => {
  it('usa meses, años y "+30 años"', () => {
    expect(formatMonths(1)).toBe('1 mes');
    expect(formatMonths(8)).toBe('8 meses');
    expect(formatMonths(12)).toBe('12 meses');
    expect(formatMonths(13)).toBe('1 año 1 m');
    expect(formatMonths(24)).toBe('2 años');
    expect(formatMonths(28)).toBe('2 años 4 m');
    expect(formatMonths(360)).toBe('+30 años');
  });
});

describe('simulatePayoff', () => {
  const debts = [debt('a', 1000, 0, 100), debt('b', 5000, 36, 300)];

  it('el pago extra termina antes y paga menos interés', () => {
    const base = simulatePayoff(debts, 0, 'avalanche');
    const extra = simulatePayoff(debts, 500, 'avalanche');
    expect(extra.totalMonths).toBeLessThan(base.totalMonths);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
  });

  it('bola de nieve paga primero la más pequeña; avalancha la de más interés', () => {
    expect(simulatePayoff(debts, 5000, 'snowball').order[0].name).toBe('a');
    expect(simulatePayoff(debts, 5000, 'avalanche').order[0].name).toBe('b');
  });

  it('avisa si el mínimo no cubre el interés', () => {
    const r = simulatePayoff([debt('c', 10000, 60, 100)], 0, 'avalanche');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
