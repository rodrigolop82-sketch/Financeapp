import { describe, it, expect } from 'vitest';
import type { AdminTx, AdminUser } from './dataset';
import {
  activeHouseholds,
  buildCtx,
  cohortCell,
  computeActivityBars,
  computeFunnel,
  computeInactivos,
  computeResumen,
  computeRetencion,
  computeSources,
  heatCell,
  matchesInactiveFilter,
  parseInactiveFilter,
  parsePeriod,
  pctDelta,
  pickForExport,
  ptsDelta,
  situationOf,
  sourceGroup,
  computeUsuarios,
  matchesUserFilter,
  matchesUserSearch,
  parseUserFilter,
} from './metrics';

const DAY = 86_400_000;
// Domingo 4 oct 2026, 12:00 en Guatemala.
const NOW = Date.parse('2026-10-04T18:00:00Z');
const ago = (d: number, extraMs = 0) => new Date(NOW - d * DAY + extraMs).toISOString();

let seq = 0;
function user(daysAgo: number, extra: Partial<AdminUser> = {}): AdminUser {
  seq++;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
  return {
    id,
    email: `u${seq}@correo.com`,
    fullName: `Persona${seq} Apellido`,
    createdAt: ago(daysAgo),
    plan: 'free',
    trialEndsAt: ago(daysAgo - 14),
    marketingOptIn: false,
    lastSignInAt: null,
    householdId: `hh-${seq}`,
    ...extra,
  };
}
/** Movimiento del hogar de `u` hecho `dayAfterReg` días después de registrarse. */
function txAfter(u: AdminUser, dayAfterReg: number, extra: Partial<AdminTx> = {}): AdminTx {
  return {
    householdId: u.householdId!,
    createdAt: new Date(Date.parse(u.createdAt) + dayAfterReg * DAY + 3600_000).toISOString(),
    type: 'expense',
    source: 'manual',
    ...extra,
  };
}

describe('periodo y deltas', () => {
  it('parsePeriod acepta 7/30/90 y por defecto 30', () => {
    expect(parsePeriod('7')).toBe(7);
    expect(parsePeriod(90)).toBe(90);
    expect(parsePeriod('15')).toBe(30);
    expect(parsePeriod(null)).toBe(30);
  });
  it('pctDelta con signo y menos tipográfico', () => {
    expect(pctDelta(112, 100)).toEqual({ label: '+12%', trend: 'up' });
    expect(pctDelta(96, 100)).toEqual({ label: '−4%', trend: 'down' });
    expect(pctDelta(5, 5)).toEqual({ label: '0%', trend: 'flat' });
    expect(pctDelta(3, 0)).toEqual({ label: 'nuevo', trend: 'up' });
    expect(pctDelta(0, 0)).toEqual({ label: '—', trend: 'flat' });
  });
  it('ptsDelta en puntos', () => {
    expect(ptsDelta(31, 29)).toEqual({ label: '+2 pts', trend: 'up' });
    expect(ptsDelta(14, 15)).toEqual({ label: '−1 pt', trend: 'down' });
    expect(ptsDelta(null, 10).label).toBe('—');
  });
});

describe('cómo capturan', () => {
  it('agrupa según transactions.source', () => {
    expect(sourceGroup('manual')).toBe('manual');
    expect(sourceGroup('text')).toBe('manual');
    expect(sourceGroup(null)).toBe('manual');
    expect(sourceGroup('statement')).toBe('importacion');
    expect(sourceGroup('csv')).toBe('importacion');
    expect(sourceGroup('voice')).toBe('voz');
    expect(sourceGroup('ocr')).toBe('foto');
    expect(sourceGroup('raro')).toBe('manual');
  });
  it('porcentajes por grupo', () => {
    const t = (source: string) => ({ householdId: 'h', createdAt: ago(1), type: 'expense', source });
    const s = computeSources([t('manual'), t('text'), t('statement'), t('voice')]);
    expect(s.map((x) => [x.label, x.count, x.pct])).toEqual([
      ['Manual', 2, 50], ['Importación', 1, 25], ['Voz', 1, 25], ['Foto', 0, 0],
    ]);
    expect(computeSources([]).every((x) => x.pct === 0)).toBe(true);
  });
});

