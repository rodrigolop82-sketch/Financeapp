import { describe, it, expect } from 'vitest';
import { pushHint, resolvePushStatus, type PushEnv } from './push-status';

const base: PushEnv = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasVapidKey: true,
  standalone: true,
  permission: 'default',
  subscribed: false,
};

describe('resolvePushStatus', () => {
  it('sin Push API o sin llave VAPID no se puede', () => {
    expect(resolvePushStatus({ ...base, hasPushManager: false })).toBe('unsupported');
    expect(resolvePushStatus({ ...base, hasVapidKey: false })).toBe('unsupported');
  });
  it('activos si hay suscripción con permiso', () => {
    expect(resolvePushStatus({ ...base, permission: 'granted', subscribed: true })).toBe('on');
    expect(resolvePushStatus({ ...base, standalone: false, permission: 'granted', subscribed: true })).toBe('on');
  });
  it('bloqueados tiene prioridad sobre instalar', () => {
    expect(resolvePushStatus({ ...base, standalone: false, permission: 'denied' })).toBe('denied');
  });
  it('fuera de la app instalada pide instalar', () => {
    expect(resolvePushStatus({ ...base, standalone: false })).toBe('needs-install');
  });
  it('instalada y sin suscripción: se pueden activar', () => {
    expect(resolvePushStatus(base)).toBe('off');
    expect(resolvePushStatus({ ...base, permission: 'granted' })).toBe('off');
  });
});

describe('pushHint', () => {
  it('tiene texto para cada estado', () => {
    expect(pushHint('off')).toBe('Para recordatorios y alertas de topes');
    expect(pushHint('on')).toBe('Activados en este teléfono');
    for (const s of ['unsupported', 'needs-install', 'denied'] as const) expect(pushHint(s).length).toBeGreaterThan(0);
  });
});
