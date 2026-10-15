import { describe, it, expect } from 'vitest';
import { GUIA_OTRO_BANCO, OPCIONES_GUIA } from './guias-banco';

describe('guías por banco', () => {
  it('los seis bancos soportados y "Otro banco" al final', () => {
    expect(OPCIONES_GUIA.map((g) => g.nombre)).toEqual([
      'Banrural', 'BAM', 'Industrial', 'G&T', 'Bantrab', 'BAC Credomatic', 'Otro banco',
    ]);
  });

  it('ids únicos', () => {
    const ids = OPCIONES_GUIA.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada guía tiene pasos y consejo', () => {
    for (const g of OPCIONES_GUIA) {
      expect(g.pasos.length).toBeGreaterThan(0);
      expect(g.consejo).not.toBe('');
    }
  });

  it('"Otro banco" tiene la guía genérica de tres pasos', () => {
    expect(GUIA_OTRO_BANCO.pasos).toHaveLength(3);
  });
});
