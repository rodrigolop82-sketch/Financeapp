import { describe, it, expect } from 'vitest';
import {
  FEEDBACK_TYPES,
  canSendFeedback,
  feedbackEmailText,
  feedbackSubject,
  firstName,
  isOverDailyLimit,
  normalizeScreen,
  startOfFeedbackDay,
  thanksTitle,
  validateFeedbackInput,
  validateScreenshot,
} from './feedback';

describe('tipos', () => {
  it('chips en orden con su placeholder', () => {
    expect(FEEDBACK_TYPES.map((t) => t.label)).toEqual(['Idea', 'Algo falla', 'Otro']);
    expect(FEEDBACK_TYPES.map((t) => t.value)).toEqual(['idea', 'bug', 'otro']);
    expect(FEEDBACK_TYPES[1].placeholder).toBe('¿Qué pasó y en qué pantalla?');
  });
});

describe('canSendFeedback', () => {
  it('pide al menos 4 caracteres sin contar espacios', () => {
    expect(canSendFeedback('abc')).toBe(false);
    expect(canSendFeedback('   abc   ')).toBe(false);
    expect(canSendFeedback('abcd')).toBe(true);
  });
});

describe('validateFeedbackInput', () => {
  it('acepta y normaliza', () => {
    expect(validateFeedbackInput({ type: 'bug', message: '  No carga  ', screen: '/cuenta?x=1' })).toEqual({
      ok: true,
      value: { type: 'bug', message: 'No carga', screen: '/cuenta' },
    });
  });
  it('rechaza tipo desconocido, mensaje corto o enorme', () => {
    expect(validateFeedbackInput({ type: 'Idea', message: 'hola mundo' }).ok).toBe(false);
    expect(validateFeedbackInput({ type: 'idea', message: 'abc' }).ok).toBe(false);
    expect(validateFeedbackInput({ type: 'idea', message: 123 }).ok).toBe(false);
    expect(validateFeedbackInput({ type: 'idea', message: 'x'.repeat(5001) }).ok).toBe(false);
  });
});

describe('normalizeScreen', () => {
  it('solo rutas internas', () => {
    expect(normalizeScreen('/resumen/categoria/abc')).toBe('/resumen/categoria/abc');
    expect(normalizeScreen('https://evil.com')).toBeNull();
    expect(normalizeScreen('/a b')).toBeNull();
    expect(normalizeScreen(undefined)).toBeNull();
    expect(normalizeScreen('/' + 'a'.repeat(300))?.length).toBe(200);
  });
});

describe('validateScreenshot', () => {
  it('acepta imágenes de hasta 5 MB', () => {
    expect(validateScreenshot({ type: 'image/png', size: 1000 })).toEqual({ ok: true, value: { ext: 'png' } });
    expect(validateScreenshot({ type: 'image/jpeg', size: 5 * 1024 * 1024 })).toEqual({ ok: true, value: { ext: 'jpg' } });
  });
  it('rechaza otros tipos, vacías y pesadas', () => {
    expect(validateScreenshot({ type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(validateScreenshot({ type: 'image/svg+xml', size: 10 }).ok).toBe(false);
    expect(validateScreenshot({ type: 'image/png', size: 0 }).ok).toBe(false);
    expect(validateScreenshot({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }).ok).toBe(false);
  });
});

describe('feedbackSubject', () => {
  it('pone el tipo y las primeras 60 letras', () => {
    expect(feedbackSubject('idea', 'Que pueda   dividir\n gastos')).toBe('[Zafi · Idea] Que pueda dividir gastos');
    const long = 'á'.repeat(80);
    expect(feedbackSubject('bug', long)).toBe(`[Zafi · Algo falla] ${'á'.repeat(60)}`);
    expect(feedbackSubject('otro', 'Hola equipo')).toBe('[Zafi · Otro] Hola equipo');
  });
});

describe('límite diario', () => {
  it('el día empieza a medianoche de Guatemala', () => {
    expect(startOfFeedbackDay(new Date('2026-10-04T15:00:00Z'))).toBe('2026-10-04T06:00:00.000Z');
    // 2026-10-05 03:00 UTC sigue siendo el 4 en Guatemala.
    expect(startOfFeedbackDay(new Date('2026-10-05T03:00:00Z'))).toBe('2026-10-04T06:00:00.000Z');
    expect(startOfFeedbackDay(new Date('2026-10-05T06:00:00Z'))).toBe('2026-10-05T06:00:00.000Z');
  });
  it('5 por día: el sexto no pasa', () => {
    expect(isOverDailyLimit(0)).toBe(false);
    expect(isOverDailyLimit(4)).toBe(false);
    expect(isOverDailyLimit(5)).toBe(true);
  });
});

describe('gracias', () => {
  it('usa el primer nombre', () => {
    expect(firstName('Rodrigo López')).toBe('Rodrigo');
    expect(firstName('  ')).toBeNull();
    expect(thanksTitle('Rodrigo')).toBe('¡Gracias, Rodrigo!');
    expect(thanksTitle(null)).toBe('¡Gracias!');
  });
});

describe('feedbackEmailText', () => {
  it('incluye mensaje, pantalla, usuario y captura', () => {
    const text = feedbackEmailText({
      type: 'bug', message: 'No carga', screen: '/cuenta', userEmail: 'r@x.com', userName: 'Rodrigo',
      userId: 'u1', screenshotUrl: 'https://s/1', createdAt: '2026-10-04T15:00:00Z',
    });
    expect(text).toContain('Tipo: Algo falla');
    expect(text).toContain('Pantalla: /cuenta');
    expect(text).toContain('Usuario: Rodrigo <r@x.com>');
    expect(text).toContain('No carga');
    expect(text).toContain('Captura (enlace válido 7 días): https://s/1');
  });
  it('sin captura no la menciona', () => {
    const text = feedbackEmailText({
      type: 'idea', message: 'Hola', screen: null, userEmail: null, userName: null,
      userId: 'u1', screenshotUrl: null, createdAt: 'x',
    });
    expect(text).not.toContain('Captura');
    expect(text).toContain('Usuario: (sin correo)');
  });
});
