import { describe, it, expect } from 'vitest';
import {
  countUpValue, dominantMonth, easeOutCubic, importBannerQuery, importBannerText,
  isSplashRoute, parseImportBanner, splashExitAt, SPLASH_BOOT_SCRIPT, SPLASH_MAX_MS, SPLASH_MIN_MS,
} from './motion';

describe('easeOutCubic', () => {
  it('va de 0 a 1 y frena al final', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
  it('recorta fuera de [0, 1]', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('countUpValue', () => {
  it('cuenta hacia abajo (Hoy puedes gastar baja al guardar un gasto)', () => {
    expect(countUpValue(9240, 9155, 0, 900)).toBe(9240);
    expect(countUpValue(9240, 9155, 450, 900)).toBeCloseTo(9240 - 85 * 0.875);
    expect(countUpValue(9240, 9155, 900, 900)).toBe(9155);
  });
  it('llega exacto al final y con duración 0', () => {
    expect(countUpValue(0, 42, 5000, 1000)).toBe(42);
    expect(countUpValue(0, 42, 0, 0)).toBe(42);
  });
});

describe('splash', () => {
  it('solo en las rutas de la app', () => {
    expect(isSplashRoute('/dashboard')).toBe(true);
    expect(isSplashRoute('/metas/abc')).toBe(true);
    expect(isSplashRoute('/')).toBe(false);
    expect(isSplashRoute('/login')).toBe(false);
    expect(isSplashRoute('/capture')).toBe(false);
    expect(isSplashRoute('/dashboardx')).toBe(false);
  });
  it('el script de arranque oculta el splash si ya se vio o la ruta no es de la app', () => {
    const run = (pathname: string, seen: string | null) => {
      const attrs: Record<string, string> = {};
      const doc = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } };
      new Function('location', 'sessionStorage', 'document', SPLASH_BOOT_SCRIPT)(
        { pathname }, { getItem: () => seen }, doc,
      );
      return attrs['data-splash'] ?? null;
    };
    expect(run('/dashboard', null)).toBeNull();
    expect(run('/dashboard', '1')).toBe('off');
    expect(run('/login', null)).toBe('off');
  });
  it('sale entre el mínimo y el máximo', () => {
    expect(splashExitAt(100)).toBe(SPLASH_MIN_MS);
    expect(splashExitAt(1500)).toBe(1500);
    expect(splashExitAt(9000)).toBe(SPLASH_MAX_MS);
    expect(splashExitAt(null)).toBe(SPLASH_MAX_MS);
  });
});

describe('banner de importación', () => {
  it('mes dominante', () => {
    expect(dominantMonth(['2026-09-01', '2026-09-30', '2026-10-01'])).toBe('2026-09');
    expect(dominantMonth(['2026-08-31', '2026-09-01'])).toBe('2026-09');
    expect(dominantMonth([null, 'x'])).toBeNull();
  });
  it('ida y vuelta por query params', () => {
    const q = importBannerQuery({ count: 42, bank: 'BI', month: '2026-09' });
    expect(parseImportBanner(new URLSearchParams(q))).toEqual({ count: 42, bank: 'BI', month: '2026-09' });
    expect(parseImportBanner(new URLSearchParams('q=uber'))).toBeNull();
    expect(parseImportBanner(new URLSearchParams('importados=-1'))).toBeNull();
    expect(parseImportBanner(new URLSearchParams('importados=3&mes=sept'))).toEqual({ count: 3, bank: null, month: null });
  });
  it('texto', () => {
    expect(importBannerText({ count: 42, bank: 'BI', month: '2026-09' }, '2026-10-04'))
      .toEqual({ strong: '42 movimientos nuevos', rest: 'del estado BI de septiembre' });
    expect(importBannerText({ count: 1, bank: null, month: '2025-12' }, '2026-01-10'))
      .toEqual({ strong: '1 movimiento nuevo', rest: 'del estado de diciembre 2025' });
    expect(importBannerText({ count: 2, bank: 'Desconocido', month: null }, '2026-01-10').rest)
      .toBe('de tu estado de cuenta');
  });
});
