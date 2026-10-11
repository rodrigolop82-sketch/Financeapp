import { describe, it, expect } from 'vitest';
import { escapeHtml, parseReminderKind, reminderEmail, reminderKindFor } from './reminder-email';

describe('reminderEmail', () => {
  it('empezar: asunto con nombre, botón al dashboard y salida a Tu cuenta', () => {
    const e = reminderEmail({ kind: 'empezar', firstName: 'María', appUrl: 'https://zafiapp.com/' });
    expect(e.subject).toBe('María, tu primer paso con Zafi toma 1 minuto');
    expect(e.html).toContain('href="https://zafiapp.com/dashboard"');
    expect(e.html).toContain('href="https://zafiapp.com/cuenta"');
    expect(e.html).toContain('Hola, María:');
    expect(e.text).toContain('Registrar mi primer gasto: https://zafiapp.com/dashboard');
    expect(e.text).toContain('https://zafiapp.com/cuenta');
  });
  it('volver y sin nombre', () => {
    const e = reminderEmail({ kind: 'volver', firstName: '', appUrl: 'https://zafiapp.com' });
    expect(e.subject).toBe('¿Cómo vas este mes?');
    expect(e.text.startsWith('Hola:')).toBe(true);
    expect(e.html).toContain('Ver mi mes');
  });
  it('escapa el nombre', () => {
    const e = reminderEmail({ kind: 'empezar', firstName: '<b>x</b>', appUrl: 'https://zafiapp.com' });
    expect(e.html).not.toContain('<b>x</b>');
    expect(e.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
  it('tipo según movimientos y parseo', () => {
    expect(reminderKindFor({ txCount: 0 })).toBe('empezar');
    expect(reminderKindFor({ txCount: 4 })).toBe('volver');
    expect(parseReminderKind('volver')).toBe('volver');
    expect(parseReminderKind('otro')).toBe('empezar');
  });
});
