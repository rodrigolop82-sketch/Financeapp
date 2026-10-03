import { describe, it, expect } from 'vitest';
import { barKind, computeHome, headerDate, initials, pickHomeAlert, type HomeCategory, type HomeTx } from './inicio';

const OCT_3 = new Date(2026, 9, 3, 12);

describe('computeHome', () => {
  it('caso de aceptación: plan Q 6,825, gastado Q 4,542.50 el día 3 de un mes de 31', () => {
    const cats: HomeCategory[] = [
      { id: 'a', name: 'Vivienda/alquiler', bucket: 'needs', budgeted_amount: 4000, pace_mode: 'fixed', expected_day: 1 },
      { id: 'b', name: 'Alimentación', bucket: 'needs', budgeted_amount: 2825 },
      { id: 'i', name: 'Salario', bucket: 'income', budgeted_amount: 9000 },
    ];
    const txs: HomeTx[] = [
      { category_id: 'a', amount: 4000, type: 'expense' },
      { category_id: 'b', amount: '542.50', type: 'expense' },
      { category_id: 'i', amount: 9000, type: 'income' },
    ];
    const h = computeHome(cats, txs, OCT_3);
    expect(h.budget).toBe(6825);
    expect(h.spent).toBe(4542.5);
    expect(h.daysLeft).toBe(29);
    expect(h.perDay).toBe(79);
    expect(Math.round(h.left)).toBe(2283);
  });

  it('Fase 6: Q 89 sin apartar y Q 72 con Q 481 apartados; las metas no cuentan', () => {
    const cats: HomeCategory[] = [
      { id: 'a', name: 'Básico', bucket: 'needs', budgeted_amount: 6000 },
      { id: 'b', name: 'Gustos', bucket: 'wants', budgeted_amount: 1125 },
      { id: 'm', name: 'Colchón', bucket: 'savings', budgeted_amount: 800 },
    ];
    const txs: HomeTx[] = [
      { category_id: 'a', amount: 4000, type: 'expense' },
      { category_id: 'b', amount: 542.5, type: 'expense' },
      { category_id: 'm', amount: 500, type: 'expense' },
    ];
    expect(computeHome(cats, txs, OCT_3).perDay).toBe(89);
    expect(computeHome(cats, txs, OCT_3, 481).perDay).toBe(72);
    expect(computeHome(cats, txs, OCT_3).budget).toBe(7125);
  });

  it('sin plan no inventa presupuesto', () => {
    const h = computeHome([{ id: 'b', name: 'Alimentación', bucket: 'needs', budgeted_amount: 0 }], [{ category_id: 'b', amount: 100, type: 'expense' }], OCT_3);
    expect(h.budget).toBe(0);
    expect(h.perDay).toBe(0);
    expect(h.catBars).toEqual([]);
    expect(h.spendByCategory.map((c) => [c.name, c.spent])).toEqual([['Alimentación', 100]]);
  });

  it('ignora categorías archivadas', () => {
    const h = computeHome([
      { id: 'a', name: 'A', bucket: 'needs', budgeted_amount: 100 },
      { id: 'x', name: 'X', bucket: 'wants', budgeted_amount: 500, archived_at: '2026-09-01' },
    ], [], OCT_3);
    expect(h.budget).toBe(100);
  });

  it('estado según el avance', () => {
    const cats: HomeCategory[] = [{ id: 'a', name: 'A', bucket: 'needs', budgeted_amount: 1000, pace_mode: 'fixed', expected_day: 1 }];
    expect(computeHome(cats, [{ category_id: 'a', amount: 500, type: 'expense' }], OCT_3).status).toBe('bien');
    expect(computeHome(cats, [{ category_id: 'a', amount: 900, type: 'expense' }], OCT_3).status).toBe('cuidado');
    expect(computeHome(cats, [{ category_id: 'a', amount: 1000, type: 'expense' }], OCT_3).status).toBe('pasaste');
    // Ritmo lineal: Q 500 de Q 1,000 el día 3 va muy rápido.
    const linear: HomeCategory[] = [{ id: 'a', name: 'A', bucket: 'needs', budgeted_amount: 1000 }];
    expect(computeHome(linear, [{ category_id: 'a', amount: 500, type: 'expense' }], OCT_3).status).toBe('cuidado');
  });

  it('categoría excedida: la de mayor exceso en quetzales, sin umbral', () => {
    const cats: HomeCategory[] = [
      { id: 'a', name: 'A', bucket: 'needs', budgeted_amount: 100 },
      { id: 'b', name: 'B', bucket: 'wants', budgeted_amount: 1000 },
    ];
    const h = computeHome(cats, [
      { category_id: 'a', amount: 150, type: 'expense' },
      { category_id: 'b', amount: 1010, type: 'expense' },
    ], OCT_3);
    expect(h.overCategory?.name).toBe('A');
    expect(h.overCategory?.excess).toBe(50);
  });

  it('barras: top 5 por gasto con plan', () => {
    const cats: HomeCategory[] = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, bucket: 'needs', budgeted_amount: 100 }));
    const txs: HomeTx[] = cats.map((c, i) => ({ category_id: c.id, amount: (i + 1) * 10, type: 'expense' as const }));
    const h = computeHome(cats, txs, OCT_3);
    expect(h.catBars.map((b) => b.name)).toEqual(['C6', 'C5', 'C4', 'C3', 'C2']);
  });
});

describe('barKind', () => {
  it('umbrales', () => {
    expect(barKind(0.84)).toBe('ok');
    expect(barKind(0.85)).toBe('cuidado');
    expect(barKind(1)).toBe('cuidado');
    expect(barKind(1.01)).toBe('excedida');
  });
});

describe('pickHomeAlert', () => {
  const over = { id: 'a', name: 'A', bucket: 'needs', excess: 10 };
  const savings = { title: 'Ahorro', subtitle: '' };
  it('prioridad: excedida > sin registrar > ahorro', () => {
    expect(pickHomeAlert({ overCategory: over, daysSinceLastTransaction: 5, savings })?.kind).toBe('excedida');
    expect(pickHomeAlert({ overCategory: null, daysSinceLastTransaction: 5, savings })?.kind).toBe('sin-registrar');
    expect(pickHomeAlert({ overCategory: null, daysSinceLastTransaction: 1, savings })?.kind).toBe('ahorro');
    expect(pickHomeAlert({ overCategory: null, daysSinceLastTransaction: null, savings: null })).toBeNull();
  });
});

describe('formato', () => {
  it('headerDate e initials', () => {
    expect(headerDate(OCT_3)).toBe('Sábado 3 de octubre');
    expect(initials('Ana Pérez López')).toBe('AL');
    expect(initials('ana')).toBe('AN');
  });
});
