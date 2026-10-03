import { describe, it, expect } from 'vitest';
import { reinsertAt } from './undo-delete';

const a = { id: 'a' };
const b = { id: 'b' };
const c = { id: 'c' };

describe('reinsertAt', () => {
  it('vuelve a poner el elemento en su posición original', () => {
    expect(reinsertAt([a, c], b, 1)).toEqual([a, b, c]);
    expect(reinsertAt([b, c], a, 0)).toEqual([a, b, c]);
    expect(reinsertAt([a, b], c, 2)).toEqual([a, b, c]);
  });

  it('acota el índice al largo de la lista', () => {
    expect(reinsertAt([a], b, 10)).toEqual([a, b]);
    expect(reinsertAt([b], a, -3)).toEqual([a, b]);
  });

  it('no duplica si el elemento ya está en la lista', () => {
    const list = [a, b];
    expect(reinsertAt(list, b, 0)).toBe(list);
  });

  it('no muta la lista original', () => {
    const list = [a, c];
    reinsertAt(list, b, 1);
    expect(list).toEqual([a, c]);
  });
});
