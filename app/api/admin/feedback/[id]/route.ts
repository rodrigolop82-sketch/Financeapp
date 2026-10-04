import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';
import { isFeedbackAction, isFeedbackStatus, nextStatus } from '@/lib/admin/feedback';

export const dynamic = 'force-dynamic';

const BUCKET = 'feedback';
const SIGNED_URL_SECONDS = 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/feedback/{id} { action: 'abrir' | 'resolver' | 'reabrir' }
 * Abrir pasa "nuevo" a "leído" y devuelve la captura con URL firmada (1 h).
 * Resolver marca "respondido"; reabrir lo regresa a "leído". Solo admins.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Mensaje no encontrado.' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (!isFeedbackAction(body.action)) return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
  const { admin } = guard;

  const { data: row, error } = await admin
    .from('feedback')
    .select('id, status, screenshot_path')
    .eq('id', params.id)
    .maybeSingle();
  if (error || !row) return NextResponse.json({ error: 'Mensaje no encontrado.' }, { status: 404 });

  const current = isFeedbackStatus(row.status) ? row.status : 'nuevo';
  const status = nextStatus(current, body.action);
  if (status !== current) {
    const { error: upError } = await admin.from('feedback').update({ status }).eq('id', params.id);
    if (upError) return NextResponse.json({ error: 'No se pudo actualizar.' }, { status: 500 });
  }

  let screenshotUrl: string | null = null;
  if (body.action === 'abrir' && row.screenshot_path) {
    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(row.screenshot_path, SIGNED_URL_SECONDS);
    if (signError) console.warn('[admin] No se pudo firmar la captura', signError.message);
    screenshotUrl = signed?.signedUrl ?? null;
  }
  return NextResponse.json({ status, screenshotUrl });
}
