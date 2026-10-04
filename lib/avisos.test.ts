import { describe, it, expect } from 'vitest';
import {
  AVISO_PRIORITY, DEFAULT_AVISO_PREFS, addDays, applePayCopy, buildCandidates, capCandidates, countsTowardDailyLimit,
  daysBetween, dueCandidates, dueDateIn, inactivityCandidate, incomeCandidates, monthEndCandidate, monthEndCopy,
  monthStartCandidate, notifiedWithinDay, pickAviso, resolveAvisoPrefs, type Aviso, type AvisoData, type LogEntry,
} from './avisos';
import { DEFAULT_CAPS } from './recomendaciones';

const fmt = (n: number) => `Q ${Math.round(n).toLocaleString('en-US')}`;
const NOW = Date.parse('2026-10-14T14:00:00Z');

const cats = [
  { id: 'viv', name: 'Vivienda', bucket: 'needs' as const, budgeted_amount: 0, cap_key: 'vivienda' },
  { id: 'tar', name: 'Tarjeta BI', bucket: 'needs' as const, budgeted_amount: 1500, pace_mode: 'fixed' as const, expected_day: 15 },
  { id: 'com', name: 'Restaurantes y salidas', bucket: 'wants' as const, budgeted_amount: 1000, cap_key: 'comida' },
  { id: 'sal', name: 'Salario', bucket: 'income' as const, budgeted_amount: 0 },
];
const subs = [
  { id: 'renta', category_id: 'viv', name: 'Renta', amount: 3000, is_fixed: true, expected_day: 31 },
  { id: 'luz', category_id: 'viv', name: 'Luz', amount: 400, is_fixed: false, expected_day: 15 },
];
const incomes = [{ id: 'i1', source: 'Salario', amount: 8000, frequency: 'mensual' }];

function data(over: Partial<AvisoData> = {}): AvisoData {
  return {
    today: '2026-10-14', nowMs: NOW, categories: cats, subs, incomes, caps: DEFAULT_CAPS,
    txs: [], lastTxDate: '2026-10-13', lastInactivityAt: null, monthStartPending: false, ...over,
  };
}
const tx = (id: string, date: string, amount: number, category_id: string | null, type: 'expense' | 'income' = 'expense', extra = {}) =>
  ({ id, date, amount, category_id, type, ...extra });

const aviso = (kind: Aviso['kind'], key = kind): Aviso => ({ kind, key, title: kind, body: '', url: '/', tag: kind });

describe('límite diario', () => {
  it('apple_pay no cuenta', () => {
    expect(countsTowardDailyLimit('apple_pay')).toBe(false);
    expect(countsTowardDailyLimit('inactivity')).toBe(true);
  });
  it('ventana móvil de 24 h', () => {
    const log = (h: number, type = 'cap'): LogEntry[] => [{ type, sent_at: new Date(NOW - h * 3600_000).toISOString() }];
    expect(notifiedWithinDay(log(23), NOW)).toBe(true);
    expect(notifiedWithinDay(log(25), NOW)).toBe(false);
    expect(notifiedWithinDay(log(1, 'apple_pay'), NOW)).toBe(false);
  });
});

