import { describe, it, expect } from 'vitest';
import {
  dayMonth,
  dayMonthMaybeYear,
  hasActivityBetween,
  indexActivity,
  lastAccessMs,
  localDayKey,
  planLabel,
  startOfLocalDay,
  startOfLocalWeek,
  type AdminUser,
} from './dataset';

const NOW = Date.parse('2026-10-04T18:00:00Z');

describe('fechas en Guatemala (UTC−6)', () => {
  it('día local', () => {
    expect(localDayKey(Date.parse('2026-10-04T05:59:00Z'))).toBe('2026-10-03');
    expect(localDayKey(Date.parse('2026-10-04T06:00:00Z'))).toBe('2026-10-04');
    expect(new Date(startOfLocalDay(NOW)).toISOString()).toBe('2026-10-04T06:00:00.000Z');
  });
  it('la semana empieza en lunes', () => {
    expect(new Date(startOfLocalWeek(NOW)).toISOString()).toBe('2026-09-28T06:00:00.000Z');
    expect(new Date(startOfLocalWeek(Date.parse('2026-09-28T07:00:00Z'))).toISOString()).toBe('2026-09-28T06:00:00.000Z');
  });
  it('etiquetas', () => {
    expect(dayMonth(NOW)).toBe('4 oct');
    expect(dayMonthMaybeYear(Date.parse('2025-12-30T18:00:00Z'), NOW)).toBe('30 dic 2025');
  });
});

describe('actividad por hogar', () => {
  const idx = indexActivity([
    { householdId: 'a', createdAt: '2026-10-03T00:00:00Z', type: 'expense', source: 'manual' },
    { householdId: 'a', createdAt: '2026-09-01T00:00:00Z', type: 'income', source: 'statement' },
    { householdId: 'b', createdAt: '2026-09-02T00:00:00Z', type: 'income', source: 'voice' },
  ]);
  it('cuenta, último, gasto e importación', () => {
    const a = idx.get('a')!;
    expect(a.count).toBe(2);
    expect(new Date(a.lastAt!).toISOString()).toBe('2026-10-03T00:00:00.000Z');
    expect(a.hasExpense).toBe(true);
    expect(a.hasImport).toBe(true);
    expect(idx.get('b')!.hasExpense).toBe(false);
    expect(idx.get('b')!.hasImport).toBe(false);
  });
  it('hasActivityBetween usa [desde, hasta)', () => {
    const a = idx.get('a')!;
    const t = Date.parse('2026-10-03T00:00:00Z');
    expect(hasActivityBetween(a, t, t + 1)).toBe(true);
    expect(hasActivityBetween(a, t - 10, t)).toBe(false);
    expect(hasActivityBetween(undefined, 0, NOW)).toBe(false);
  });
});

describe('plan y último acceso', () => {
  const u = (extra: Partial<AdminUser>): AdminUser => ({
    id: 'x', email: 'x@y.com', fullName: null, createdAt: '2026-09-01T00:00:00Z', plan: 'free', trialEndsAt: null,
    marketingOptIn: false, lastSignInAt: null, householdId: null, ...extra,
  });
  it('Premium, Prueba o Gratis', () => {
    expect(planLabel(u({ plan: 'premium' }), NOW)).toBe('Premium');
    expect(planLabel(u({ trialEndsAt: '2026-10-10T00:00:00Z' }), NOW)).toBe('Prueba');
    expect(planLabel(u({ trialEndsAt: '2026-09-10T00:00:00Z' }), NOW)).toBe('Gratis');
  });
  it('lo más reciente entre inicio de sesión, último movimiento y registro', () => {
    expect(lastAccessMs(u({ lastSignInAt: '2026-09-20T00:00:00Z' }), { times: [], count: 1, lastAt: Date.parse('2026-09-25T00:00:00Z'), hasExpense: true, hasImport: false }))
      .toBe(Date.parse('2026-09-25T00:00:00Z'));
    expect(lastAccessMs(u({ lastSignInAt: '2026-09-28T00:00:00Z' }), undefined)).toBe(Date.parse('2026-09-28T00:00:00Z'));
    expect(lastAccessMs(u({}), undefined)).toBe(Date.parse('2026-09-01T00:00:00Z'));
  });
});