describe('movimientos por día', () => {
  const t = (createdAt: string) => ({ householdId: 'h', createdAt, type: 'expense', source: 'manual' });
  it('7 días: una barra por día, la última es hoy (hora de Guatemala)', () => {
    const txs = [
      t('2026-10-04T17:00:00Z'), // hoy 11:00 GT
      t('2026-10-04T03:00:00Z'), // 3 oct 21:00 GT → ayer
      t('2026-09-28T07:00:00Z'), // 28 sep 01:00 GT → primer día
      t('2026-09-27T07:00:00Z'), // fuera
    ];
    const a = computeActivityBars(txs, 7, NOW);
    expect(a.bars).toHaveLength(7);
    expect(a.bars[0]).toEqual({ label: '28 sep', value: 1 });
    expect(a.bars[5]).toEqual({ label: '3 oct', value: 1 });
    expect(a.bars[6]).toEqual({ label: '4 oct', value: 1 });
    expect(a.total).toBe(3);
    expect(a.weekly).toBe(false);
  });
  it('90 días: barras por semana que suman el total', () => {
    const txs = Array.from({ length: 90 }, (_, i) => t(ago(i)));
    const a = computeActivityBars(txs, 90, NOW);
    expect(a.weekly).toBe(true);
    expect(a.bars).toHaveLength(13);
    expect(a.bars.reduce((x, b) => x + b.value, 0)).toBe(a.total);
    expect(a.total).toBe(90);
    expect(a.bars[12].value).toBe(7);
    expect(a.bars[0].value).toBe(6);
  });
});

describe('activos', () => {
  it('cuenta hogares con ≥1 movimiento en la ventana', () => {
    const a = user(40);
    const b = user(40);
    const ctx = buildCtx([a, b], [txAfter(a, 38), txAfter(a, 39), txAfter(b, 20)], NOW);
    expect(activeHouseholds(ctx, NOW - 7 * DAY, NOW + 1)).toBe(1);
    expect(activeHouseholds(ctx, NOW - 30 * DAY, NOW + 1)).toBe(2);
  });
});

describe('embudo', () => {
  it('pasos acumulativos y mayor fuga', () => {
    const us = Array.from({ length: 10 }, () => user(25));
    const txs: AdminTx[] = [];
    // 8 capturan; 4 activos en semana 1; 3 en semana 2; 1 premium.
    us.slice(0, 8).forEach((u) => txs.push(txAfter(u, 1)));
    us.slice(0, 4).forEach((u) => txs.push(txAfter(u, 8)));
    us.slice(0, 3).forEach((u) => txs.push(txAfter(u, 15)));
    txs.push(txAfter(us[9], 15)); // activo en sem 2 sin haber capturado/sem 1: no cuenta
    us[0].plan = 'premium';
    const f = computeFunnel(buildCtx(us, txs, NOW), us);
    expect(f.steps.map((s) => s.value)).toEqual([10, 9, 4, 3, 1]);
    expect(f.steps.map((s) => s.pctOfFirst)).toEqual([100, 90, 40, 30, 10]);
    expect(f.steps.findIndex((s) => s.worst)).toBe(2);
    expect(f.insight).toContain('de “capturaron su 1er gasto” a “activos en semana 1” se pierde el 56%');
    expect(f.steps[4].final).toBe(true);
  });
  it('sin registros no hay fuga', () => {
    const f = computeFunnel(buildCtx([], [], NOW), []);
    expect(f.insight).toBeNull();
    expect(f.steps.every((s) => !s.worst)).toBe(true);
  });
  it('un gasto cuenta como 1er gasto; solo ingresos no', () => {
    const a = user(10);
    const f = computeFunnel(buildCtx([a], [txAfter(a, 1, { type: 'income' })], NOW), [a]);
    expect(f.steps[1].value).toBe(0);
  });
});

describe('resumen', () => {
  it('KPIs del periodo con sus deltas', () => {
    const recent = [user(2), user(3), user(10)];
    const prev = [user(40)];
    const old = [user(50, { plan: 'premium' }), user(55)]; // pruebas terminadas y S4 cerrada
    const txs = [txAfter(recent[0], 1), txAfter(old[0], 30), txAfter(old[0], 45)];
    const r = computeResumen(buildCtx([...recent, ...prev, ...old], txs, NOW), 30);
    const k = Object.fromEntries(r.kpis.map((x) => [x.key, x]));
    expect(k.registros.value).toBe('3');
    expect(k.registros.delta.label).toBe('0%'); // 3 vs 3 (hace 40, 50 y 55 días)
    expect(k.registros.sub).toBe('en 30 días');
    expect(k.activos.value).toBe('2'); // recent[0] (día 1 → hace 1 día) y old[0] (día 45 → hace 5)
    // Pruebas que terminaron hace 14–44 días: user(40) gratis → 0 de 1.
    expect(k.premium.value).toBe('0%');
    expect(k.premium.sub).toBe('0 de 1 prueba');
    // S4 de quienes se registraron hace 35–65 días: solo old[0] activo en día 30 (sem 4).
    expect(k.retencion.value).toBe('33%');
    expect(r.activity.bars).toHaveLength(30);
    expect(r.sources[0].count).toBe(3);
  });
});

