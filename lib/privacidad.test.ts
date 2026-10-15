import { describe, it, expect } from 'vitest';
import { formatMoney } from './format';
import { maskedText, maskFormatter } from './privacidad';

const q = (n: number) => formatMoney(n, { currency: 'GTQ', showDecimals: false });
const qDec = (n: number) => formatMoney(n, { currency: 'GTQ', showDecimals: true });

describe('ocultar saldos', () => {
  it('muestra "Q ••••" sin el número', () => {
    expect(maskedText(q)).toBe(q(0).replace(/0.*/, '••••'));
    expect(maskedText(q)).not.toMatch(/\d/);
    expect(maskedText(qDec)).not.toMatch(/\d/);
    expect(maskedText(q)).toContain('Q');
  });

  it('con la preferencia apagada devuelve el mismo formateador', () => {
    expect(maskFormatter(q, false)).toBe(q);
    expect(maskFormatter(q, false)(1234)).toBe(q(1234));
  });

  it('con la preferencia activa ningún monto se ve', () => {
    const f = maskFormatter(q, true);
    for (const n of [0, 5, 1234, 987654.32, -300]) {
      expect(f(n)).toBe(maskedText(q));
      expect(f(n)).not.toMatch(/\d/);
    }
  });
});
