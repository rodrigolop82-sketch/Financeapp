import { NextRequest, NextResponse } from 'next/server';
import { loadTxs, loadUsers, requireAdmin } from '@/lib/admin/server';
import { buildCtx, computeUsuarios } from '@/lib/admin/metrics';
import { parseReminderIds, type EmailReminderSummary } from '@/lib/admin/access';
import { parseReminderKind, reminderEmail, reminderKindFor } from '@/lib/admin/reminder-email';
import { defaultFromAddress, emailConfigured, sendEmailBatch, type EmailMessage } from '@/lib/email';
import { SUPPORT_EMAIL } from '@/lib/cuenta';

export const dynamic = 'force-dynamic';

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://zafiapp.com';
}

/**
 * GET /api/admin/correo?kind=empezar|volver — vista previa del correo de
 * recordatorio (HTML), con un nombre de ejemplo. Solo admins.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const kind = parseReminderKind(req.nextUrl.searchParams.get('kind'));
  const { html } = reminderEmail({ kind, firstName: 'María', appUrl: appUrl() });
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/**
 * POST /api/admin/correo { userIds: string[] } — correo de recordatorio a los
 * seleccionados (máx. 50 por llamada), uno por persona. Quien nunca capturó
 * recibe "empezar" y quien ya usó Zafi, "volver". Solo a quienes aceptaron
 * recibir correos (users.marketing_opt_in). Sin RESEND_API_KEY responde 503.
 * Solo admins.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!emailConfigured()) {
    return NextResponse.json({ error: 'El correo no está configurado (falta RESEND_API_KEY).' }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { userIds?: unknown };
  const parsed = parseReminderIds(body.userIds);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [users, txs] = await Promise.all([loadUsers(guard.admin), loadTxs(guard.admin)]);
  const wanted = new Set(parsed.ids);
  const rows = computeUsuarios(buildCtx(users, txs, Date.now())).filter((r) => wanted.has(r.id));

  const summary: EmailReminderSummary = { sent: 0, noConsent: 0 };
  const messages: EmailMessage[] = [];
  for (const r of rows) {
    if (!r.marketingOptIn || !r.email) {
      summary.noConsent++;
      continue;
    }
    const { subject, text, html } = reminderEmail({ kind: reminderKindFor(r), firstName: r.firstName, appUrl: appUrl() });
    messages.push({ to: r.email, subject, text, html, from: defaultFromAddress(), replyTo: SUPPORT_EMAIL });
  }

  if (messages.length > 0) {
    const sent = await sendEmailBatch(messages);
    if (!sent.ok) {
      return sent.skipped
        ? NextResponse.json({ error: 'El correo no está configurado (falta RESEND_API_KEY).' }, { status: 503 })
        : NextResponse.json({ error: 'No se pudieron enviar los correos. Intenta de nuevo.' }, { status: 502 });
    }
    summary.sent = sent.sent;
  }
  return NextResponse.json(summary);
}
