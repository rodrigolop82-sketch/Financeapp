import { NextRequest, NextResponse } from 'next/server';
import { pushConfigured, requireAdmin } from '@/lib/admin/server';
import { REMINDER_PAYLOAD, parseReminderIds, type ReminderSummary } from '@/lib/admin/access';
import { sendPushToUser } from '@/lib/push-send';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

/**
 * POST /api/admin/recordatorio { userIds: string[] } — push de "vuelve a
 * Zafi" a los seleccionados (máx. 50 por llamada). Respeta 1 aviso al día:
 * si la persona ya recibió cualquier aviso en las últimas 24 h, se salta.
 * Sin llaves VAPID responde 503. Solo admins. (La fase 13 rehará el envío.)
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
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { data: recent, error: logError } = await admin
    .from('notification_log')
    .select('user_id')
    .in('user_id', ids)
    .gte('sent_at', since);
  if (logError) console.warn('[admin] No se pudo leer notification_log', logError.message);
  const notifiedToday = new Set((recent ?? []).map((r: { user_id: string }) => r.user_id));

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
