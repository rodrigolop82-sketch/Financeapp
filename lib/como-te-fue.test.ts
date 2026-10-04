import { describe, expect, it } from 'vitest';
import {
  averageOf, bucketShares, bucketsInsight, capGroups, categoryStatus, chartMonths, fixedResolver, fixedVarInsight,
  fixedVarShares, merchantGroups, monthHighlights, monthTotals, planItems, roundShares, savingsPct, spendByCategory,
  timesText, vsPlanText, type CtfCategory, type CtfTx,
} from './como-te-fue';
import { buildRecommendations, categoryCapKeys, DEFAULT_CAPS } from './recomendaciones';
import type { PlanSubItem } from './plan-del-mes';

const fmt = (n: number) => `Q ${Math.round(n).toLocaleString('en-US')}`;

const cats: CtfCategory[] = [
  { id: 'viv', name: 'Vivienda/alquiler', bucket: 'needs', budgeted_amount: 6800, pace_mode: 'fixed' },
  { id: 'ali', name: 'Alimentación', bucket: 'needs', budgeted_amount: 2000, pace_mode: 'linear' },
  { id: 'res', name: 'Restaurantes y salidas', bucket: 'wants', budgeted_amount: 1300, pace_mode: 'linear' },
  { id: 'srv', name: 'Servicios (agua, luz, internet)', bucket: 'needs', budgeted_amount: 900, pace_mode: 'fixed' },
  { id: 'fon', name: 'Fondo de emergencia', bucket: 'savings', budgeted_amount: 500 },
  { id: 'sal', name: 'Salario', bucket: 'income', budgeted_amount: 0 },
];
const subs: PlanSubItem[] = [
  { id: 'super', category_id: 'ali', name: 'Supermercado', amount: 1500, is_fixed: false },
  { id: 'mercado', category_id: 'ali', name: 'Mercado', amount: 500, is_fixed: false },
];

let n = 0;
const tx = (category_id: string | null, amount: number, date: string, type: 'expense' | 'income' = 'expense', budget_sub_item_id: string | null = null): CtfTx =>
  ({ id: `t${n++}`, category_id, amount, date, type, budget_sub_item_id });

const sep: CtfTx[] = [
  tx('sal', 19500, '2026-09-01', 'income'),
  tx('viv', 6800, '2026-09-01'),
  tx('ali', 1400, '2026-09-10', 'expense', 'super'),
  tx('ali', 700, '2026-09-12', 'expense', 'mercado'),
  tx('res', 1250, '2026-09-20'),
  tx('srv', 900, '2026-09-08'),
  tx('fon', 500, '2026-09-02'),
  tx(null, 100, '2026-09-25'),
];
const aug: CtfTx[] = [
  tx('sal', 19500, '2026-08-01', 'income'),
  tx('viv', 6800, '2026-08-01'),
  tx('ali', 2600, '2026-08-10', 'expense', 'super'),
  tx('res', 700, '2026-08-20'),
  tx('srv', 900, '2026-08-08'),
];

const fixed = fixedResolver(cats, subs);

describe('fixedResolver', () => {
  it('usa is_fixed de la parte y, sin parte, el de la categoría', () => {
    expect(fixed.tx({ category_id: 'viv' })).toBe(true);
    expect(fixed.tx({ category_id: 'ali', budget_sub_item_id: 'super' })).toBe(false);
    expect(fixed.tx({ category_id: null })).toBe(false);
    expect(fixed.category('srv')).toBe(true);
  });
});