describe('pickAviso', () => {
  const all = [aviso('income'), aviso('inactivity'), aviso('month_end'), aviso('cap'), aviso('due')];
  it('prioridad: vencimiento > tope > cierre > inactividad > ingreso', () => {
    expect(AVISO_PRIORITY.filter((k) => k !== 'month_start')).toEqual(['due', 'cap', 'month_end', 'inactivity', 'income']);
    const prefs = { ...DEFAULT_AVISO_PREFS, income_enabled: true };
    expect(pickAviso(all, prefs, [], NOW)?.kind).toBe('due');
    expect(pickAviso(all.filter((a) => a.kind !== 'due'), prefs, [], NOW)?.kind).toBe('cap');
    expect(pickAviso([aviso('income'), aviso('inactivity'), aviso('month_end')], prefs, [], NOW)?.kind).toBe('month_end');
    expect(pickAviso([aviso('income'), aviso('inactivity')], prefs, [], NOW)?.kind).toBe('inactivity');
    expect(pickAviso([aviso('income')], prefs, [], NOW)?.kind).toBe('income');
  });
  it('máximo uno al día', () => {
    const log = [{ type: 'inactivity', sent_at: new Date(NOW - 3600_000).toISOString() }];
    expect(pickAviso(all, DEFAULT_AVISO_PREFS, log, NOW)).toBeNull();
    // Un push de Apple Pay no bloquea el aviso del día.
    expect(pickAviso(all, DEFAULT_AVISO_PREFS, [{ ...log[0], type: 'apple_pay' }], NOW)?.kind).toBe('due');
  });
  it('respeta los switches (ingresos apagado por defecto)', () => {
    expect(pickAviso([aviso('income')], DEFAULT_AVISO_PREFS, [], NOW)).toBeNull();
    expect(pickAviso([aviso('due'), aviso('cap')], { ...DEFAULT_AVISO_PREFS, due_enabled: false }, [], NOW)?.kind).toBe('cap');
  });
  it('no repite una clave ya enviada', () => {
    const log = [{ type: 'due', sent_at: '2026-10-01T00:00:00Z', payload: { key: 'due' } }];
    expect(pickAviso([aviso('due'), aviso('cap')], DEFAULT_AVISO_PREFS, log, NOW)?.kind).toBe('cap');
  });
});

describe('preferencias', () => {
  it('sin columnas nuevas usa los valores por defecto', () => {
    const p = resolveAvisoPrefs({ inactivity_enabled: false, month_close_day: 3 });
    expect(p).toMatchObject({ due_enabled: true, cap_enabled: true, income_enabled: false, inactivity_enabled: false, month_close_day: 3 });
    expect(resolveAvisoPrefs(null)).toEqual(DEFAULT_AVISO_PREFS);
  });
});

describe('fechas', () => {
  it('suma días y cuenta entre fechas', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-09', '2026-10-14')).toBe(5);
  });
  it('vencimiento en meses cortos', () => {
    expect(dueDateIn('2026-02', 31)).toBe('2026-02-28');
    expect(dueDateIn('2026-10', 15)).toBe('2026-10-15');
  });
});

describe('Pago por vencer', () => {
  it('fijo que vence mañana y sigue pendiente', () => {
    const [a] = dueCandidates(data(), fmt);
    expect(a.title).toBe('Pago por vencer');
    expect(a.body).toBe('Tu Tarjeta BI vence mañana: Q 1,500. ¿Ya lo apartaste?');
    expect(a.url).toBe('/presupuesto');
    expect(a.key).toBe('due:tar:2026-10');
  });
  it('si ya se pagó no avisa; las partes variables tampoco', () => {
    expect(dueCandidates(data({ txs: [tx('t', '2026-10-02', 1500, 'tar')] }), fmt)).toEqual([]);
  });
  it('día 31 en un mes de 30: vence el 30', () => {
    const [a] = dueCandidates(data({ today: '2026-11-29' }), fmt);
    expect(a.body).toContain('Tu Renta vence mañana: Q 3,000');
  });
});

describe('Cerca de tu tope', () => {
  it('avisa al 85 % del tope (base: ingreso del plan)', () => {
    // Comida: 15 % de 8,000 = 1,200. 1,050 / 1,200 = 87.5 %.
    const d = data({ txs: [tx('a', '2026-10-05', 1050, 'com')] });
    const [a] = capCandidates(d, fmt);
    expect(a.title).toBe('Te acercas a tu tope');
    expect(a.body).toBe('Alimentación va en Q 1,050 de Q 1,200 este mes.');
    expect(a.key).toBe('cap:comida:2026-10');
  });
  it('por debajo del 85 % no avisa', () => {
    expect(capCandidates(data({ txs: [tx('a', '2026-10-05', 900, 'com')] }), fmt)).toEqual([]);
  });
  it('sin ingresos no hay base', () => {
    expect(capCandidates(data({ incomes: [], txs: [tx('a', '2026-10-05', 1050, 'com')] }), fmt)).toEqual([]);
  });
});

