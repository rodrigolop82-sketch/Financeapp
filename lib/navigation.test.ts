import { describe, it, expect } from 'vitest';
import { activeTabFor, isRootPath, parentFor, planHref, planSection } from './navigation';

describe('activeTabFor', () => {
  it('marca Inicio en el dashboard y en Cómo te fue', () => {
    expect(activeTabFor('/dashboard')).toBe('inicio');
    expect(activeTabFor('/resumen')).toBe('inicio');
    expect(activeTabFor('/resumen/categoria/x')).toBe('inicio');
  });

  it('marca Movimientos, Plan y Más', () => {
    expect(activeTabFor('/transacciones')).toBe('movimientos');
    expect(activeTabFor('/plan')).toBe('plan');
    expect(activeTabFor('/plan/retos')).toBe('plan');
    expect(activeTabFor('/presupuesto')).toBe('plan');
    expect(activeTabFor('/metas/nueva')).toBe('plan');
    expect(activeTabFor('/deudas')).toBe('plan');
    expect(activeTabFor('/mas')).toBe('mas');
    expect(activeTabFor('/familia')).toBe('mas');
    expect(activeTabFor('/cuenta/privacidad')).toBe('mas');
  });

  it('no confunde prefijos parecidos', () => {
    expect(activeTabFor('/metasx')).toBeNull();
    expect(activeTabFor('/login')).toBeNull();
  });
});

describe('isRootPath', () => {
  it('solo las 4 pestañas raíz', () => {
    expect(isRootPath('/dashboard')).toBe(true);
    expect(isRootPath('/plan')).toBe(true);
    expect(isRootPath('/mas')).toBe(true);
    expect(isRootPath('/metas')).toBe(false);
    expect(isRootPath('/metas/nueva')).toBe(false);
    expect(isRootPath('/plan/retos')).toBe(false);
  });
});

describe('parentFor', () => {
  it('vuelve a la pantalla padre', () => {
    expect(parentFor('/familia')).toEqual({ label: 'Más', href: '/mas' });
    expect(parentFor('/cuenta')).toEqual({ label: 'Más', href: '/mas' });
    expect(parentFor('/cuenta/privacidad')).toEqual({ label: 'Cuenta', href: '/cuenta' });
    expect(parentFor('/resumen')).toEqual({ label: 'Más', href: '/mas' });
    expect(parentFor('/resumen/categoria/abc')).toEqual({ label: 'Cómo te fue', href: '/resumen' });
    expect(parentFor('/metas/123')).toEqual({ label: 'Metas', href: '/plan?s=metas' });
    expect(parentFor('/plan/retos')).toEqual({ label: 'Plan', href: '/plan' });
  });
});

describe('planSection / planHref', () => {
  it('lee la sección de ?s= (por defecto, Del mes)', () => {
    expect(planSection('metas')).toBe('metas');
    expect(planSection('deudas')).toBe('deudas');
    expect(planSection(null)).toBe('mes');
    expect(planSection('otra')).toBe('mes');
  });

  it('lleva las rutas viejas a /plan conservando sus parámetros', () => {
    expect(planHref('mes')).toBe('/plan');
    expect(planHref('metas')).toBe('/plan?s=metas');
    expect(planHref('mes', { from: 'home' })).toBe('/plan');
    expect(planHref('mes', { confirmMonth: '2026-09' })).toBe('/plan?confirmMonth=2026-09');
    expect(planHref('deudas', { s: 'metas', x: ['a', 'b'] })).toBe('/plan?s=deudas');
  });
});
