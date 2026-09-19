import { describe, it, expect } from 'vitest';
import {
  getMerchantKey,
  findMerchantMatches,
  formatMonthRange,
  buildUndoSnapshot,
} from './reclassify';
import type { SearchTransaction } from '@/types';

function makeTx(overrides: Partial<SearchTransaction> & { id: string }): SearchTransaction {
  return {
    household_id: 'h1',
    category_id: 'cat-otros',
    amount: 100,
    description: 'Pollo Campero',
    date: '2026-09-10',
    source: 'manual',
    payment_method: 'efectivo',
    voice_raw_text: null,
    category_source: 'auto',
    transaction_type: 'gasto',
    created_at: '2026-09-10T00:00:00Z',
    category_name: 'Otros',
    category_bucket: 'wants',
    category_icon: null,
    ...overrides,
  };
}

// ============================================================
// getMerchantKey
// ============================================================
describe('getMerchantKey', () => {
  it('normalizes to lowercase and removes accents', () => {
    expect(getMerchantKey('Café Barista')).toBe('cafe barista');
  });

  it('strips leading Spanish prepositions', () => {
    expect(getMerchantKey('en el Mercado')).toBe('mercado');
    expect(getMerchantKey('de la Tienda')).toBe('la tienda');
    expect(getMerchantKey('para María')).toBe('maria');
    expect(getMerchantKey('al Super')).toBe('super');
    expect(getMerchantKey('a la Farmacia')).toBe('farmacia');
    expect(getMerchantKey('del Centro')).toBe('centro');
    expect(getMerchantKey('en la Plaza')).toBe('plaza');
  });

  it('collapses multiple spaces', () => {
    expect(getMerchantKey('Pollo   Campero')).toBe('pollo campero');
  });

  it('returns null for null/empty/whitespace', () => {
    expect(getMerchantKey(null)).toBeNull();
    expect(getMerchantKey('')).toBeNull();
    expect(getMerchantKey('   ')).toBeNull();
  });

  it('produces the same key for case/accent variants', () => {
    const key1 = getMerchantKey("McDonald's");
    const key2 = getMerchantKey('mcdonalds');
    const key3 = getMerchantKey("MCDONALD'S");
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('produces the same key for accented variants', () => {
    const key1 = getMerchantKey('Pollo Campéro');
    const key2 = getMerchantKey('pollo campero');
    expect(key1).toBe(key2);
  });

  it('truncates to 60 chars', () => {
    const long = 'A'.repeat(100);
    const key = getMerchantKey(long);
    expect(key!.length).toBeLessThanOrEqual(60);
  });
});

// ============================================================
// findMerchantMatches
// ============================================================
describe('findMerchantMatches', () => {
  const source = makeTx({ id: 'src', description: 'Pollo Campero', category_id: 'cat-otros' });
  const newCategoryId = 'cat-rest';

  it('returns matching transactions from the same merchant', () => {
    const all = [
      source,
      makeTx({ id: 't2', description: 'Pollo Campero', category_id: 'cat-otros', date: '2026-08-28' }),
      makeTx({ id: 't3', description: 'Pollo campero', category_id: 'cat-compras', date: '2026-07-15' }),
    ];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].id).toBe('t2');
    expect(result.candidates[1].id).toBe('t3');
  });

  it('excludes the source transaction', () => {
    const all = [source];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.candidates).toHaveLength(0);
  });

  it('excludes transactions already in the new category', () => {
    const all = [
      source,
      makeTx({ id: 't2', description: 'Pollo Campero', category_id: 'cat-rest' }),
    ];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.candidates).toHaveLength(0);
  });

  it('excludes non-gasto transactions (ingreso, ahorro)', () => {
    const all = [
      source,
      makeTx({ id: 't2', description: 'Pollo Campero', transaction_type: 'ingreso' }),
      makeTx({ id: 't3', description: 'Pollo Campero', transaction_type: 'ahorro' }),
    ];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.candidates).toHaveLength(0);
  });

  it('does not cross households', () => {
    const all = [
      source,
      makeTx({ id: 't2', description: 'Pollo Campero', household_id: 'h2' }),
    ];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.candidates).toHaveLength(0);
  });

  it('returns empty when merchant is null/empty', () => {
    const nullSource = makeTx({ id: 'src', description: null });
    const all = [nullSource, makeTx({ id: 't2', description: null })];
    const result = findMerchantMatches({ source: nullSource, all, newCategoryId });
    expect(result.candidates).toHaveLength(0);
  });

  it('ignores case and accents when matching merchants', () => {
    const all = [
      source,
      makeTx({ id: 't2', description: 'POLLO CAMPERO' }),
      makeTx({ id: 't3', description: 'pollo campéro' }),
    ];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.candidates).toHaveLength(2);
  });

  it('marks manual transactions as deselected by default', () => {
    const all = [
      source,
      makeTx({ id: 't2', description: 'Pollo Campero', category_source: 'auto' }),
      makeTx({ id: 't3', description: 'Pollo Campero', category_source: 'manual' }),
    ];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.defaultSelectedIds).toContain('t2');
    expect(result.defaultSelectedIds).not.toContain('t3');
  });

  it('truncates at 500 candidates', () => {
    const many = Array.from({ length: 550 }, (_, i) =>
      makeTx({ id: `t${i}`, description: 'Pollo Campero', date: `2026-01-${String(i % 28 + 1).padStart(2, '0')}` }),
    );
    const all = [source, ...many];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.candidates).toHaveLength(500);
    expect(result.truncated).toBe(true);
  });

  it('sets truncated false when under 500', () => {
    const all = [
      source,
      makeTx({ id: 't2', description: 'Pollo Campero' }),
    ];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.truncated).toBe(false);
  });

  it('sorts candidates by date descending', () => {
    const all = [
      source,
      makeTx({ id: 't-jan', description: 'Pollo Campero', date: '2026-01-15' }),
      makeTx({ id: 't-sep', description: 'Pollo Campero', date: '2026-09-01' }),
      makeTx({ id: 't-may', description: 'Pollo Campero', date: '2026-05-20' }),
    ];
    const result = findMerchantMatches({ source, all, newCategoryId });
    expect(result.candidates.map((c) => c.id)).toEqual(['t-sep', 't-may', 't-jan']);
  });
});

// ============================================================
// formatMonthRange
// ============================================================
describe('formatMonthRange', () => {
  it('returns single month', () => {
    expect(formatMonthRange(['2026-08-12', '2026-08-28'])).toBe('de agosto');
  });

  it('returns range across months', () => {
    expect(formatMonthRange(['2026-05-21', '2026-09-10'])).toBe('de mayo a septiembre');
  });

  it('handles single date', () => {
    expect(formatMonthRange(['2026-06-14'])).toBe('de junio');
  });

  it('returns empty for no dates', () => {
    expect(formatMonthRange([])).toBe('');
  });

  it('sorts months correctly regardless of input order', () => {
    expect(formatMonthRange(['2026-09-01', '2026-05-01', '2026-07-01'])).toBe('de mayo a septiembre');
  });
});

// ============================================================
// buildUndoSnapshot
// ============================================================
describe('buildUndoSnapshot', () => {
  it('creates snapshot from changes', () => {
    const snap = buildUndoSnapshot([
      { id: 'a', categoryId: 'c1', categorySource: 'auto' },
      { id: 'b', categoryId: 'c2', categorySource: 'manual' },
    ]);
    expect(snap).toEqual([
      { id: 'a', categoryId: 'c1', categorySource: 'auto' },
      { id: 'b', categoryId: 'c2', categorySource: 'manual' },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(buildUndoSnapshot([])).toEqual([]);
  });
});