describe('retención', () => {
  it('cohortCell: semana 0 = 100%, null si no ha cerrado', () => {
    const a = user(22);
    const b = user(22);
    const ctx = buildCtx([a, b], [txAfter(a, 8)], NOW);
    expect(cohortCell(ctx, [a, b], 0)).toBe(100);
    expect(cohortCell(ctx, [a, b], 1)).toBe(50);
    expect(cohortCell(ctx, [a, b], 2)).toBe(0);
    expect(cohortCell(ctx, [a, b], 3)).toBeNull();
    expect(cohortCell(ctx, [], 0)).toBeNull();
  });
  it('heatCell: rgba(37,99,235,.08+v·.85), blanco desde 70', () => {
    expect(heatCell(0)).toEqual({ bg: 'rgba(37,99,235,0.08)', light: false });
    expect(heatCell(100)).toEqual({ bg: 'rgba(37,99,235,0.93)', light: true });
    expect(heatCell(70).light).toBe(true);
    expect(heatCell(69).light).toBe(false);
    expect(heatCell(null).bg).toBe('transparent');
  });
  it('6 cohortes semanales que empiezan en lunes, con S1, S4 y lo que retiene', () => {
    // Importadores retienen mejor en S4.
    const imp = [user(60), user(60)];
    const non = [user(60), user(60), user(60), user(60)];
    const txs: AdminTx[] = [
      ...imp.map((u) => txAfter(u, 0, { source: 'statement' })),
      ...imp.map((u) => txAfter(u, 29)),
      txAfter(non[0], 29),
      ...[...imp, non[0]].flatMap((u) => [txAfter(u, 8), txAfter(u, 15), txAfter(u, 22)]),
    ];
    const thisWeek = [user(1)];
    const r = computeRetencion(buildCtx([...imp, ...non, ...thisWeek], txs, NOW));
    expect(r.cohorts).toHaveLength(6);
    expect(r.cohorts[5].label).toBe('28 sep'); // lunes de esta semana
    expect(r.cohorts[5].size).toBe(1);
    expect(r.cohorts[5].cells).toEqual([100, null, null, null, null]);
    expect(r.s1).toBeCloseTo(50);
    expect(r.s4).toBeCloseTo(50);
    expect(r.retains.positive).toBe(true);
    expect(r.retains.title).toBe('Importar un estado');
    expect(r.retains.sub).toBe('S4 de 100% vs 25% de quienes no importan');
    expect(r.reading).toContain('entre la semana 0 y la 1: 5 de cada 10 no vuelven');
  });
  it('sin datos', () => {
    const r = computeRetencion(buildCtx([], [], NOW));
    expect(r.s1).toBeNull();
    expect(r.retains.positive).toBe(false);
    expect(r.reading).toMatch(/Aún no hay suficientes/);
  });
});

