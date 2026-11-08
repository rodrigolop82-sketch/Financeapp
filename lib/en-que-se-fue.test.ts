import { describe, expect, it } from 'vitest';
import { fixedResolver, monthTotals, type CtfCategory, type CtfTx } from './como-te-fue';
import { enQueSeFue, META_AHORRO_PCT, type EnQueSeFue } from './en-que-se-fue';

const fmt = (n: number) => `Q ${Math.round(n).toLocaleString('en-US')}`;
const MES = '2026-10';

const cats: CtfCategory[] = [
  { id: 'edu', name: 'Educación', bucket: 'needs', budgeted_amount: 12800, pace_mode: 'fixed' },
  { id: 'viv', name: 'Vivienda/alquiler', bucket: 'needs', budgeted_amount: 9000, pace_mode: 'fixed' },
  { id: 'ali', name: 'Alimentación', bucket: 'needs', budgeted_amount: 9000, pace_mode: 'linear' },
  { id: 'tra', name: 'Transporte', bucket: 'needs', budgeted_amount: 3000, pace_mode: 'linear' },
  { id: 'sal', name: 'Salud/medicinas', bucket: 'needs', budgeted_amount: 2500, pace_mode: 'linear' },
  { id: 'res', name: 'Restaurantes y salidas', bucket: 'wants', budgeted_amount: 6000, pace_mode: 'linear' },
  { id: 'com', name: 'Compras', bucket: 'wants', budgeted_amount: 4000, pace_mode: 'linear' },
  { id: 'act', name: 'Actividades niños', bucket: 'wants', budgeted_amount: 3500, pace_mode: 'linear' },
  { id: 'sus', name: 'Suscripciones', bucket: 'wants', budgeted_amount: 1500, pace_mode: 'fixed' },
  { id: 'otr', name: 'Otros gustos', bucket: 'wants', budgeted_amount: 2500, pace_mode: 'linear' },
  { id: 'ib', name: 'Interactive Brokers', bucket: 'savings', budgeted_amount: 0 },
  { id: 'sue', name: 'Salario', bucket: 'income', budgeted_amount: 0 },
];

// Lo del mockup: gastaste 54,783 (básico 36,683 + gustos 18,100), apartaste 26,950.
const GASTO: [string, number][] = [
  ['edu', 12792], ['viv', 9450], ['ali', 8620], ['tra', 3140], ['sal', 2681],
  ['res', 6900], ['com', 4520], ['act', 3200], ['sus', 1480], ['otr', 2000],
];
const PLAN: Record<string, number> = {
  edu: 12800, viv: 9000, ali: 9000, tra: 3000, sal: 2500, res: 6000, com: 4000, act: 3500, sus: 1500, otr: 2500,
};

let n = 0;
const tx = (category_id: string | null, amount: number, type: 'expense' | 'income' = 'expense', extra: Partial<CtfTx> = {}): CtfTx =>
  ({ id: `t${n++}`, category_id, amount, date: `${MES}-10`, type, ...extra });

function octubre(opts: { ingresos?: number | null; plan?: Record<string, number>; extra?: CtfTx[]; intereses?: Map<string, number> } = {}): EnQueSeFue | null {
  const ingresos = opts.ingresos === undefined ? 69600 : opts.ingresos;
  const txs: CtfTx[] = [
    ...GASTO.map(([id, amt]) => tx(id, amt)),
    tx('ib', 26950),
    ...(ingresos ? [tx('sue', ingresos, 'income')] : []),
    ...(opts.extra ?? []),
  ];
  const fixed = fixedResolver(cats, []);
  const [totals] = monthTotals(txs, [MES], cats, fixed.share, opts.intereses);
  return enQueSeFue({ month: MES, totals, txs, categories: cats, planOf: opts.plan ?? PLAN, intereses: opts.intereses, fmt });
}

