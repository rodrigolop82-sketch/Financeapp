import { describe, it, expect } from 'vitest';
import {
  addDays, dayLabel, longDate, monthRange, monthLabel, recentMonths, recentDays,
  cleanAmountInput, groupByDay, sameMerchantOthers, topCategories,
  periodRange, yearMonths, periodLabel, periodInText, groupByMonth,
} from './movimientos';

const TODAY = '2026-10-03';

describe('fechas', () => {
  it('addDays cruza meses', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('dayLabel', () => {
    expect(dayLabel('2026-10-03', TODAY)).toBe('Hoy');
    expect(dayLabel('2026-10-02', TODAY)).toBe('Ayer');
    expect(dayLabel('2026-09-28', TODAY)).toBe('Lunes 28');
  });

  it('longDate', () => {
    expect(longDate('2026-10-03', TODAY)).toBe('Hoy, 3 de octubre');
    expect(longDate('2026-10-02', TODAY)).toBe('Ayer, 2 de octubre');
    expect(longDate('2026-09-28', TODAY)).toBe('Lunes 28 de septiembre');
    expect(longDate('2025-12-25', TODAY)).toBe('Jueves 25 de diciembre de 2025');
  });

  it('meses', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthLabel('2026-10', TODAY)).toBe('Octubre');
    expect(monthLabel('2025-12', TODAY)).toBe('Diciembre 2025');
    expect(recentMonths(TODAY, 3)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(recentMonths('2026-01-15', 2)).toEqual(['2026-01', '2025-12']);
    expect(recentDays(TODAY, 3)).toEqual(['2026-10-03', '2026-10-02', '2026-10-01']);
  });
});

describe('cleanAmountInput', () => {
  it('deja dígitos y un solo punto', () => {
    expect(cleanAmountInput('Q 1,234.50')).toBe('1234.50');
    expect(cleanAmountInput('1.2.3')).toBe('1.23');
    expect(cleanAmountInput('abc')).toBe('');
  });
});

describe('groupByDay', () => {
  it('agrupa y suma solo gastos', () => {
    const rows = [
      { id: 'a', date: TODAY, amount: 10, type: 'expense' as const },
      { id: 'b', date: TODAY, amount: '500', type: 'income' as const },
      { id: 'c', date: '2026-10-02', amount: '5.5', type: 'expense' as const },
    ];
    const groups = groupByDay(rows, TODAY);
    expect(groups.map((g) => [g.label, g.expenseTotal, g.rows.length])).toEqual([
      ['Hoy', 10, 2],
      ['Ayer', 5.5, 1],
    ]);
  });
});

describe('sameMerchantOthers', () => {
  const rows = [
    { id: '1', description: 'Uber', category_id: 'fun' },
    { id: '2', description: 'UBER', category_id: 'fun' },
    { id: '3', description: 'Uber', category_id: 'transporte' },
    { id: '4', description: 'Walmart', category_id: 'fun' },
  ];
  it('cuenta los del mismo comercio sin la categoría nueva', () => {
    expect(sameMerchantOthers(rows, rows[0], 'transporte').map((r) => r.id)).toEqual(['2']);
  });
  it('sin descripción no hay otros', () => {
    expect(sameMerchantOthers([...rows, { id: '5', description: null, category_id: 'x' }], { id: '5', description: null, category_id: 'x' }, 'y')).toEqual([]);
  });
});

describe('topCategories', () => {
  it('ordena por uso y completa con el resto', () => {
    const cats = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(topCategories(cats, { c: 5, b: 2 }, 3).map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('periodos (búsqueda anual)', () => {
  const today = '2026-10-06';

  it('el año va del 1 de enero a hoy; un mes, de su primer a su último día', () => {
    expect(periodRange('year', today)).toEqual({ from: '2026-01-01', to: '2026-10-06' });
    expect(periodRange('2026-07', today)).toEqual({ from: '2026-07-01', to: '2026-07-31' });
  });

  it('lista los meses del año en curso, del actual a enero', () => {
    const m = yearMonths(today);
    expect(m).toHaveLength(10);
    expect(m[0]).toBe('2026-10');
    expect(m[9]).toBe('2026-01');
  });

  it('nombra el periodo', () => {
    expect(periodLabel('year', today)).toBe('Todo 2026');
    expect(periodLabel('2026-07', today)).toBe('Julio');
    expect(periodInText('year', today)).toBe('2026');
    expect(periodInText('2026-07', today)).toBe('julio');
  });

  it('agrupa por mes y día', () => {
    const rows = [
      { id: 'a', date: '2026-10-05', amount: 10, type: 'expense' as const },
      { id: 'b', date: '2026-10-05', amount: 5, type: 'expense' as const },
      { id: 'c', date: '2026-07-02', amount: 7, type: 'expense' as const },
    ];
    const g = groupByMonth(rows, today);
    expect(g.map((m) => m.month)).toEqual(['2026-10', '2026-07']);
    expect(g[0].days[0].rows).toHaveLength(2);
    expect(g[1].days[0].expenseTotal).toBe(7);
  });
});
