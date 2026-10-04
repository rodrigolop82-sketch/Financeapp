import { describe, expect, it } from 'vitest';
import {
  adviceFor, buildRecommendations, capListText, capPlanChanges, categoryCapKeys, DEFAULT_CAPS, groupKind,
  horizonMonths, inferCapKey, planByCapKey, planOverCaps, projection, resolveCaps,
  type CapGroupInput, type PlanItem,
} from './recomendaciones';

const fmt = (n: number) => `Q ${Math.round(n).toLocaleString('en-US')}`;

// Mes del criterio de aceptación de la Fase 10 (prototipo "Cómo te fue").
const INCOME = 19500;
const groups: CapGroupInput[] = [
  { key: 'comida', spent: 3350, fixedSpent: 0, topSub: { name: 'Restaurantes', amount: 1250 } },
  { key: 'gustos', spent: 2150, fixedSpent: 0 },
  { key: 'vivienda', spent: 6800, fixedSpent: 6800 },
  { key: 'carro', spent: 3100, fixedSpent: 2300 },
  { key: 'deudas', spent: 1500, fixedSpent: 1500 },
  { key: 'suscripciones', spent: 620, fixedSpent: 620 },
];

describe('buildRecommendations', () => {
  const res = buildRecommendations(groups, INCOME, DEFAULT_CAPS, fmt);
  const byKey = (k: string) => res.over.find((r) => r.key === k);

  it('vivienda: fija, 35% de los ingresos, Q 950 al mes (criterio 1)', () => {
    const v = byKey('vivienda')!;
    expect(v.kind).toBe('fijo');
    expect(Math.round(v.pct)).toBe(35);
    expect(v.saving).toBe(950);
    expect(v.capAmount).toBe(5850);
  });

  it('alimentación: variable, Q 425 al mes (criterio 1)', () => {
    const c = byKey('comida')!;
    expect(c.kind).toBe('variable');
    expect(c.name).toBe('Alimentación');
    expect(c.saving).toBe(425);
  });

  it('sobre tope: ahorro = gasto − tope × ingresos', () => {
    expect(byKey('gustos')!.saving).toBe(2150 - 1950);
    expect(byKey('carro')!.saving).toBe(3100 - 2925);
    expect(byKey('suscripciones')).toBeUndefined();
  });

  it('bajo tope: va a "dentro de su tope" con su % y su tope', () => {
    // Deudas 1,500 = 7.7% < 20%; suscripciones 620 = 3.2% < 5%.
    expect(res.ok.map((o) => o.key).sort()).toEqual(['deudas', 'suscripciones']);
    const d = res.ok.find((o) => o.key === 'deudas')!;
    expect(Math.round(d.pct)).toBe(8);
    expect(d.cap).toBe(20);
    expect(byKey('deudas')).toBeUndefined();
  });

  it('ordena variables primero y, dentro, por ahorro de mayor a menor', () => {
    expect(res.over.map((r) => `${r.kind}:${r.key}`)).toEqual([
      'variable:comida', // 425
      'variable:gustos', // 200
      'fijo:vivienda', // 950
      'fijo:carro', // 175
    ]);
  });

  it('suma lo que se podría liberar al mes', () => {
    expect(res.potential).toBe(425 + 200 + 950 + 175);
  });

  it('tope editado: vivienda a 36% sale de oportunidades y queda dentro de su tope (criterio 2)', () => {
    const caps = { ...DEFAULT_CAPS, vivienda: 36 };
    const r = buildRecommendations(groups, INCOME, caps, fmt);
    expect(r.over.find((x) => x.key === 'vivienda')).toBeUndefined();
    const ok = r.ok.find((x) => x.key === 'vivienda')!;
    expect(ok.cap).toBe(36);
    expect(Math.round(ok.pct)).toBe(35);
    expect(r.potential).toBe(425 + 200 + 175);
  });

  it('tope editado más bajo: aparece una oportunidad nueva', () => {
    const r = buildRecommendations(groups, INCOME, { ...DEFAULT_CAPS, deudas: 5 }, fmt);
    expect(r.over.find((x) => x.key === 'deudas')!.saving).toBe(1500 - 975);
  });

  it('sin ingresos no hay recomendaciones', () => {
    expect(buildRecommendations(groups, 0, DEFAULT_CAPS, fmt)).toEqual({ over: [], ok: [], potential: 0 });
  });

  it('ignora topes sin gasto', () => {
    const r = buildRecommendations([{ key: 'carro', spent: 0, fixedSpent: 0 }], INCOME, DEFAULT_CAPS, fmt);
    expect(r.over).toEqual([]);
    expect(r.ok).toEqual([]);
  });

  it('consejo con el dato real de la subcategoría con más gasto', () => {
    expect(byKey('comida')!.advice).toBe('Restaurantes fue Q 1,250. Cocinar 2 veces más por semana cubre casi todo.');
    expect(byKey('carro')!.advice).toContain('(Q 800)');
    expect(byKey('gustos')!.advice).toBe('Ponte un tope semanal de Q 450 para salidas y revísalo cada domingo.');
  });
});

