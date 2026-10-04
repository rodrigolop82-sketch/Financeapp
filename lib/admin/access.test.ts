import { describe, it, expect } from 'vitest';
import { REMINDER_MAX_PER_CALL, isAdminEmail, parseReminderIds, reminderToast } from './access';
import { MASTER_EMAIL } from '../master-user';

describe('isAdminEmail', () => {
  it('el usuario maestro y ADMIN_EMAIL, nadie más', () => {
    expect(isAdminEmail(MASTER_EMAIL, {})).toBe(true);
    expect(isAdminEmail(MASTER_EMAIL.toUpperCase(), {})).toBe(true);
    expect(isAdminEmail('otra@correo.com', {})).toBe(false);
    expect(isAdminEmail('otra@correo.com', { ADMIN_EMAIL: 'otra@correo.com' })).toBe(true);
    expect(isAdminEmail('', { ADMIN_EMAIL: '' })).toBe(false);
    expect(isAdminEmail(null, {})).toBe(false);
  });
});

describe('recordatorio', () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  it('ids válidos, únicos y con máximo', () => {
    expect(parseReminderIds([id(1), id(1), 'x', 3])).toEqual({ ok: true, ids: [id(1)] });
    expect(parseReminderIds([]).ok).toBe(false);
    expect(parseReminderIds('x').ok).toBe(false);
    const many = Array.from({ length: REMINDER_MAX_PER_CALL + 1 }, (_, i) => id(i));
    expect(parseReminderIds(many)).toEqual({ ok: false, error: 'Máximo 50 personas por envío.' });
  });
  it('mensaje del resultado', () => {
    expect(reminderToast({ sent: 3, alreadyToday: 0, noDevice: 0 })).toBe('Recordatorio enviado a 3 usuarios');
    expect(reminderToast({ sent: 1, alreadyToday: 1, noDevice: 2 })).toBe('Recordatorio enviado a 1 usuario · 1 ya tenía uno hoy · 2 sin avisos activados');
    expect(reminderToast({ sent: 0, alreadyToday: 0, noDevice: 2 })).toBe('No se envió ningún recordatorio · 2 sin avisos activados');
  });
});
