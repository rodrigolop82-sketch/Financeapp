// Envío de correo con Resend por su API HTTP (sin SDK). Solo servidor.
// Sin RESEND_API_KEY no envía nada: registra un aviso y responde `skipped`.

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  /** Por defecto, FEEDBACK_FROM_EMAIL o "Zafi <hola@zafiapp.com>". */
  from?: string;
  replyTo?: string | null;
}

export type EmailResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false; error: string };

export const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Zafi <hola@zafiapp.com>';

export function defaultFromAddress(): string {
  return process.env.FEEDBACK_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

export async function sendEmail(msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[email] Falta RESEND_API_KEY: no se envió el correo', { subject: msg.subject });
    return { ok: false, skipped: true };
  }
  const payload: Record<string, unknown> = {
    from: msg.from || defaultFromAddress(),
    to: Array.isArray(msg.to) ? msg.to : [msg.to],
    subject: msg.subject,
    text: msg.text,
  };
  if (msg.html) payload.html = msg.html;
  if (msg.replyTo) payload.reply_to = msg.replyTo;

  try {
    const res = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      const error = data.message || `Resend respondió ${res.status}`;
      console.error('[email] Error al enviar', error);
      return { ok: false, skipped: false, error };
    }
    return { ok: true, id: data.id ?? null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[email] Error al enviar', error);
    return { ok: false, skipped: false, error };
  }
}