describe('groupKind', () => {
  it('fijo si la mitad o más del gasto es fijo; sin gasto, según el plan', () => {
    expect(groupKind({ spent: 3100, fixedSpent: 2300 })).toBe('fijo');
    expect(groupKind({ spent: 3100, fixedSpent: 800 })).toBe('variable');
    expect(groupKind({ spent: 0, fixedSpent: 0, planFixed: true })).toBe('fijo');
  });
});

describe('adviceFor', () => {
  it('súper sin restaurantes: consejo de lista', () => {
    expect(adviceFor('comida', { saving: 300, capAmount: 2000, variableSpent: 0, topSub: { name: 'Supermercado', amount: 1800 } }, fmt))
      .toBe('Supermercado fue Q 1,800. Haz una lista antes de ir al súper y compra por semana, no por antojo.');
  });
});

describe('proyección', () => {
  it('a diciembre desde septiembre: octubre, noviembre y diciembre', () => {
    expect(horizonMonths('2026-09', 'year')).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(horizonMonths('2026-12', 'year')).toEqual([]);
  });

  it('12 meses cruzan de año', () => {
    const m = horizonMonths('2026-09', '12');
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2026-10');
    expect(m[11]).toBe('2027-09');
  });

  it('acumula ahorro base y extra mes a mes', () => {
    const p = projection(1080, 625, horizonMonths('2026-09', 'year'));
    expect(p.points.map((x) => x.base)).toEqual([1080, 2160, 3240]);
    expect(p.points.map((x) => x.total)).toEqual([1705, 3410, 5115]);
    expect(p.extraTotal).toBe(1875);
    expect(p.baseTotal).toBe(3240);
    expect(p.total).toBe(5115);
  });

  it('cambia al sumar o quitar recomendaciones (criterio 3)', () => {
    const res = buildRecommendations(groups, INCOME, DEFAULT_CAPS, fmt);
    const extraOf = (keys: string[]) => res.over.filter((r) => keys.includes(r.key)).reduce((a, r) => a + r.saving, 0);
    const months = horizonMonths('2026-09', '12');
    const a = projection(1080, extraOf(['comida', 'gustos']), months);
    const b = projection(1080, extraOf(['comida', 'gustos', 'vivienda']), months);
    const c = projection(1080, extraOf(['gustos']), months);
    expect(a.extraTotal).toBe(625 * 12);
    expect(b.extraTotal - a.extraTotal).toBe(950 * 12);
    expect(c.extraTotal).toBe(200 * 12);
    expect(c.baseTotal).toBe(a.baseTotal);
  });
});

