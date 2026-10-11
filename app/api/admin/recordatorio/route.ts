import { NextRequest, NextResponse } from 'next/server';
import { pushConfigured, requireAdmin } from '@/lib/admin/server';
import { REMINDER_PAYLOAD, parseReminderIds, type ReminderSummary } from '@/lib/admin/access';
import { sendPushToUserDetailed, usersNotifiedToday } from '@/lib/push-send';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/recordatorio { userIds: string[] } — push de "vuelve a
 * Zafi" a los seleccionados (máx. 50 por llamada). Respeta 1 aviso al día:
 * si la persona ya recibió un aviso en las últimas 24 h (la misma regla del
 * cron, lib/push-send usersNotifiedToday), se salta; el admin que se lo envía
 * a sí mismo para probar no tiene ese límite. Sin llaves VAPID responde 503.
 * Solo admins.
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
  notifiedToday.delete(guard.userId);

  const summary: ReminderSummary = { sent: 0, alreadyToday: 0, noDevice: 0, failed: 0, errorCodes: [] };
  const codes = new Set<number>();
  for (const id of ids) {
    if (notifiedToday.has(id)) {
      summary.alreadyToday++;
      continue;
    }
    const r = await sendPushToUserDetailed(id, REMINDER_PAYLOAD, 'inactivity').catch((e) => {
      console.error('[admin] Error al enviar recordatorio push', e);
      return { sent: 0, devices: 1, errors: [0] };
    });
    // Los 404/410 son suscripciones vencidas (ya borradas): cuentan como sin avisos.
    const realErrors = r.errors.filter((c) => c !== 404 && c !== 410);
    if (r.sent > 0) summary.sent++;
    else if (realErrors.length > 0) {
      summary.failed!++;
      realErrors.forEach((c) => codes.add(c));
    } else summary.noDevice++;
  }
  summary.errorCodes = Array.from(codes).sort((a, b) => a - b);
  return NextResponse.json(summary);
}
