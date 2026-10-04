import { NextRequest, NextResponse } from 'next/server';
import { pushConfigured, requireAdmin } from '@/lib/admin/server';
import { REMINDER_PAYLOAD, parseReminderIds, type ReminderSummary } from '@/lib/admin/access';
import { sendPushToUser, usersNotifiedToday } from '@/lib/push-send';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/recordatorio { userIds: string[] } — push de "vuelve a
 * Zafi" a los seleccionados (máx. 50 por llamada). Respeta 1 aviso al día:
 * si la persona ya recibió un aviso en las últimas 24 h (la misma regla del
 * cron, lib/push-send usersNotifiedToday), se salta. Sin llaves VAPID
 * responde 503. Solo admins.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!pushConfigured()) {
    return NextResponse.json({ error: 'Los avisos push no están configurados (faltan las llaves VAPID).' }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { userIds?: unknown };
  const parsed = parseReminderIds(body.userIds);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { admin } = guard;

  // Solo usuarios que existen.
  const { data: existing } = await admin.from('users').select('id').in('id', parsed.ids);
  const ids = (existing ?? []).map((u: { id: string }) => u.id);

  // 1 aviso por día: quién ya recibió algo en las últimas 24 h.
  const notifiedToday = await usersNotifiedToday(admin, ids);

  const summary: ReminderSummary = { sent: 0, alreadyToday: 0, noDevice: 0 };
  for (const id of ids) {
    if (notifiedToday.has(id)) {
      summary.alreadyToday++;
      continue;
    }
    const n = await sendPushToUser(id, REMINDER_PAYLOAD, 'inactivity').catch(() => 0);
    if (n > 0) summary.sent++;
    else summary.noDevice++;
  }
  return NextResponse.json(summary);
}