describe('topes', () => {
  it('resolveCaps usa los guardados sobre los recomendados', () => {
    expect(resolveCaps([{ cap_key: 'vivienda', pct: '36.00' }, { cap_key: 'otro', pct: 9 }])).toEqual({ ...DEFAULT_CAPS, vivienda: 36 });
    expect(resolveCaps(null)).toEqual(DEFAULT_CAPS);
  });

  it('inferCapKey mapea las categorías por nombre', () => {
    expect(inferCapKey('Vivienda/alquiler', 'needs')).toBe('vivienda');
    expect(inferCapKey('Alimentación', 'needs')).toBe('comida');
    expect(inferCapKey('Restaurantes y salidas', 'wants')).toBe('comida');
    expect(inferCapKey('Transporte', 'needs')).toBe('carro');
    expect(inferCapKey('Entretenimiento', 'wants')).toBe('gustos');
    expect(inferCapKey('Ropa', 'wants')).toBe('gustos');
    expect(inferCapKey('Suscripciones', 'wants')).toBe('suscripciones');
    expect(inferCapKey('Tarjeta de crédito', 'needs')).toBe('deudas');
    expect(inferCapKey('Servicios (agua, luz, internet)', 'needs')).toBeNull();
    expect(inferCapKey('Salud/medicinas', 'needs')).toBeNull();
    expect(inferCapKey('Pago de deudas extra', 'savings')).toBeNull();
    expect(inferCapKey('Gastos parentales', 'needs')).toBeNull();
  });

  it('categoryCapKeys: guardado, luego el del padre, luego por nombre', () => {
    const keys = categoryCapKeys([
      { id: 'a', name: 'Alimentación', bucket: 'needs', cap_key: null },
      { id: 'b', name: 'Mis antojos', bucket: 'needs', parent_category_id: 'a' },
      { id: 'c', name: 'Casa de playa', bucket: 'wants', cap_key: 'gustos' },
      { id: 'd', name: 'Fondo de emergencia', bucket: 'savings', cap_key: 'deudas' },
    ]);
    expect(keys).toEqual({ a: 'comida', b: 'comida', c: 'gustos', d: null });
  });
});

describe('plan contra los topes', () => {
  const items: PlanItem[] = [
    { categoryId: 'viv', key: 'vivienda', plan: 6800, parts: [] },
    { categoryId: 'ali', key: 'comida', plan: 2000, parts: [{ id: 'p1', monthly: 1500 }, { id: 'p2', monthly: 500 }] },
    { categoryId: 'res', key: 'comida', plan: 1300, parts: [] },
    { categoryId: 'srv', key: null, plan: 900, parts: [] },
  ];

  it('detecta los topes que el plan pasa', () => {
    const plan = planByCapKey(items);
    expect(plan).toEqual({ vivienda: 6800, comida: 3300 });
    expect(planOverCaps(plan, INCOME, DEFAULT_CAPS)).toEqual(['vivienda', 'comida']);
    expect(planOverCaps(plan, INCOME, { ...DEFAULT_CAPS, vivienda: 36, comida: 17 })).toEqual([]);
    expect(capListText(['vivienda', 'comida'])).toBe('vivienda y alimentación');
    expect(capListText(['vivienda', 'carro', 'comida'])).toBe('vivienda, carro y alimentación');
  });

  it('aplicar: baja el plan al tope, en proporción entre categorías y partes', () => {
    const ch = capPlanChanges(items, ['vivienda', 'comida'], INCOME, DEFAULT_CAPS);
    expect(ch).toEqual([
      { kind: 'category', id: 'viv', categoryId: 'viv', fromMonthly: 6800, toMonthly: 5850 },
      { kind: 'part', id: 'p1', categoryId: 'ali', fromMonthly: 1500, toMonthly: 1329 },
      { kind: 'part', id: 'p2', categoryId: 'ali', fromMonthly: 500, toMonthly: 443 },
      { kind: 'category', id: 'res', categoryId: 'res', fromMonthly: 1300, toMonthly: 1152 },
    ]);
    const comida = ch.filter((c) => c.categoryId !== 'viv').reduce((a, c) => a + c.toMonthly, 0);
    expect(comida).toBeLessThanOrEqual(2925);
  });

  it('aplicar no toca un tope que el plan ya respeta', () => {
    expect(capPlanChanges(items, ['carro', 'vivienda'], INCOME, { ...DEFAULT_CAPS, vivienda: 40 })).toEqual([]);
  });
});
