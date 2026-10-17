// Android (C15): dos caminos para que los avisos del banco lleguen a Zafi.
// 1) Compartir a Zafi (Web Share Target del manifest → Agregar).
// 2) Automático: MacroDroid/Tasker manda el texto del aviso a
//    POST /api/parse-notification con la misma clave personal del atajo de
//    Apple Pay. Aquí va lo puro (sin Supabase ni IA) para probarlo.
import { cleanText, parseAmount, MAX_CARD, MAX_MERCHANT, type ApplePayCharge } from './apple-pay';

/** Largo máximo del texto de un aviso que se acepta. */
export const MAX_NOTIFICATION_TEXT = 600;

export interface AndroidNotice {
  text: string;
  /** Nombre de la app que mandó el aviso (p. ej. "BAM"), si llega. */
  app: string | null;
}

/** Lo que manda MacroDroid: texto plano o JSON con `text` (y `app`). */
export function esCuerpoAndroid(body: unknown): boolean {
  if (typeof body === 'string') return true;
  return !!body && typeof body === 'object' && !Array.isArray(body)
    && 'text' in body && !('amount' in body);
}

export function parseAndroidBody(body: unknown): { ok: true; value: AndroidNotice } | { ok: false; error: string } {
  const raw = typeof body === 'string' ? body : (body as Record<string, unknown> | null)?.text;
  const text = cleanText(raw, MAX_NOTIFICATION_TEXT);
  if (text.length < 5) return { ok: false, error: 'Manda el texto del aviso (por ejemplo "[notification_title] [notification]").' };
  const app = typeof body === 'object' && body ? cleanText((body as Record<string, unknown>).app, MAX_CARD) || null : null;
  return { ok: true, value: { text, app } };
}

/** Un monto con moneda ("Q 85.50", "GTQ1,250", "$12", "USD 9.99"). */
const MONTO_RE = /(?:Q|GTQ|US\$|USD|\$|MXN|EUR|€)\s?\d[\d.,]*/i;

/**
 * ¿Vale la pena interpretarlo? Solo los avisos con un monto en moneda.
 * Los demás (códigos, promociones sin monto) se ignoran sin gastar IA ni
 * contar para el límite por hora.
 */
export function pareceCobro(text: string): boolean {
  return MONTO_RE.test(text);
}

export interface Extraccion {
  amount: number;
  merchant: string;
  bank: string;
  currency: string;
  type: 'expense' | 'income';
}

export type CobroAndroid =
  | { ok: true; value: ApplePayCharge }
  | { ok: false; reason: 'sin_monto' | 'ingreso' };

/** De lo extraído a un gasto. Los ingresos no se registran solos. */
export function cobroDesdeExtraccion(e: Extraccion | null, notice: AndroidNotice, today: string): CobroAndroid {
  if (!e) return { ok: false, reason: 'sin_monto' };
  const parsed = parseAmount(e.amount);
  if (!parsed) return { ok: false, reason: 'sin_monto' };
  if (e.type === 'income') return { ok: false, reason: 'ingreso' };
  const currency = /^[A-Z]{3}$/.test(e.currency) ? e.currency : 'GTQ';
  const banco = cleanText(e.bank, MAX_CARD) || notice.app;
  return {
    ok: true,
    value: {
      amount: parsed.amount,
      currency,
      merchant: cleanText(e.merchant, MAX_MERCHANT) || banco || 'Aviso del banco',
      card: banco,
      date: today,
    },
  };
}

export const IGNORADO_TEXTO: Record<'no_es_cobro' | 'sin_monto' | 'ingreso', string> = {
  no_es_cobro: 'El aviso no trae un monto: no se registró nada.',
  sin_monto: 'No encontramos un gasto en el aviso: no se registró nada.',
  ingreso: 'Es un ingreso: regístralo en Zafi cuando quieras.',
};

/** Ventana para no registrar dos veces el mismo aviso (MacroDroid a veces repite). */
export const DUPLICADO_MS = 10 * 60_000;

/** Pasos de "Compartir a Zafi". */
export const PASOS_COMPARTIR: { title: string; detail: string }[] = [
  { title: 'Instala Zafi en tu pantalla de inicio', detail: 'En Chrome, toca ⋮ › “Instalar app” (o “Agregar a pantalla principal”).' },
  { title: 'Comparte el SMS del banco', detail: 'Mantén presionado el mensaje › Compartir › Zafi. Se abre Agregar con el monto y el comercio.' },
  { title: 'Confirma y listo', detail: 'Revisa la categoría y guarda. Si es una notificación, cópiala y pégala en “Pegar notificación”.' },
];

/** Pasos de MacroDroid (Tasker funciona igual con una tarea “HTTP Request”). */
export const PASOS_MACRODROID: { title: string; detail: string }[] = [
  { title: 'Instala MacroDroid', detail: 'Es gratis en Play Store. Dale permiso para leer notificaciones.' },
  { title: 'Disparador: Notificación recibida', detail: 'Elige SOLO las apps de tu banco. Así Zafi no ve tus otras notificaciones.' },
  { title: 'Acción: Solicitud HTTP', detail: 'POST a la dirección de abajo, con el encabezado Authorization y el cuerpo de abajo.' },
  { title: 'Prueba', detail: 'Haz una compra o usa “Probar con un aviso”. Te llega un aviso de Zafi para confirmar la categoría.' },
];

/** Cuerpo para MacroDroid (texto plano: las comillas del aviso no lo rompen). */
export const MACRODROID_BODY = '[notification_title] [notification]';

/**
 * Texto compartido a Zafi (Web Share Target): título y texto juntos, sin
 * repetir el título si el texto ya lo trae. null si no llegó nada.
 */
export function sharedNotice(title: string | null, text: string | null): string | null {
  const t = (title ?? '').trim();
  const x = (text ?? '').trim();
  if (!t) return x || null;
  if (!x || x.includes(t)) return x || t;
  return `${t}: ${x}`;
}
