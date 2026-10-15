import { describe, it, expect } from 'vitest';
import { completeDaysOf, dailySpend, type DailySpendCategory, type DailySpendTx } from './daily-spend';

const cats: DailySpendCategory[] = [
  { id: 'super', bucket: 'needs' },
  { id: 'salidas', bucket: 'wants' },
  { id: 'ahorro', bucket: 'savings' },
  { id: 'sueldo', bucket: 'income' },
];

function gasto(date: string, amount: number, category_id: string | null = 'super'): DailySpendTx {
  return { date, amount, type: 'expense', category_id };
}

describe('completeDaysOf', () => {
  it('mes cerrado: todos sus días', () => {
    expect(completeDaysOf('2026-09', '2026-10-15')).toBe(30);
    expect(completeDaysOf('2024-02', '2026-10-15')).toBe(29);
  });

  it('mes en curso: sin hoy ni los días futuros', () => {
    expect(completeDaysOf('2026-10', '2026-10-15')).toBe(14);
    expect(completeDaysOf('2026-10', '2026-10-01')).toBe(0);
  });

  it('mes futuro: cero', () => {
    expect(completeDaysOf('2026-11', '2026-10-15')).toBe(0);
  });
});

describe('dailySpend', () => {
  it('septiembre cerrado: el gasto total entre 30 días', () => {
    const txs = [gasto('2026-09-01', 300), gasto('2026-09-15', 450, 'salidas'), gasto('2026-09-30', 150)];
    const r = dailySpend('2026-09', '2026-10-15', txs, cats);
    expect(r.completeDays).toBe(30);
    expect(r.spent).toBe(900);
    expect(r.avgPerDay).toBe(30);
    expect(r.daysWithoutSpend).toBe(27);
    expect(r.enough).toBe(true);
  });

  it('octubre en curso: solo los días completos transcurridos', () => {
    const txs = [
      gasto('2026-10-02', 140),
      gasto('2026-10-14', 140),
      gasto('2026-10-15', 5000), // hoy: no cuenta
      gasto('2026-10-20', 5000), // futuro: no cuenta
    ];
    const r = dailySpend('2026-10', '2026-10-15', txs, cats);
    expect(r.completeDays).toBe(14);
    expect(r.spent).toBe(280);
    expect(r.avgPerDay).toBe(20);
    expect(r.daysWithoutSpend).toBe(12);
  });

  it('los ingresos no rompen un día sin gasto', () => {
    const txs: DailySpendTx[] = [
      gasto('2026-09-01', 100),
      { date: '2026-09-02', amount: 8000, type: 'income', category_id: 'sueldo' },
    ];
    const r = dailySpend('2026-09', '2026-10-15', txs, cats);
    expect(r.daysWithoutSpend).toBe(29);
  });

  it('igual que "Gastaste": ahorro e ingresos fuera, sin categoría cuenta', () => {
    const txs = [
      gasto('2026-09-01', 1000, 'ahorro'),
      gasto('2026-09-02', 60, 'sueldo'),
      gasto('2026-09-03', 90, null),
    ];
    const r = dailySpend('2026-09', '2026-10-15', txs, cats);
    expect(r.spent).toBe(90);
    expect(r.daysWithoutSpend).toBe(29);
  });

  it('varios gastos el mismo día cuentan como un solo día con gasto', () => {
    const txs = [gasto('2026-09-05', 10), gasto('2026-09-05', 20), gasto('2026-09-05', 30)];
    const r = dailySpend('2026-09', '2026-10-15', txs, cats);
    expect(r.daysWithoutSpend).toBe(29);
    expect(r.spent).toBe(60);
  });

  it('las transferencias no cuentan', () => {
    const txs: DailySpendTx[] = [
      { ...gasto('2026-09-05', 1500), transaction_type: 'transferencia' },
      gasto('2026-09-06', 300),
    ];
    const r = dailySpend('2026-09', '2026-10-15', txs, cats);
    expect(r.spent).toBe(300);
    expect(r.daysWithoutSpend).toBe(29);
  });

  it('ignora movimientos de otros meses', () => {
    const txs = [gasto('2026-08-31', 999), gasto('2026-10-01', 999), gasto('2026-09-10', 30)];
    const r = dailySpend('2026-09', '2026-10-15', txs, cats);
    expect(r.spent).toBe(30);
  });

  it('con menos de 3 días completos no hay números', () => {
    expect(dailySpend('2026-10', '2026-10-03', [], cats).enough).toBe(false);
    expect(dailySpend('2026-10', '2026-10-04', [], cats).enough).toBe(true);
  });

  it('sin días completos el promedio es cero, no NaN', () => {
    const r = dailySpend('2026-10', '2026-10-01', [gasto('2026-10-01', 50)], cats);
    expect(r.avgPerDay).toBe(0);
    expect(r.daysWithoutSpend).toBe(0);
  });
});
