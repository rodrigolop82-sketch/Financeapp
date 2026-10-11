// Apple Pay vía Atajos (fase 13.3): validación de lo que manda el atajo y
// límite por clave. Puro (sin Supabase ni crypto) para probarlo con vitest.
// El servidor: lib/apple-pay-server.ts; la clave: lib/apple-pay-token.ts.

/** Las claves del atajo empiezan así (se reconocen en logs y al pegarlas). */
export const TOKEN_PREFIX = 'zafi_';
/** 32 bytes en base64url = 43 caracteres. */
const TOKEN_RE = /^zafi_[A-Za-z0-9_-]{43}$/;

export function looksLikeShortcutToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

export const MAX_AMOUNT = 1_000_000;
export const MAX_MERCHANT = 80;
export const MAX_CARD = 40;
/** Un pago no puede ser de hace más de un año ni de más de un día en el futuro. */
export const MAX_PAST_DAYS = 365;
export const MAX_FUTURE_DAYS = 1;

/** Máximo de pagos por clave por hora. */
export const RATE_LIMIT = 30;
export const RATE_WINDOW_MS = 3_600_000;

export interface ParsedAmount {
  amount: number;
  /** GTQ, USD, EUR, MXN. */
  currency: string;
}

function detectCurrencyIn(s: string): string {
  const u = s.toUpperCase();
  if (/MXN|MX\$/.test(u)) return 'MXN';
  if (/USD|US\$|\$/.test(u)) return 'USD';
  if (/EUR|€/.test(u)) return 'EUR';
  return 'GTQ';
}

/** Número con separadores de miles o decimales en cualquier estilo. */
function parseNumber(raw: string): number | null {
  let s = raw.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s) || s.lastIndexOf('-') > 0) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // El último separador es el decimal.
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    s = s.split(thou).join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    // "85,50" → decimal; "1,250" → miles.
    s = /,\d{1,2}$/.test(s) && s.split(',').length === 2 ? s.replace(',', '.') : s.split(',').join('');
  } else if (lastDot >= 0 && s.split('.').length > 2) {
    s = s.split('.').join('');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "Q 1,250.50", "$12.50", "85,50", 85.5 → monto y moneda; null si no es válido. */
export function parseAmount(input: unknown): ParsedAmount | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0 || input > MAX_AMOUNT) return null;
    return { amount: Math.round(input * 100) / 100, currency: 'GTQ' };
  }
  if (typeof input !== 'string' || input.trim().length === 0 || input.length > 40) return null;
  const n = parseNumber(input);
  if (n === null || n <= 0 || n > MAX_AMOUNT) return null;
  return { amount: Math.round(n * 100) / 100, currency: detectCurrencyIn(input) };
}

/** Texto limpio: sin caracteres de control, espacios colapsados y recortado. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function isRealDate(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Fecha en Guatemala de un instante. */
function guatemalaDate(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/**
 * Fecha del pago. Sin fecha, hoy. Acepta "2026-10-04", ISO con zona del
 * teléfono ("2026-10-04T21:30:00-06:00" → ese día) o en UTC (se pasa a
 * Guatemala). Devuelve null si no se entiende o está fuera de rango.
 */
export function parseDate(input: unknown, today: string): string | null {
  if (input === undefined || input === null || input === '') return today;
  if (typeof input !== 'string' || input.length > 40) return null;
  const s = input.trim();
  let date: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) date = s;
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?[+-]\d{2}:?\d{2}$/.test(s)) date = s.slice(0, 10);
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(s) && Number.isFinite(Date.parse(s))) date = guatemalaDate(Date.parse(s));
  if (!date || !isRealDate(date)) return null;
  const diff = dayNumber(date) - dayNumber(today);
  if (diff > MAX_FUTURE_DAYS || diff < -MAX_PAST_DAYS) return null;
  return date;
}

export interface ApplePayCharge {
  amount: number;
  currency: string;
  merchant: string;
  card: string | null;
  date: string;
}

export type ParseResult = { ok: true; value: ApplePayCharge } | { ok: false; error: string };

/** " Llegó: …" para que el error del atajo diga qué mandó Atajos. */
function describeReceived(v: unknown): string {
  if (v === undefined || v === null || v === '') return ' No llegó ningún monto: revisa que el atajo mande la variable “Monto” de la transacción.';
  const shown = typeof v === 'string' ? `"${cleanText(v, 40)}"` : typeof v === 'number' ? String(v) : typeof v;
  return ` Llegó: ${shown}.`;
}

/** Valida el JSON del atajo: { amount, merchant, card, date }. */
export function parseApplePayBody(body: unknown, today: string): ParseResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Manda un JSON con amount, merchant, card y date.' };
  const b = body as Record<string, unknown>;
  const amount = parseAmount(b.amount);
  if (!amount) return { ok: false, error: `Monto inválido.${describeReceived(b.amount)}` };
  const date = parseDate(b.date, today);
  if (!date) return { ok: false, error: 'Fecha inválida. Usa el formato ISO 8601 (AAAA-MM-DD).' };
  const merchant = cleanText(b.merchant, MAX_MERCHANT) || 'Apple Pay';
  const card = cleanText(b.card, MAX_CARD) || null;
  return { ok: true, value: { ...amount, merchant, card, date } };
}

export interface RateState {
  start: string | null;
  count: number;
}

/** Ventana fija por clave: hasta RATE_LIMIT pagos por hora. */
export function rateLimitStep(state: RateState, nowMs: number, limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS): { allowed: boolean; next: RateState } {
  const startMs = state.start ? Date.parse(state.start) : NaN;
  if (!Number.isFinite(startMs) || nowMs - startMs >= windowMs) {
    return { allowed: true, next: { start: new Date(nowMs).toISOString(), count: 1 } };
  }
  if (state.count >= limit) return { allowed: false, next: state };
  return { allowed: true, next: { start: state.start, count: state.count + 1 } };
}

/** "BI Visa ··4821" o "Apple Pay" para la etiqueta de la hoja. */
export function cardLabel(card: string | null | undefined): string {
  const c = (card ?? '').trim();
  return c ? `Apple Pay · ${c}` : 'Apple Pay';
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function shortDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Creada el 4 oct · usada hoy" para la lista de claves. */
export function tokenSummary(t: { created_at: string; last_used_at: string | null }, nowMs: number): string {
  const created = `Creada el ${shortDay(t.created_at)}`;
  if (!t.last_used_at) return `${created} · sin usar todavía`;
  const used = new Date(t.last_used_at);
  const now = new Date(nowMs);
  const sameDay = used.getFullYear() === now.getFullYear() && used.getMonth() === now.getMonth() && used.getDate() === now.getDate();
  return `${created} · usada ${sameDay ? 'hoy' : `el ${shortDay(t.last_used_at)}`}`;
}

/** Los 4 pasos de la pantalla Mis bancos › Apple Pay. */
export const SHORTCUT_STEPS: { title: string; detail: string }[] = [
  { title: 'Abre Atajos › Automatización', detail: 'Toca “Nueva automatización” y elige “Transacción”.' },
  { title: 'Elige tus tarjetas', detail: 'Marca las tarjetas de Wallet que quieres registrar.' },
  { title: 'Agrega “Registrar en Zafi”', detail: 'O instala nuestro atajo y se configura solo.' },
  { title: 'Activa “Ejecutar de inmediato”', detail: 'Así no te pregunta en cada pago.' },
];