describe('monthTotals', () => {
  const [a, s] = monthTotals([...aug, ...sep], ['2026-08', '2026-09'], cats, fixed.tx);

  it('separa ingresos, gastos (básico + gustos) y lo que va a ahorro', () => {
    expect(s.income).toBe(19500);
    expect(s.needs).toBe(6800 + 2100 + 900 + 100);
    expect(s.wants).toBe(1250);
    expect(s.savingsBucket).toBe(500);
    expect(s.spent).toBe(11150);
    expect(s.saved).toBe(19500 - 11150);
    expect(s.fixed).toBe(7700);
    expect(s.variable).toBe(3450);
    expect(a.hasData).toBe(true);
  });

  it('reparte en % que suman 100', () => {
    const sh = bucketShares(s)!;
    expect(sh.needs + sh.wants + sh.savings).toBe(100);
    expect(sh).toEqual({ needs: 51, wants: 6, savings: 43 });
    expect(savingsPct(s)).toBe(43);
    expect(fixedVarShares(s)).toEqual({ fixed: 69, variable: 31 });
  });

  it('gastar de más deja el ahorro en 0', () => {
    const t = monthTotals([tx('sal', 1000, '2026-07-01', 'income'), tx('ali', 1500, '2026-07-02')], ['2026-07'], cats, fixed.tx)[0];
    expect(bucketShares(t)).toEqual({ needs: 100, wants: 0, savings: 0 });
    expect(savingsPct(t)).toBe(-50);
    expect(bucketShares(monthTotals([], ['2026-06'], cats, fixed.tx)[0])).toBeNull();
  });
});

describe('roundShares', () => {
  it('mayor residuo', () => {
    expect(roundShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundShares([0, 0])).toEqual([0, 0]);
  });
});

describe('chartMonths', () => {
  it('hasta 6 meses desde el primero con datos', () => {
    expect(chartMonths('2026-09', '2026-01')).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(chartMonths('2026-09', '2026-08')).toEqual(['2026-08', '2026-09']);
    expect(chartMonths('2026-09', null)).toHaveLength(6);
  });
});

describe('capGroups', () => {
  const keys = categoryCapKeys(cats);
  const spend = spendByCategory(sep, '2026-09', cats, fixed.tx);
  const groups = capGroups(spend, keys, subs, fixed.category, cats);

  it('agrupa por tope y elige la subcategoría con más gasto', () => {
    const comida = groups.find((g) => g.key === 'comida')!;
    expect(comida.spent).toBe(2100 + 1250);
    expect(comida.fixedSpent).toBe(0);
    expect(comida.topSub).toEqual({ name: 'Supermercado', amount: 1400 });
    const viv = groups.find((g) => g.key === 'vivienda')!;
    expect(viv.fixedSpent).toBe(6800);
    expect(groups.find((g) => g.key === 'carro')).toBeUndefined();
  });

  it('con el motor: Q 950 en vivienda y Q 425 en alimentación', () => {
    const r = buildRecommendations(groups, 19500, DEFAULT_CAPS, fmt);
    expect(r.over.map((x) => [x.key, x.kind, x.saving])).toEqual([['comida', 'variable', 425], ['vivienda', 'fijo', 950]]);
  });

  it('partidas del plan vigente con sus partes', () => {
    const items = planItems(cats, subs, keys);
    expect(items.map((i) => [i.categoryId, i.key, i.plan])).toEqual([
      ['viv', 'vivienda', 6800], ['ali', 'comida', 2000], ['res', 'comida', 1300], ['srv', null, 900],
    ]);
    expect(items[1].parts).toEqual([{ id: 'super', monthly: 1500 }, { id: 'mercado', monthly: 500 }]);
  });
});

