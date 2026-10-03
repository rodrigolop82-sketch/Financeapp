import { describe, it, expect } from 'vitest';
import { activeTabFor, isRootPath, parentFor } from './navigation';

describe('activeTabFor', () => {
  it('marca Inicio en el dashboard y en Cómo te fue', () => {
    expect(activeTabFor('/dashboard')).toBe('inicio');
    expect(activeTabFor('/resumen')).toBe('inicio');
    expect(activeTabFor('/resumen/categoria/x')).toBe('inicio');
  });

  it('marca Movimientos, Metas y Más', () => {
    expect(activeTabFor('/transacciones')).toBe('movimientos');
    expect(activeTabFor('/metas/nueva')).toBe('metas');
    expect(activeTabFor('/mas')).toBe('mas');
    expect(activeTabFor('/deudas')).toBe('mas');
    expect(activeTabFor('/cuenta/privacidad')).toBe('mas');
    expect(activeTabFor('/plan')).toBe('mas');
  });

  it('no confunde prefijos parecidos', () => {
    expect(activeTabFor('/metasx')).toBeNull();
    expect(activeTabFor('/login')).toBeNull();
  });
});

describe('isRootPath', () => {
  it('solo las 4 pestañas raíz', () => {
    expect(isRootPath('/dashboard')).toBe(true);
    expect(isRootPath('/mas')).toBe(true);
    expect(isRootPath('/metas/nueva')).toBe(false);
    expect(isRootPath('/deudas')).toBe(false);
  });
});

describe('parentFor', () => {
  it('vuelve a la pantalla padre', () => {
    expect(parentFor('/deudas')).toEqual({ label: 'Más', href: '/mas' });
    expect(parentFor('/cuenta')).toEqual({ label: 'Más', href: '/mas' });
    expect(parentFor('/cuenta/privacidad')).toEqual({ label: 'Cuenta', href: '/cuenta' });
    expect(parentFor('/resumen')).toEqual({ label: 'Inicio', href: '/dashboard' });
    expect(parentFor('/resumen/categoria/abc')).toEqual({ label: 'Cómo te fue', href: '/resumen' });
    expect(parentFor('/metas/123')).toEqual({ label: 'Metas', href: '/metas' });
    expect(parentFor('/plan')).toEqual({ label: 'Plan del mes', href: '/presupuesto' });
  });
});
