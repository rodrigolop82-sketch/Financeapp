import { getMerchantKey } from './merchant-key';
import type { SearchTransaction } from '@/types';

export { getMerchantKey };

export interface MerchantMatchInput {
  source: SearchTransaction;
  all: SearchTransaction[];
  newCategoryId: string;
}

export interface MerchantMatchResult {
  candidates: SearchTransaction[];
  defaultSelectedIds: string[];
  truncated: boolean;
}

const MAX_CANDIDATES = 500;

export function findMerchantMatches({
  source,
  all,
  newCategoryId,
}: MerchantMatchInput): MerchantMatchResult {
  const key = getMerchantKey(source.description);
  if (!key) {
    return { candidates: [], defaultSelectedIds: [], truncated: false };
  }

  const filtered = all.filter((t) => {
    if (t.id === source.id) return false;
    if (t.household_id !== source.household_id) return false;
    if (t.transaction_type !== 'gasto') return false;
    if (t.category_id === newCategoryId) return false;
    return getMerchantKey(t.description) === key;
  });

  filtered.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return b.id.localeCompare(a.id);
  });

  const truncated = filtered.length > MAX_CANDIDATES;
  const candidates = filtered.slice(0, MAX_CANDIDATES);

  const defaultSelectedIds = candidates
    .filter((t) => t.category_source !== 'manual')
    .map((t) => t.id);

  return { candidates, defaultSelectedIds, truncated };
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatMonthRange(dates: string[]): string {
  if (dates.length === 0) return '';

  const months = [...new Set(dates.map((d) => {
    const parts = d.split('-');
    return { y: Number(parts[0]), m: Number(parts[1]) - 1 };
  }).map((p) => `${p.y}-${p.m}`))];

  const parsed = months.map((m) => {
    const [y, mo] = m.split('-').map(Number);
    return { y, m: mo };
  });

  parsed.sort((a, b) => a.y - b.y || a.m - b.m);

  const first = parsed[0];
  const last = parsed[parsed.length - 1];

  if (first.y === last.y && first.m === last.m) {
    return `de ${MONTHS_ES[first.m]}`;
  }

  return `de ${MONTHS_ES[first.m]} a ${MONTHS_ES[last.m]}`;
}

export interface UndoItem {
  id: string;
  categoryId: string;
  categorySource: 'auto' | 'manual' | 'bulk';
}

export function buildUndoSnapshot(
  changes: { id: string; categoryId: string; categorySource: 'auto' | 'manual' | 'bulk' }[],
): UndoItem[] {
  return changes.map((c) => ({
    id: c.id,
    categoryId: c.categoryId,
    categorySource: c.categorySource,
  }));
}
