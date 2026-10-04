// Admin › Feedback (fase 12): etiquetas, filtros, estados y correo de respuesta.
// Lógica pura para probarla con vitest.

import { feedbackTypeLabel, isFeedbackType } from '../feedback';
import { DAY_MS, TZ_OFFSET_MS, dayMonth, localDayKey, toMs } from './dataset';

export type FeedbackStatus = 'nuevo' | 'leido' | 'respondido';

export interface AdminFeedbackItem {
  id: string;
  type: string;
  message: string;
  screen: string | null;
  status: FeedbackStatus;
  createdAt: string;
  email: string | null;
  firstName: string;
  hasScreenshot: boolean;
}

export const FEEDBACK_FILTERS = ['Sin responder', 'Idea', 'Algo falla', 'Todos'] as const;
export type FeedbackFilter = (typeof FEEDBACK_FILTERS)[number];

export function typeLabel(type: string): string {
  return isFeedbackType(type) ? feedbackTypeLabel(type) : 'Otro';
}

export function matchesFeedbackFilter(item: Pick<AdminFeedbackItem, 'type' | 'status'>, f: FeedbackFilter): boolean {
  switch (f) {
    case 'Todos': return true;
    case 'Sin responder': return item.status !== 'respondido';
    case 'Idea': return item.type === 'idea';
    case 'Algo falla': return item.type === 'bug';
  }
}

export function statusLabel(s: FeedbackStatus): string {
  return s === 'nuevo' ? 'Nuevo' : s === 'leido' ? 'Leído' : '✓ Respondido';
}

export function isFeedbackStatus(v: unknown): v is FeedbackStatus {
  return v === 'nuevo' || v === 'leido' || v === 'respondido';
}

export type FeedbackAction = 'abrir' | 'resolver' | 'reabrir';

export function isFeedbackAction(v: unknown): v is FeedbackAction {
  return v === 'abrir' || v === 'resolver' || v === 'reabrir';
}

/** Abrir pasa "nuevo" a "leído"; resolver marca "respondido"; reabrir vuelve a "leído". */
export function nextStatus(current: FeedbackStatus, action: FeedbackAction | 'responder'): FeedbackStatus {
  switch (action) {
    case 'abrir': return current === 'nuevo' ? 'leido' : current;
    case 'resolver':
    case 'responder': return 'respondido';
    case 'reabrir': return current === 'respondido' ? 'leido' : current;
  }
}

const SCREENS: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/transacciones': 'Movimientos',
  '/presupuesto': 'Plan del mes',
  '/metas': 'Metas',
  '/mas': 'Más',
  '/cuenta': 'Mi cuenta',
  '/resumen': 'Cómo te fue',
  '/deudas': 'Deudas',
  '/cierre-mes': 'Cerrar el mes',
  '/chat': 'Pregúntale a Zafi',
  '/aprende': 'Aprende',
  '/mis-fuentes': 'Mis bancos',
  '/familia': 'Familia',
  '/importar': 'Importar',
  '/score': 'Tu salud financiera',
};

/** Nombre de la pantalla desde la ruta guardada ("/cuenta/categorias" → "Mi cuenta"). */
export function screenLabel(screen: string | null | undefined): string {
  if (!screen) return 'sin pantalla';
  const path = screen.split('?')[0];
  if (SCREENS[path]) return SCREENS[path];
  const root = '/' + (path.split('/')[1] ?? '');
  return SCREENS[root] ?? path;
}

/** "Hoy 9:12", "Ayer", "1 oct" (hora de Guatemala). */
export function feedbackDate(iso: string, now: number): string {
  const ms = toMs(iso);
  if (ms === null) return '';
  const day = localDayKey(ms);
  if (day === localDayKey(now)) {
    const d = new Date(ms + TZ_OFFSET_MS);
    return `Hoy ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
  if (day === localDayKey(now - DAY_MS)) return 'Ayer';
  return dayMonth(ms);
}

export const REPLY_MAX_LENGTH = 5000;

export function validateReply(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, error: 'Escribe tu respuesta.' };
  if (text.length > REPLY_MAX_LENGTH) return { ok: false, error: 'La respuesta es muy larga.' };
  return { ok: true, value: text };
}

/** Correo de respuesta: saludo, respuesta, firma y el mensaje original citado. */
export function replyEmail(input: { reply: string; firstName: string; type: string; message: string; createdAt: string }): { subject: string; text: string } {
  const subject =
    input.type === 'idea' ? 'Re: tu idea para Zafi'
      : input.type === 'bug' ? 'Re: lo que nos reportaste en Zafi'
        : 'Re: tu mensaje a Zafi';
  const greeting = input.firstName ? `Hola, ${input.firstName}:` : 'Hola:';
  const ms = toMs(input.createdAt);
  const when = ms === null ? '' : ` del ${dayMonth(ms)}`;
  const quoted = input.message.split(/\r?\n/).map((l) => `> ${l}`).join('\n');
  const text = [
    greeting,
    '',
    input.reply,
    '',
    '— El equipo de Zafi',
    'hola@zafiapp.com',
    '',
    `Tu mensaje${when}:`,
    quoted,
  ].join('\n');
  return { subject, text };
}