describe('enQueSeFue · ejemplo del mockup', () => {
  const r = octubre()!;

  it('suma gastaste y apartaste', () => {
    expect(r.gastaste).toBe(54783);
    expect(r.apartaste).toBe(26950);
    expect(r.salidas).toBe(81733);
  });

  it('vs ingresos: +Q 12,133 · +17 %', () => {
    expect(r.vsIngresos).toEqual({ diff: 12133, pct: 17 });
  });

  it('vs presupuesto de gasto: +Q 983 · +2 % (sin la meta de ahorro)', () => {
    expect(r.presupuestoGasto).toBe(53800);
    expect(r.vsPresupuestoGasto).toEqual({ diff: 983, pct: 2 });
  });

  it('tasa de ahorro 21 % y te pasaste: compensado', () => {
    expect(r.tasaAhorro).toBe(21);
    expect(r.tono).toBe('compensado');
    expect(r.mensaje).toBe('Te pasaste Q 983 en gasto, pero ahorraste 21% (meta 20%).');
  });

  it('los tres porcentajes suman 100', () => {
    expect(r.tipos.reduce((a, t) => a + t.pct, 0)).toBe(100);
    expect(r.tipos.map((t) => t.pct)).toEqual([45, 22, 33]);
  });

  it('lo básico: te pasaste por Q 383; gustos: Q 600', () => {
    const [needs, wants] = r.tipos;
    expect(needs).toMatchObject({ label: 'Lo básico', monto: 36683, presupuesto: 36300, diff: 383, estado: 'over' });
    expect(wants).toMatchObject({ label: 'Gustos', monto: 18100, presupuesto: 17500, diff: 600, estado: 'over' });
  });

  it('las categorías suman el monto del tipo y van de mayor a menor gasto', () => {
    for (const t of r.tipos) {
      expect(Math.round(t.categorias.reduce((a, c) => a + c.gastado, 0) * 100) / 100).toBe(t.monto);
      const g = t.categorias.map((c) => c.gastado);
      expect(g).toEqual([...g].sort((a, b) => b - a));
    }
    expect(r.tipos[0].categorias[0]).toMatchObject({ id: 'edu', gastado: 12792, presupuesto: 12800, diff: -8, estado: 'ok' });
    expect(r.tipos[0].categorias[1]).toMatchObject({ id: 'viv', diff: 450, estado: 'over' });
  });

  it('ahorro: el traslado a inversión cae en Ahorro, no en gasto; meta 20 % de los ingresos', () => {
    const ahorro = r.tipos[2];
    expect(ahorro).toMatchObject({ key: 'savings', monto: 26950, presupuesto: 13920, diff: 13030, estado: 'meta' });
    expect(ahorro.categorias).toEqual([
      { id: 'ib', nombre: 'Interactive Brokers', gastado: 26950, presupuesto: null, diff: null, estado: 'sin-plan' },
    ]);
    expect(r.gastaste).toBe(54783);
  });
});

describe('enQueSeFue · tono según pasarse y ahorro', () => {
  it('te pasaste y ahorraste menos de 20 %: alerta', () => {
    const r = octubre({ ingresos: 60000 })!;
    expect(r.tasaAhorro).toBe(9);
    expect(r.tono).toBe('alerta');
    expect(r.mensaje).toBe('Te pasaste Q 983 en gasto y ahorraste solo 9% (meta 20%).');
  });

  it('dentro del presupuesto y ahorro ≥ 20 %: ok', () => {
    const plan = Object.fromEntries(Object.entries(PLAN).map(([k, v]) => [k, Math.round(v * 1.08)]));
    const r = octubre({ plan })!;
    expect(r.vsPresupuestoGasto!.diff).toBeLessThan(0);
    expect(r.tono).toBe('ok');
    expect(r.mensaje).toBe('Dentro de tu presupuesto de gasto y ahorraste 21%.');
  });

  it('dentro del presupuesto pero ahorro < 20 %: ok-bajo', () => {
    const plan = Object.fromEntries(Object.entries(PLAN).map(([k, v]) => [k, Math.round(v * 1.08)]));
    const r = octubre({ plan, ingresos: 60000 })!;
    expect(r.tono).toBe('ok-bajo');
    expect(r.mensaje).toBe('Dentro del presupuesto, pero ahorraste solo 9% (meta 20%).');
  });

  it('gastaste más de lo que recibiste: lo dice sin un % negativo', () => {
    const r = octubre({ ingresos: 50000 })!;
    expect(r.tasaAhorro).toBeLessThan(0);
    expect(r.tono).toBe('alerta');
    expect(r.mensaje).toBe('Te pasaste Q 983 en gasto y gastaste más de lo que recibiste.');
  });

  it('el límite de 20 % ya cuenta como sano', () => {
    expect(META_AHORRO_PCT).toBe(20);
    const base = (gasto: number) => {
      const txs = [tx('edu', gasto), tx('sue', 1000, 'income')];
      const [totals] = monthTotals(txs, [MES], cats, fixedResolver(cats, []).share);
      return enQueSeFue({ month: MES, totals, txs, categories: cats, planOf: { edu: 900 }, fmt })!;
    };
    expect(base(800)).toMatchObject({ tasaAhorro: 20, tono: 'ok' });
    expect(base(810)).toMatchObject({ tasaAhorro: 19, tono: 'ok-bajo' });
    expect(base(950)).toMatchObject({ tasaAhorro: 5, tono: 'alerta' });
    expect(base(850)).toMatchObject({ tasaAhorro: 15, tono: 'ok-bajo' });
  });
});

