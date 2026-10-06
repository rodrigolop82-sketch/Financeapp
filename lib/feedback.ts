// "Envíanos tu idea" (fase 11): validación, asunto del correo y límite diario.
// Sin dependencias de React ni de Supabase para poder probarlo con vitest.

export type FeedbackType = 'idea' | 'bug' | 'otro';

export interface FeedbackTypeOption {
  value: FeedbackType;
  label: string;
  placeholder: string;
}

/** Chips de la hoja, en orden. `value` es lo que se guarda en `feedback.type`. */
export const FEEDBACK_TYPES: FeedbackTypeOption[] = [
  { value: 'idea', label: 'Idea', placeholder: '¿Qué te gustaría que Zafi hiciera?' },
  { value: 'bug', label: 'Algo falla', placeholder: '¿Qué pasó y en qué pantalla?' },
  { value: 'otro', label: 'Otro', placeholder: 'Cuéntanos…' },
];

/** Mínimo de caracteres (sin espacios a los lados) para poder enviar. */
export const FEEDBACK_MIN_LENGTH = 4;
export const FEEDBACK_MAX_LENGTH = 5000;
export const FEEDBACK_DAILY_LIMIT = 5;
/** Tamaño máximo de la captura que acepta el servidor. */
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

export const FEEDBACK_LIMIT_MESSAGE =
  'Ya nos mandaste 5 mensajes hoy. ¡Gracias por tanto! Escríbenos de nuevo mañana.';

export function isFeedbackType(v: unknown): v is FeedbackType {
  return FEEDBACK_TYPES.some((t) => t.value === v);
}

export function feedbackTypeLabel(type: FeedbackType): string {
  return FEEDBACK_TYPES.find((t) => t.value === type)?.label ?? 'Otro';
}

export function canSendFeedback(message: string): boolean {
  return message.trim().length >= FEEDBACK_MIN_LENGTH;
}

export interface FeedbackInput {
  type: FeedbackType;
  message: string;
  screen: string | null;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Valida lo que manda el cliente. Normaliza el mensaje y la ruta. */
export function validateFeedbackInput(raw: { type?: unknown; message?: unknown; screen?: unknown }): ValidationResult<FeedbackInput> {
  if (!isFeedbackType(raw.type)) return { ok: false, error: 'Elige si es una idea, algo que falla u otro.' };
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  if (message.length < FEEDBACK_MIN_LENGTH) return { ok: false, error: 'Cuéntanos un poco más.' };
  if (message.length > FEEDBACK_MAX_LENGTH) return { ok: false, error: 'Tu mensaje es muy largo. Resúmelo un poco.' };
  return { ok: true, value: { type: raw.type, message, screen: normalizeScreen(raw.screen) } };
}

/** Solo rutas internas ("/cuenta"), sin query ni nada raro, máx. 200 caracteres. */
export function normalizeScreen(screen: unknown): string | null {
  if (typeof screen !== 'string') return null;
  const path = screen.trim().split(/[?#]/)[0];
  if (!/^\/[A-Za-z0-9/_\-.]*$/.test(path)) return null;
  return path.slice(0, 200);
}

/** Valida la captura: imagen de un tipo conocido y de máximo 5 MB. */
export function validateScreenshot(file: { type: string; size: number }): ValidationResult<{ ext: string }> {
  const type = file.type.toLowerCase();
  if (!SCREENSHOT_MIME_TYPES.includes(type)) return { ok: false, error: 'La captura tiene que ser una imagen.' };
  if (file.size <= 0) return { ok: false, error: 'La captura está vacía.' };
  if (file.size > SCREENSHOT_MAX_BYTES) return { ok: false, error: 'La captura pesa más de 5 MB.' };
  const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
  return { ok: true, value: { ext } };
}

/** "[Zafi · Idea] Primeras 60 letras del mensaje" (espacios colapsados). */
export function feedbackSubject(type: FeedbackType, message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  const first = Array.from(flat).slice(0, 60).join('');
  return `[Zafi · ${feedbackTypeLabel(type)}] ${first}`;
}

/**
 * Inicio del día de hoy en Guatemala (UTC−6, sin horario de verano) como ISO
 * UTC. El límite diario cuenta los envíos desde ese momento.
 */
export function startOfFeedbackDay(now: Date = new Date()): string {
  const OFFSET_MS = 6 * 60 * 60 * 1000;
  const local = new Date(now.getTime() - OFFSET_MS);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(startLocal + OFFSET_MS).toISOString();
}

/** ¿Ya llegó al límite? `sentToday` = envíos guardados hoy antes de este. */
export function isOverDailyLimit(sentToday: number, limit: number = FEEDBACK_DAILY_LIMIT): boolean {
  return sentToday >= limit;
}

/** Primer nombre para "¡Gracias, {nombre}!". Null si no hay. */
export function firstName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? '').trim().split(/\s+/)[0];
  return first ? first : null;
}

export function thanksTitle(name: string | null | undefined): string {
  return name ? `¡Gracias, ${name}!` : '¡Gracias!';
}

export interface FeedbackEmailData {
  type: FeedbackType;
  message: string;
  screen: string | null;
  userEmail: string | null;
  userName: string | null;
  userId: string;
  screenshotUrl: string | null;
  createdAt: string;
}

export type FeedbackEmailStatus = 'enviado' | 'omitido' | 'fallido';

export function isFeedbackEmailStatus(v: unknown): v is FeedbackEmailStatus {
  return v === 'enviado' || v === 'omitido' || v === 'fallido';
}

/** Resultado de `sendEmail` → lo que se guarda en `feedback.email_status` / `email_error`. */
export function feedbackEmailOutcome(
  result: { ok: true } | { ok: false; skipped: true } | { ok: false; skipped: false; error: string },
): { email_status: FeedbackEmailStatus; email_error: string | null } {
  if (result.ok) return { email_status: 'enviado', email_error: null };
  if (result.skipped) return { email_status: 'omitido', email_error: null };
  return { email_status: 'fallido', email_error: result.error.slice(0, 300) };
}

/** Cuerpo del correo en texto plano. */
export function feedbackEmailText(d: FeedbackEmailData): string {
  const who = [d.userName, d.userEmail ? `<${d.userEmail}>` : null].filter(Boolean).join(' ') || '(sin correo)';
  const lines = [
    `Tipo: ${feedbackTypeLabel(d.type)}`,
    `Pantalla: ${d.screen ?? '(desconocida)'}`,
    `Usuario: ${who}`,
    `ID: ${d.userId}`,
    `Fecha: ${d.createdAt}`,
    '',
    d.message,
  ];
  if (d.screenshotUrl) lines.push('', `Captura (enlace válido 7 días): ${d.screenshotUrl}`);
  lines.push('', 'Responde a este correo para escribirle directo.');
  return lines.join('\n');
}
