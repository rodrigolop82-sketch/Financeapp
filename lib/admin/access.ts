// Quién es admin (fase 12): el usuario maestro y, opcional, ADMIN_EMAIL.
// Es la misma regla que tenía app/api/admin/route.ts; aquí vive en un solo
// lugar para la página y todas las rutas /api/admin/*.

import { MASTER_EMAIL } from '../master-user';

export function adminEmails(env: { ADMIN_EMAIL?: string } = { ADMIN_EMAIL: process.env.ADMIN_EMAIL }): string[] {
  return [MASTER_EMAIL, env.ADMIN_EMAIL || ''].map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, env: { ADMIN_EMAIL?: string } = { ADMIN_EMAIL: process.env.ADMIN_EMAIL }): boolean {
  if (!email) return false;
  return adminEmails(env).includes(email.trim().toLowerCase());
}

// ── Recordatorio por push ─────────────────────────────────

/** Máximo de personas por llamada a "Enviar recordatorio". */
export const REMINDER_MAX_PER_CALL = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids únicos con forma de UUID; null si no hay ninguno o pasan del máximo. */
export function parseReminderIds(raw: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'Elige a quién enviarle el recordatorio.' };
  const ids = Array.from(new Set(raw.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x))));
  if (ids.length === 0) return { ok: false, error: 'Elige a quién enviarle el recordatorio.' };
  if (ids.length > REMINDER_MAX_PER_CALL) {
    return { ok: false, error: `Máximo ${REMINDER_MAX_PER_CALL} personas por envío.` };
  }
  return { ok: true, ids };
}

export const REMINDER_PAYLOAD = {
  title: 'Zafi',
  body: '¿Cómo vas este mes? Registra tus gastos en un minuto y mira cuánto puedes gastar hoy.',
  url: '/dashboard',
  tag: 'zafi-reactivar',
};

export interface ReminderSummary {
  sent: number;
  alreadyToday: number;
  /** Sin dispositivos con avisos activados (o todas sus suscripciones vencieron). */
  noDevice: number;
  /** Tenían dispositivo, pero el servicio de push rechazó el envío. */
  failed?: number;
  /** Códigos de error del servicio de push, sin repetir. */
  errorCodes?: number[];
}

/** "Recordatorio enviado a 3 · 1 ya tenía uno hoy · 2 sin avisos activados · 1 rechazado (403)". */
export function reminderToast(s: ReminderSummary): string {
  const parts: string[] = [];
  parts.push(s.sent > 0 ? `Recordatorio enviado a ${s.sent} usuario${s.sent === 1 ? '' : 's'}` : 'No se envió ningún recordatorio');
  if (s.alreadyToday > 0) parts.push(`${s.alreadyToday} ya tenía${s.alreadyToday === 1 ? '' : 'n'} uno hoy`);
  if (s.noDevice > 0) parts.push(`${s.noDevice} sin avisos activados`);
  if (s.failed && s.failed > 0) {
    const codes = s.errorCodes && s.errorCodes.length > 0 ? ` (${s.errorCodes.join(', ')})` : '';
    parts.push(`${s.failed} rechazado${s.failed === 1 ? '' : 's'} por el servicio de push${codes}`);
  }
  return parts.join(' · ');
}

// ── Recordatorio por correo ───────────────────────────────

export interface EmailReminderSummary {
  sent: number;
  /** No aceptaron recibir correos: no se les envió. */
  noConsent: number;
}

/** "Correo enviado a 3 · 2 no aceptaron correos". */
export function emailReminderToast(s: EmailReminderSummary): string {
  const parts: string[] = [];
  parts.push(s.sent > 0 ? `Correo enviado a ${s.sent} usuario${s.sent === 1 ? '' : 's'}` : 'No se envió ningún correo');
  if (s.noConsent > 0) parts.push(`${s.noConsent} no ${s.noConsent === 1 ? 'aceptó' : 'aceptaron'} correos`);
  return parts.join(' · ');
}
