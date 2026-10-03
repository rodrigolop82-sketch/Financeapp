import { describe, expect, it } from 'vitest';
import {
  allocateReceived, categoryPlan, expenseStatus, impactText, incomeAmountFromMonthly, incomeStatus,
  inferIncomeCategory, monthName, planSummary, previousMonth, stackedWidths, subAmountFromMonthly,
  suggestSubItem, unassignedCopy, type PlanCategory, type PlanIncome, type PlanSubItem,
} from './plan-del-mes';

const fmt = (n: number) => `Q ${Math.round(n).toLocaleString('en-US')}`;

// Datos de prueba de los criterios de aceptación de la Fase 5.
function cat(id: string, bucket: PlanCategory['bucket'], amount: number, fixed = false, day: number | null = null): PlanCategory {
  return { id, name: id, bucket, budgeted_amount: amount, pace_mode: fixed ? 'fixed' : 'linear', expected_day: day };
}
const categories: PlanCategory[] = [
  cat('vivienda', 'needs', 0),
  cat('super', 'needs', 1500),
  cat('transporte', 'needs', 700),
  cat('servicios', 'needs', 700, true, 20),
  cat('salud', 'needs', 300),
  cat('restaurantes', 'wants', 400),
  cat('diversion', 'wants', 300),
  cat('ropa', 'wants', 200),
  cat('suscripciones', 'wants', 225, true, 12),
  cat('colchon', 'savings', 500),
  cat('viaje', 'savings', 300),
  cat('salario', 'income', 0),
];
const subs: PlanSubItem[] = [
  { id: 'renta', category_id: 'vivienda', name: 'Renta o hipoteca', amount: 2500, is_fixed: true, expected_day: 1 },
  { id: 'mant', category_id: 'vivienda', name: 'Cuota de mantenimiento', amount: 200, is_fixed: true, expected_day: 31 },
  { id: 'repar', category_id: 'vivienda', name: 'Reparaciones', amount: 100, is_fixed: false },
];
const incomes: PlanIncome[] = [
  { id: 'q1', source: 'Salario · 1ra quincena', amount: 4250, frequency: 'mensual', is_fixed: true, expected_day: 2 },
  { id: 'q2', source: 'Salario · 2da quincena', amount: 4250, frequency: 'mensual', is_fixed: true, expected_day: 30 },
  { id: 'extra', source: 'Ventas', amount: 600, frequency: 'mensual', is_fixed: false },
];

describe('planSummary', () => {
  it('cumple los totales de la tarjeta resumen', () => {
    const s = planSummary(categories, subs, incomes);
    expect(s.income).toBe(9100);
    expect(s.unassigned).toBe(1175);
    expect(s.needs).toBe(6000);
    expect(s.wants).toBe(1125);
    expect(s.savings).toBe(800);
    expect(s.fixed).toBe(3625);
    expect(s.variable).toBe(3500);
  });

  it('subir Súper a 1,800 deja 875 sin asignar', () => {
    const changed = categories.map((c) => (c.id === 'super' ? { ...c, budgeted_amount: 1800 } : c));
    expect(planSummary(changed, subs, incomes).unassigned).toBe(875);
  });

  it('usa FREQUENCY_MULTIPLIER para los ingresos', () => {
    const s = planSummary([], [], [{ id: 'a', source: 'x', amount: 1000, frequency: 'quincenal' }]);
    expect(s.income).toBe(2000);
  });

  it('las partes ignoran el pace_mode de su categoría', () => {
    const fixedCat = [{ ...categories[0], pace_mode: 'fixed' as const }];
    const s = planSummary(fixedCat, subs, []);
    expect(s.fixed).toBe(2700);
    expect(s.variable).toBe(100);
  });
});

describe('categoryPlan', () => {
  it('suma las partes respetando la recurrencia', () => {
    expect(categoryPlan(categories[0], subs)).toBe(2800);
    const anual: PlanSubItem = { id: 'x', category_id: 'salud', name: 'Seguro', amount: 1200, is_fixed: true, recurrence: 'anual' };
    expect(categoryPlan(categories[4], [anual])).toBe(100);
  });

  it('sin partes usa budgeted_amount', () => {
    expect(categoryPlan(categories[1], subs)).toBe(1500);
  });
});

describe('conversiones de monto', () => {
  it('ida y vuelta de mensual a la frecuencia de la fila', () => {
    expect(incomeAmountFromMonthly(8000, 'quincenal')).toBe(4000);
    expect(subAmountFromMonthly(100, 'anual')).toBe(1200);
    expect(subAmountFromMonthly(100, 'mensual')).toBe(100);
  });
});

describe('stackedWidths', () => {
  it('divide entre el mayor de ingresos y asignado', () => {
    const w = stackedWidths({ income: 1000, needs: 500, wants: 300, savings: 400, assigned: 1200 });
    expect(w.needs).toBeCloseTo(41.67, 1);
    expect(w.savings).toBeCloseTo(33.33, 1);
  });
});

describe('unassignedCopy', () => {
  it('tres casos', () => {
    expect(unassignedCopy(10).label).toBe('Sin asignar');
    expect(unassignedCopy(0).label).toBe('Todo tiene a dónde ir');
    expect(unassignedCopy(-1).hint).toBe('Tu plan pide más de lo que te entra. Baja alguna categoría.');
  });
});

