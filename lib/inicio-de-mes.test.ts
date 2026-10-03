import { describe, expect, it } from 'vitest';
import {
  choicesFromItems, computeReserve, countedIncome, daysLeftInMonth, fixedLeaves, initialChoices,
  itemsFromChoices, monthStartSummary, perDay, totalCountedIncome, type MonthChoices,
} from './inicio-de-mes';
import type { PlanCategory, PlanIncome, PlanSubItem } from './plan-del-mes';

const fmt = (n: number) => `Q ${Math.round(n).toLocaleString('en-US')}`;

// Datos de la Fase 5, con el gasto del mes de la Fase 6 (Q 4,542.50).
function cat(id: string, bucket: PlanCategory['bucket'], amount: number, fixed = false, day: number | null = null): PlanCategory {
  return { id, name: id, bucket, budgeted_amount: amount, pace_mode: fixed ? 'fixed' : 'linear', expected_day: day };
}
const categories: PlanCategory[] = [
  cat('vivienda', 'needs', 2800),
  cat('super', 'needs', 1500),
  cat('transporte', 'needs', 700),
  cat('servicios', 'needs', 700, true, 20),
  cat('salud', 'needs', 300),
  cat('restaurantes', 'wants', 400),
  cat('diversion', 'wants', 300),
  cat('ropa', 'wants', 200),
  cat('suscripciones', 'wants', 225, true, 12),
  cat('colchon', 'savings', 500, true),
  cat('viaje', 'savings', 300),
];
const subs: PlanSubItem[] = [
  { id: 'renta', category_id: 'vivienda', name: 'Renta', amount: 2500, is_fixed: true, expected_day: 1 },
  { id: 'mant', category_id: 'vivienda', name: 'Mantenimiento', amount: 200, is_fixed: true, expected_day: 31 },
  { id: 'repar', category_id: 'vivienda', name: 'Reparaciones', amount: 100, is_fixed: false },
];
const spentCat = { vivienda: 2500, super: 342.5, transporte: 377, servicios: 555, salud: 125, restaurantes: 516, diversion: 38, suscripciones: 89 };
const spentSub = { renta: 2500 };
const spent = Object.values(spentCat).reduce((a, b) => a + b, 0);
const OCT_3 = new Date(2026, 9, 3, 12);
const leaves = fixedLeaves(categories, subs);

describe('hojas fijas', () => {
  it('solo partes o categorías fijas de básico y gustos', () => {
    expect(leaves.map((l) => l.id)).toEqual(['renta', 'mant', 'servicios', 'suscripciones']);
  });
});

describe('criterios de aceptación', () => {
  const allOn: MonthChoices = initialChoices(leaves, [], null, null);

  it('el gasto del mes es Q 4,542.50', () => {
    expect(spent).toBe(4542.5);
  });

  it('sin inicio de mes: Q 89 al día', () => {
    const r = computeReserve(leaves, null, spentCat, spentSub);
    expect(r.reserved).toBe(0);
    expect(perDay(7125, spent, r.reserved, daysLeftInMonth(OCT_3))).toBe(89);
  });

  it('apartado Q 481 (200 + 145 + 136) y Q 72 al día', () => {
    const r = computeReserve(leaves, allOn, spentCat, spentSub);
    expect(r).toEqual({ reserved: 481, pendingCount: 3 });
    expect(perDay(7125, spent, r.reserved, 29)).toBe(72);
    expect(monthStartSummary(r, fmt)).toBe('Apartaste Q 481 para 3 pagos que faltan');
  });

  it('registrar Mantenimiento Q 200 no lo descuenta dos veces', () => {
    const r = computeReserve(leaves, allOn, { ...spentCat, vivienda: 2700 }, { ...spentSub, mant: 200 });
    expect(r.reserved).toBe(281);
    expect(perDay(7125, spent + 200, r.reserved, 29)).toBe(72);
  });

  it('apagar una hoja la deja como disponible', () => {
    const r = computeReserve(leaves, { ...allOn, expense: { ...allOn.expense, mant: false } }, spentCat, spentSub);
    expect(r.reserved).toBe(281);
  });

  it('apagar la 2da quincena sin recibir: te entran Q 4,850', () => {
    const incomes: PlanIncome[] = [
      { id: 'q1', source: 'Q1', amount: 4250, frequency: 'mensual', is_fixed: true },
      { id: 'q2', source: 'Q2', amount: 4250, frequency: 'mensual', is_fixed: true },
      { id: 'v', source: 'Ventas', amount: 600, frequency: 'mensual', is_fixed: false },
    ];
    const received = { q1: 4250 };
    expect(totalCountedIncome(incomes, received, null)).toBe(9100);
    expect(totalCountedIncome(incomes, received, { expense: {}, income: { q1: true, q2: false } })).toBe(4850);
  });
});

describe('countedIncome', () => {
  const fixed = { id: 'a', amount: 1000, frequency: 'mensual', is_fixed: true };
  it('variable y fijo', () => {
    expect(countedIncome({ ...fixed, is_fixed: false }, 1200, null)).toBe(1200);
    expect(countedIncome(fixed, 300, { expense: {}, income: { a: false } })).toBe(300);
    expect(countedIncome(fixed, 300, { expense: {}, income: { a: true } })).toBe(1000);
    expect(countedIncome(fixed, 0, null)).toBe(1000);
  });
});

describe('elecciones', () => {
  it('trae las del mes anterior y lo nuevo encendido', () => {
    const prev = { expense: { mant: false }, income: { q2: false } };
    const c = initialChoices(leaves, ['q1', 'q2'], null, prev);
    expect(c.expense).toEqual({ renta: true, mant: false, servicios: true, suscripciones: true });
    expect(c.income).toEqual({ q1: true, q2: false });
  });

  it('las del mes en curso ganan', () => {
    const c = initialChoices(leaves, [], { expense: { renta: false }, income: {} }, { expense: { renta: true }, income: {} });
    expect(c.expense.renta).toBe(false);
  });

  it('ida y vuelta a month_start_items', () => {
    const c = initialChoices(leaves, ['q1'], null, { expense: { servicios: false }, income: { q1: false } });
    const items = itemsFromChoices(leaves, ['q1'], c);
    expect(items.find((i) => i.sub_item_id === 'mant')).toMatchObject({ category_id: 'vivienda', counted: true });
    expect(items.find((i) => i.category_id === 'servicios')).toMatchObject({ sub_item_id: null, counted: false });
    expect(choicesFromItems(items)).toEqual(c);
  });

  it('todo pagado', () => {
    expect(monthStartSummary({ reserved: 0, pendingCount: 0 }, fmt)).toBe('Tus fijos de este mes ya están pagados');
    expect(monthStartSummary({ reserved: 200, pendingCount: 1 }, fmt)).toBe('Apartaste Q 200 para 1 pago que falta');
  });
});