describe('monthHighlights', () => {
  const base = { okCaps: [], savingsNow: 10, savingsThen: null, prevMonth: '2026-08', fmt };

  it('bien: topes respetados y bajas contra el mes anterior (máx. 3)', () => {
    const r = monthHighlights({
      ...base,
      okCaps: [
        { key: 'deudas', name: 'Deudas', emoji: '', spent: 1500, pct: 7.7, cap: 20 },
        { key: 'suscripciones', name: 'Suscripciones', emoji: '', spent: 620, pct: 3.2, cap: 5 },
        { key: 'carro', name: 'Carro', emoji: '', spent: 100, pct: 1, cap: 15 },
      ],
      categories: [{ id: 'ali', name: 'Alimentación', spent: 2100, prev: 2600, avg3: 2600, plan: 2000 }],
    });
    expect(r.good).toEqual([
      'Deudas: 8% de tus ingresos, bajo tu tope de 20%.',
      'Gastaste Q 500 menos en alimentación que en agosto.',
      'Suscripciones: 3% de tus ingresos, bajo tu tope de 5%.',
    ]);
  });

  it('mal: subida contra el promedio, sobre plan y caída del ahorro', () => {
    const r = monthHighlights({
      ...base,
      savingsNow: 5,
      savingsThen: { month: '2026-04', pct: 12 },
      categories: [
        { id: 'res', name: 'Restaurantes', spent: 1250, prev: 800, avg3: 770, plan: 1300 },
        { id: 'ent', name: 'Entretenimiento', spent: 2150, prev: 2100, avg3: 2100, plan: 1800 },
        { id: 'ali', name: 'Alimentación', spent: 2000, prev: 2000, avg3: 2000, plan: 2000 },
      ],
    });
    expect(r.bad).toEqual([
      'Restaurantes: Q 1,250, Q 480 más que tu promedio.',
      'Entretenimiento se pasó de su plan por Q 350.',
      'Tu ahorro bajó a 5%; en abril era 12%.',
    ]);
  });

  it('sin historia ni topes no inventa nada', () => {
    const r = monthHighlights({ ...base, categories: [{ id: 'a', name: 'A', spent: 100, prev: null, avg3: null, plan: 0 }] });
    expect(r).toEqual({ good: [], bad: [] });
  });

  it('ahorro sano cuenta como bien', () => {
    const r = monthHighlights({ ...base, savingsNow: 25, categories: [] });
    expect(r.good).toEqual(['Ahorraste el 25% de tus ingresos: lo sano es 20% o más.']);
  });
});

describe('textos', () => {
  it('insight de ahorro y de variables', () => {
    const series = monthTotals([...aug, ...sep], ['2026-08', '2026-09'], cats, fixed.tx);
    expect(bucketsInsight(series)).toBe('Tu ahorro se ha mantenido cerca de 43% en 2 meses.');
    const worse = monthTotals([...aug, ...sep, tx('res', 5000, '2026-09-28')], ['2026-08', '2026-09'], cats, fixed.tx);
    expect(bucketsInsight(worse)).toBe('Tu ahorro bajó de 44% a 17% en 2 meses, mientras los gustos subieron.');
    expect(fixedVarInsight(worse, fmt)).toBe('Los variables subieron Q 5,150 desde agosto. Son los más fáciles de bajar; los fijos piden cambiar contratos, deudas o servicios.');
    expect(fixedVarInsight(series, fmt)).toMatch(/^Los variables subieron|^Los variables bajaron|^Tus variables/);
    expect(bucketsInsight(series.slice(1))).toMatch(/^Así se repartieron/);
  });

  it('estado de categoría, vs plan, comercios y veces', () => {
    expect(categoryStatus({ capOver: true, cap: 30, spent: 6800, plan: 6800 }, fmt)).toEqual({ text: 'Pasa tope 30%', tone: 'warning' });
    expect(categoryStatus({ capOver: false, cap: 10, spent: 2150, plan: 1800 }, fmt)).toEqual({ text: '+Q 350 vs plan', tone: 'warning' });
    expect(categoryStatus({ capOver: false, cap: null, spent: 900, plan: 950 }, fmt).text).toBe('En línea');
    expect(vsPlanText(2150, 1800, fmt)).toEqual({ text: '+Q 350', over: true });
    expect(vsPlanText(900, 950, fmt)).toEqual({ text: '−Q 50', over: false });
    expect(vsPlanText(900, 900, fmt).text).toBe('Igual');
    expect(merchantGroups([
      { description: 'La Torre', amount: 620 }, { description: 'la torre', amount: 540 }, { description: 'Walmart', amount: 460 },
    ], (d) => d)).toEqual([{ name: 'La Torre', total: 1160, count: 2 }, { name: 'Walmart', total: 460, count: 1 }]);
    expect(timesText(1)).toBe('1 vez');
    expect(timesText(3)).toBe('3 veces');
    expect(averageOf([null, 100, 200])).toBe(150);
    expect(averageOf([null])).toBeNull();
  });
});