describe('expenseStatus', () => {
  it('pasado de lo planeado', () => {
    const s = expenseStatus(400, 516, false, fmt);
    expect(s).toMatchObject({ text: 'Q 116 de más', tone: 'danger', bar: 'danger', pct: 100 });
  });
  it('fijo pagado, parcial y sin pagar', () => {
    expect(expenseStatus(200, 200, true, fmt).text).toBe('Pagado ✓');
    expect(expenseStatus(700, 555, true, fmt).text).toBe('Pagado Q 555 · faltan Q 145');
    expect(expenseStatus(700, 0, true, fmt).text).toBe('Falta pagar');
  });
  it('fijo apartado en el inicio de mes', () => {
    expect(expenseStatus(200, 0, true, fmt, { day: 31 }).text).toBe('Apartado Q 200 · vence el 31');
    expect(expenseStatus(700, 555, true, fmt, { day: null }).text).toBe('Pagado Q 555 · Apartado Q 145');
    expect(expenseStatus(200, 200, true, fmt, { day: 31 }).text).toBe('Pagado ✓');
  });
  it('un fijo al 85% sigue en azul', () => {
    expect(expenseStatus(700, 650, true, fmt).bar).toBe('normal');
  });
  it('variable sin gasto y con gasto', () => {
    expect(expenseStatus(300, 0, false, fmt).text).toBe('Nada gastado todavía');
    const s = expenseStatus(700, 377, false, fmt);
    expect(s).toMatchObject({ text: 'Llevas Q 377 · quedan Q 323', tone: 'muted', bar: 'normal' });
  });
  it('variable al 85% o más va en ámbar', () => {
    expect(expenseStatus(100, 85, false, fmt)).toMatchObject({ tone: 'warning', bar: 'warning' });
  });
});

describe('incomeStatus', () => {
  it('variable, recibido, parcial, pendiente y sin día', () => {
    expect(incomeStatus(600, 0, false, null, fmt).text).toBe('Estimado · llevas Q 0');
    expect(incomeStatus(4250, 4250, true, 2, fmt).text).toBe('Recibido ✓');
    expect(incomeStatus(4250, 1000, true, 2, fmt).text).toBe('Recibido Q 1,000 · faltan Q 3,250');
    expect(incomeStatus(4250, 0, true, 30, fmt).text).toBe('Llega el día 30');
    expect(incomeStatus(4250, 0, true, null, fmt).text).toBe('Sin fecha fija');
  });
  it('un ingreso de 0 no se marca como recibido', () => {
    expect(incomeStatus(0, 0, true, null, fmt).text).toBe('Sin fecha fija');
  });
});

describe('allocateReceived', () => {
  it('llena las quincenas en orden', () => {
    const rows = [
      { id: 'q1', amount: 4250, frequency: 'mensual', categoryId: 'salario' },
      { id: 'q2', amount: 4250, frequency: 'mensual', categoryId: 'salario' },
      { id: 'x', amount: 600, frequency: 'mensual', categoryId: null },
    ];
    expect(allocateReceived(rows, { salario: 4250 })).toEqual({ q1: 4250, q2: 0, x: 0 });
    expect(allocateReceived(rows, { salario: 9000 })).toEqual({ q1: 4250, q2: 4750, x: 0 });
  });
});

describe('inferIncomeCategory', () => {
  const cats = [{ id: 's', name: 'Salario' }, { id: 'o', name: 'Otros ingresos' }];
  it('por nombre o por fijo/variable', () => {
    expect(inferIncomeCategory('Salario · 1ra quincena', true, cats)?.id).toBe('s');
    expect(inferIncomeCategory('Ventas', false, cats)?.id).toBe('o');
    expect(inferIncomeCategory('Bono', true, cats)?.id).toBe('s');
    expect(inferIncomeCategory('x', true, [])).toBeNull();
  });
});

describe('suggestSubItem', () => {
  const parts = [{ id: 'renta', name: 'Renta o hipoteca' }, { id: 'mant', name: 'Cuota de mantenimiento' }];
  it('sugiere por palabras clave', () => {
    expect(suggestSubItem('cuota mantenimiento 200', parts)?.id).toBe('mant');
    expect(suggestSubItem('pagué el alquiler', parts)?.id).toBe('renta');
    expect(suggestSubItem('Hipoteca octubre', parts)?.id).toBe('renta');
  });
  it('si ninguna coincide, pregunta', () => {
    expect(suggestSubItem('uber 38', parts)).toBeNull();
    expect(suggestSubItem('cuota del gimnasio', [{ id: 'g', name: 'Gimnasio' }])).toBeNull();
  });
});

describe('textos', () => {
  it('impacto en vivo', () => {
    expect(impactText(875, false, fmt)).toBe('Te quedarían Q 875 sin asignar');
    expect(impactText(0, false, fmt)).toBe('Todo tu dinero queda asignado');
    expect(impactText(-50, false, fmt)).toBe('Te pasarías Q 50 de lo que te entra');
    expect(impactText(-50, true, fmt)).toBe('Tu plan pediría Q 50 más de lo que te entra');
  });
  it('meses', () => {
    expect(monthName('2026-10')).toBe('octubre');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});