describe('para reactivar', () => {
  it('situación', () => {
    expect(situationOf(0, 50)).toBe('Nunca capturó');
    expect(situationOf(3, 31)).toBe('Dejó de usar');
    expect(situationOf(3, 30)).toBe('Se enfrió');
  });
  it('incluye ≥7 días sin entrar y nunca capturó (registrados hace ≥7 días)', () => {
    const activo = user(60, { lastSignInAt: ago(1) });
    const entraSinCapturar = user(30, { lastSignInAt: ago(0) });
    const enfriado = user(60, { lastSignInAt: ago(20) });
    const sinCapturar = user(9, { lastSignInAt: ago(0) });
    const nuevo = user(3);
    const dejo = user(90, { plan: 'premium', lastSignInAt: ago(80) });
    const txs = [txAfter(activo, 50), txAfter(enfriado, 40), txAfter(enfriado, 41), txAfter(dejo, 5)];
    const rows = computeInactivos(buildCtx([activo, entraSinCapturar, enfriado, sinCapturar, nuevo, dejo], txs, NOW));
    // Quien entra pero nunca capturó también sale (Nunca capturó, hace 0 días).
    expect(rows.map((r) => r.id).sort()).toEqual([entraSinCapturar.id, sinCapturar.id, enfriado.id, dejo.id].sort());
    expect(rows.map((r) => r.daysInactive)).toEqual([0, 0, 18, 80]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    // Último acceso = el último movimiento (hace 19 días), más reciente que el inicio de sesión.
    expect(byId[enfriado.id].daysInactive).toBe(18);
    expect(byId[enfriado.id].txCount).toBe(2);
    expect(byId[enfriado.id].situation).toBe('Se enfrió');
    expect(byId[enfriado.id].plan).toBe('Gratis');
    expect(byId[sinCapturar.id].situation).toBe('Nunca capturó');
    expect(byId[sinCapturar.id].plan).toBe('Prueba');
    expect(byId[dejo.id].situation).toBe('Dejó de usar');
    expect(byId[dejo.id].plan).toBe('Premium');
    expect(byId[dejo.id].firstName).toMatch(/^Persona\d+$/);
    // Nunca expone montos.
    expect(Object.keys(rows[0])).not.toContain('amount');
  });
  it('filtros y exportación', () => {
    const r = (id: string, daysInactive: number, txCount: number) => ({ id, daysInactive, txCount });
    const rows = [r('a', 7, 1), r('b', 14, 0), r('c', 15, 2), r('d', 30, 2), r('e', 31, 0)];
    expect(rows.filter((x) => matchesInactiveFilter(x, '7–14 días')).map((x) => x.id)).toEqual(['a', 'b']);
    expect(rows.filter((x) => matchesInactiveFilter(x, '15–30 días')).map((x) => x.id)).toEqual(['c', 'd']);
    expect(rows.filter((x) => matchesInactiveFilter(x, '+30 días')).map((x) => x.id)).toEqual(['e']);
    expect(rows.filter((x) => matchesInactiveFilter(x, 'Nunca capturó')).map((x) => x.id)).toEqual(['b', 'e']);
    expect(parseInactiveFilter('nada')).toBe('Todos');
    const by = (f: Parameters<typeof matchesInactiveFilter>[1]) => (x: (typeof rows)[number]) => matchesInactiveFilter(x, f);
    expect(pickForExport(rows, ['c', 'zz'], by('7–14 días')).map((x) => x.id)).toEqual(['c']);
    expect(pickForExport(rows, [], by('+30 días')).map((x) => x.id)).toEqual(['e']);
    expect(pickForExport(rows, null, by('Todos'))).toHaveLength(5);
  });
});

describe('usuarios', () => {
  it('incluye a todos con estado activo/inactivo', () => {
    const activo = user(60, { lastSignInAt: ago(1) });
    const nuevo = user(3);
    const enfriado = user(60, { lastSignInAt: ago(20) });
    const sinCapturar = user(9, { lastSignInAt: ago(0) });
    const txs = [txAfter(activo, 50), txAfter(enfriado, 40)];
    const rows = computeUsuarios(buildCtx([activo, nuevo, enfriado, sinCapturar], txs, NOW));
    expect(rows).toHaveLength(4);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[activo.id]).toMatchObject({ status: 'Activo', situation: 'Activo' });
    expect(byId[nuevo.id]).toMatchObject({ status: 'Activo', situation: 'Recién llegó' });
    expect(byId[enfriado.id]).toMatchObject({ status: 'Inactivo', situation: 'Se enfrió' });
    expect(byId[sinCapturar.id]).toMatchObject({ status: 'Inactivo', situation: 'Nunca capturó' });
    // Para reactivar = los inactivos de Usuarios.
    expect(computeInactivos(buildCtx([activo, nuevo, enfriado, sinCapturar], txs, NOW)).map((r) => r.id).sort())
      .toEqual([enfriado.id, sinCapturar.id].sort());
  });
  it('filtros y búsqueda', () => {
    const r = (id: string, status: 'Activo' | 'Inactivo', txCount: number) => ({ id, status, txCount });
    const rows = [r('a', 'Activo', 3), r('b', 'Activo', 0), r('c', 'Inactivo', 0), r('d', 'Inactivo', 5)];
    const ids = (f: Parameters<typeof matchesUserFilter>[1]) => rows.filter((x) => matchesUserFilter(x, f)).map((x) => x.id);
    expect(ids('Todos')).toEqual(['a', 'b', 'c', 'd']);
    expect(ids('Activos')).toEqual(['a', 'b']);
    expect(ids('Inactivos')).toEqual(['c', 'd']);
    expect(ids('Nunca capturó')).toEqual(['b', 'c']);
    expect(parseUserFilter('x')).toBe('Todos');
    const p = { email: 'maria.gonzalez@gmail.com', firstName: 'María' };
    expect(matchesUserSearch(p, '')).toBe(true);
    expect(matchesUserSearch(p, 'GONZALEZ')).toBe(true);
    expect(matchesUserSearch(p, 'maria')).toBe(true);
    expect(matchesUserSearch(p, 'pedro')).toBe(false);
  });
});