describe('Cierre de mes', () => {
  const sept = [
    tx('s', '2026-09-01', 9750, 'sal', 'income'),
    tx('c', '2026-09-10', 2000, 'com'),
    tx('r', '2026-09-03', 3000, 'viv', 'expense', { budget_sub_item_id: 'renta' }),
  ];
  it('el día elegido, con lo ahorrado y lo que podría ahorrar', () => {
    const a = monthEndCandidate(data({ today: '2026-10-02', txs: sept }), 2, fmt)!;
    // Comida 2,000 vs 15 % de 9,750 = 1,462.50 → 537.50; vivienda 3,000 vs 30 % = 2,925 → 75. Total 612.50.
    expect(a.title).toBe('Septiembre terminó');
    expect(a.body).toBe('Ahorraste Q 4,750. Mira dónde podrías ahorrar Q 613 más al mes.');
    expect(a.url).toBe('/resumen?mes=2026-09');
  });
  it('otro día no', () => {
    expect(monthEndCandidate(data({ today: '2026-10-03', txs: sept }), 2, fmt)).toBeNull();
  });
  it('copys alternos', () => {
    expect(monthEndCopy('2026-09', 500, 0, fmt).body).toBe('Ahorraste Q 500. Mira cómo te fue.');
    expect(monthEndCopy('2026-09', -300, 200, fmt).body).toBe('Gastaste Q 300 más de lo que recibiste. Mira dónde podrías ahorrar Q 200 al mes.');
  });
});

describe('Inactividad', () => {
  it('n días sin registrar', () => {
    const a = inactivityCandidate(data({ lastTxDate: '2026-10-09' }), 5)!;
    expect(a.title).toBe('¿Nos ponemos al día?');
    expect(a.body).toBe('Llevas 5 días sin registrar. Agregar lo de la semana toma 1 minuto.');
  });
  it('antes del umbral, sin movimientos o con aviso hace menos de 7 días: no', () => {
    expect(inactivityCandidate(data({ lastTxDate: '2026-10-10' }), 5)).toBeNull();
    expect(inactivityCandidate(data({ lastTxDate: null }), 5)).toBeNull();
    expect(inactivityCandidate(data({ lastTxDate: '2026-10-01', lastInactivityAt: '2026-10-10T14:00:00Z' }), 5)).toBeNull();
  });
});

describe('Ingreso recibido', () => {
  it('ingreso registrado en las últimas 24 h', () => {
    const d = data({ txs: [tx('i', '2026-10-14', 9750, 'sal', 'income', { description: 'Salario', created_at: '2026-10-14T03:00:00Z' })] });
    const [a] = incomeCandidates(d, fmt);
    expect(a.title).toBe('Ingreso recibido');
    expect(a.body).toBe('Q 9,750 · Salario. Ya está en tu plan de octubre.');
    expect(a.key).toBe('income:i');
  });
  it('los viejos no', () => {
    const d = data({ txs: [tx('i', '2026-10-01', 9750, 'sal', 'income', { created_at: '2026-10-01T03:00:00Z' })] });
    expect(incomeCandidates(d, fmt)).toEqual([]);
  });
});

describe('Inicio de mes', () => {
  it('solo el día 1 y si está pendiente', () => {
    expect(monthStartCandidate(data({ today: '2026-11-01', monthStartPending: true }))?.title).toBe('Empieza noviembre 🗓️');
    expect(monthStartCandidate(data({ today: '2026-11-02', monthStartPending: true }))).toBeNull();
    expect(monthStartCandidate(data({ today: '2026-11-01' }))).toBeNull();
  });
});

describe('buildCandidates + pickAviso', () => {
  it('con vencimiento y tope el mismo día gana el vencimiento', () => {
    const d = data({ txs: [tx('a', '2026-10-05', 1100, 'com')], lastTxDate: '2026-10-01' });
    const c = buildCandidates(d, DEFAULT_AVISO_PREFS, fmt);
    expect(c.map((x) => x.kind).sort()).toEqual(['cap', 'due', 'inactivity']);
    expect(pickAviso(c, DEFAULT_AVISO_PREFS, [], NOW)?.kind).toBe('due');
  });
});

describe('Apple Pay', () => {
  const q = (n: number) => `Q ${n.toFixed(2)}`;
  it('copy de la spec', () => {
    expect(applePayCopy(85, 'Starbucks', q).body).toBe('Registramos Q 85.00 en Starbucks con Apple Pay. Toca para elegir categoría.');
    expect(applePayCopy(85, 'Starbucks', q, '☕ Café').body).toContain('con Apple Pay: ☕ Café.');
  });
});