describe('enQueSeFue · casos borde', () => {
  it('sin ingresos registrados: no hay vs ingresos, tasa ni meta; solo dice si te pasaste', () => {
    const r = octubre({ ingresos: null })!;
    expect(r.ingresos).toBeNull();
    expect(r.vsIngresos).toBeNull();
    expect(r.tasaAhorro).toBeNull();
    expect(r.tipos[2]).toMatchObject({ presupuesto: null, diff: null, estado: 'sin-plan' });
    expect(r.tono).toBe('alerta');
    expect(r.mensaje).toBe('Te pasaste Q 983 en gasto.');
  });

  it('sin presupuesto: se ocultan las variaciones y no hay tono ni mensaje', () => {
    const r = octubre({ plan: {} })!;
    expect(r.presupuestoGasto).toBeNull();
    expect(r.vsPresupuestoGasto).toBeNull();
    expect(r.tono).toBeNull();
    expect(r.mensaje).toBeNull();
    expect(r.tipos[0]).toMatchObject({ presupuesto: null, diff: null, estado: 'sin-plan' });
    expect(r.tipos[0].categorias.every((c) => c.estado === 'sin-plan' && c.presupuesto === null)).toBe(true);
  });

  it('categoría sin plan: aparece sin marca ni "te pasaste"', () => {
    const r = octubre({ plan: { ...PLAN, otr: 0 } })!;
    const otros = r.tipos[1].categorias.find((c) => c.id === 'otr')!;
    expect(otros).toMatchObject({ gastado: 2000, presupuesto: null, diff: null, estado: 'sin-plan' });
  });

  it('categoría con plan y sin gasto: aparece con "te quedan" y cuenta en el presupuesto', () => {
    const catsMas: CtfCategory[] = [...cats, { id: 'mas', name: 'Mascotas', bucket: 'needs', budgeted_amount: 500, pace_mode: 'linear' }];
    const txs = [tx('edu', 1000), tx('sue', 5000, 'income')];
    const [totals] = monthTotals(txs, [MES], catsMas, fixedResolver(catsMas, []).share);
    const r = enQueSeFue({ month: MES, totals, txs, categories: catsMas, planOf: { edu: 1200, mas: 500 }, fmt })!;
    expect(r.tipos[0].presupuesto).toBe(1700);
    expect(r.tipos[0].categorias.find((c) => c.id === 'mas')).toMatchObject({ gastado: 0, presupuesto: 500, diff: -500, estado: 'ok' });
  });

  it('Sin categoría e Intereses de deudas cuadran con Lo básico; los abonos van a Ahorro', () => {
    const pago = tx(null, 1000, 'expense', { transaction_type: 'ahorro' });
    const intereses = new Map([[pago.id, 150]]);
    const r = octubre({ extra: [tx(null, 80), pago], intereses })!;
    const needs = r.tipos[0];
    expect(needs.monto).toBe(36683 + 80 + 150);
    expect(needs.categorias.find((c) => c.nombre === 'Sin categoría')).toMatchObject({ id: null, gastado: 80, estado: 'sin-plan' });
    expect(needs.categorias.find((c) => c.nombre === 'Intereses de deudas')).toMatchObject({ id: null, gastado: 150 });
    expect(needs.categorias.reduce((a, c) => a + c.gastado, 0)).toBe(needs.monto);
    const ahorro = r.tipos[2];
    expect(ahorro.monto).toBe(26950 + 850);
    expect(ahorro.categorias.find((c) => c.nombre === 'Pagos a deudas')).toMatchObject({ id: null, gastado: 850 });
    expect(ahorro.categorias.reduce((a, c) => a + c.gastado, 0)).toBe(ahorro.monto);
  });

  it('mes sin movimientos: null', () => {
    const [totals] = monthTotals([], [MES], cats, fixedResolver(cats, []).share);
    expect(enQueSeFue({ month: MES, totals, txs: [], categories: cats, planOf: PLAN, fmt })).toBeNull();
  });

  it('ignora movimientos de otros meses', () => {
    const otro: CtfTx = { ...tx('res', 999), date: '2026-09-10' };
    const r = octubre({ extra: [otro] })!;
    expect(r.gastaste).toBe(54783);
    expect(r.tipos[1].monto).toBe(18100);
  });
});
