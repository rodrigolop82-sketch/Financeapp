import { describe, it, expect } from 'vitest';
import { isAuthPath, isProtectedPath } from './rutas-protegidas';

describe('isProtectedPath', () => {
  it('protege las pantallas con datos del usuario', () => {
    for (const p of [
      '/dashboard', '/transacciones', '/plan', '/resumen', '/score', '/cuenta',
      '/cierre-mes', '/mis-fuentes', '/mis-fuentes/apple-pay', '/aprende',
      '/aprende/tarjetas/como-funciona', '/patrimonio', '/patrimonio/historial',
      '/health-score', '/importar', '/guardar',
    ]) expect(isProtectedPath(p), p).toBe(true);
  });

  it('deja abiertas las páginas públicas', () => {
    for (const p of [
      '/', '/login', '/registro', '/analisis', '/resultados', '/privacidad',
      '/terminos', '/invite/abc', '/auth/callback',
    ]) expect(isProtectedPath(p), p).toBe(false);
  });
});

describe('isAuthPath', () => {
  it('reconoce login y registro', () => {
    expect(isAuthPath('/login')).toBe(true);
    expect(isAuthPath('/registro')).toBe(true);
    expect(isAuthPath('/dashboard')).toBe(false);
  });
});
