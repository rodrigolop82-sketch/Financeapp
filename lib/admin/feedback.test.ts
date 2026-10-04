import { describe, it, expect } from 'vitest';
import {
  feedbackDate,
  isFeedbackAction,
  matchesFeedbackFilter,
  nextStatus,
  replyEmail,
  screenLabel,
  statusLabel,
  typeLabel,
  validateReply,
} from './feedback';

const NOW = Date.parse('2026-10-04T18:00:00Z'); // 12:00 en Guatemala

describe('etiquetas', () => {
  it('tipo, estado y pantalla', () => {
    expect(typeLabel('bug')).toBe('Algo falla');
    expect(typeLabel('idea')).toBe('Idea');
    expect(typeLabel('x')).toBe('Otro');
    expect(statusLabel('nuevo')).toBe('Nuevo');
    expect(statusLabel('leido')).toBe('Leído');
    expect(statusLabel('respondido')).toBe('✓ Respondido');
    expect(screenLabel('/presupuesto')).toBe('Plan del mes');
    expect(screenLabel('/cuenta/categorias')).toBe('Mi cuenta');
    expect(screenLabel('/otra')).toBe('/otra');
    expect(screenLabel(null)).toBe('sin pantalla');
  });
  it('fecha relativa en hora de Guatemala', () => {
    expect(feedbackDate('2026-10-04T15:12:00Z', NOW)).toBe('Hoy 9:12');
    expect(feedbackDate('2026-10-04T03:00:00Z', NOW)).toBe('Ayer');
    expect(feedbackDate('2026-10-01T18:00:00Z', NOW)).toBe('1 oct');
  });
});

describe('filtros', () => {
  const m = (type: string, status: 'nuevo' | 'leido' | 'respondido') => ({ type, status });
  it('Sin responder, Idea, Algo falla, Todos', () => {
    expect(matchesFeedbackFilter(m('idea', 'leido'), 'Sin responder')).toBe(true);
    expect(matchesFeedbackFilter(m('idea', 'respondido'), 'Sin responder')).toBe(false);
    expect(matchesFeedbackFilter(m('bug', 'nuevo'), 'Algo falla')).toBe(true);
    expect(matchesFeedbackFilter(m('bug', 'nuevo'), 'Idea')).toBe(false);
    expect(matchesFeedbackFilter(m('otro', 'respondido'), 'Todos')).toBe(true);
  });
});

describe('estados', () => {
  it('abrir pasa nuevo → leído; resolver y responder → respondido; reabrir → leído', () => {
    expect(nextStatus('nuevo', 'abrir')).toBe('leido');
    expect(nextStatus('respondido', 'abrir')).toBe('respondido');
    expect(nextStatus('nuevo', 'resolver')).toBe('respondido');
    expect(nextStatus('leido', 'responder')).toBe('respondido');
    expect(nextStatus('respondido', 'reabrir')).toBe('leido');
    expect(nextStatus('nuevo', 'reabrir')).toBe('nuevo');
    expect(isFeedbackAction('abrir')).toBe(true);
    expect(isFeedbackAction('borrar')).toBe(false);
  });
});

describe('respuesta', () => {
  it('valida el texto', () => {
    expect(validateReply('  ')).toEqual({ ok: false, error: 'Escribe tu respuesta.' });
    expect(validateReply(' Gracias ')).toEqual({ ok: true, value: 'Gracias' });
    expect(validateReply('x'.repeat(5001)).ok).toBe(false);
  });
  it('arma el correo con saludo, firma y el mensaje citado', () => {
    const e = replyEmail({ reply: '¡Ya lo arreglamos!', firstName: 'Juan', type: 'bug', message: 'Se duplicó\nun pago', createdAt: '2026-10-01T18:00:00Z' });
    expect(e.subject).toBe('Re: lo que nos reportaste en Zafi');
    expect(e.text).toBe('Hola, Juan:\n\n¡Ya lo arreglamos!\n\n— El equipo de Zafi\nhola@zafiapp.com\n\nTu mensaje del 1 oct:\n> Se duplicó\n> un pago');
    expect(replyEmail({ reply: 'ok', firstName: '', type: 'idea', message: 'x', createdAt: '' }).text.startsWith('Hola:')).toBe(true);
    expect(replyEmail({ reply: 'ok', firstName: '', type: 'idea', message: 'x', createdAt: '' }).subject).toBe('Re: tu idea para Zafi');
  });
});
