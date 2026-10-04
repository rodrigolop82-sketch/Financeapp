import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';
import { firstNameOf } from '@/lib/admin/metrics';
import { replyEmail, validateReply } from '@/lib/admin/feedback';
import { defaultFromAddress, sendEmail } from '@/lib/email';
import { SUPPORT_EMAIL } from '@/lib/cuenta';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/feedback/{id}/responder { message }
 * Responde por correo desde hola@zafiapp.com (Resend; reply-to también
 * hola@zafiapp.com) al correo del usuario y marca el mensaje "respondido".
 * Si el correo no sale (falta RESEND_API_KEY o Resend falla) no cambia el
 * estado. Solo admins.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Mensaje no encontrado.' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { message?: unknown };
  const reply = validateReply(body.message);
  if (!reply.ok) return NextResponse.json({ error: reply.error }, { status: 400 });
  const { admin } = guard;

  const { data: row } = await admin
    .from('feedback')
    .select('id, user_id, type, message, created_at')
    .eq('id', params.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Mensaje no encontrado.' }, { status: 404 });

  const { data: person } = row.user_id
    ? await admin.from('users').select('email, full_name').eq('id', row.user_id).maybeSingle()
    : { data: null };
  const to = (person as { email?: string | null } | null)?.email;
  if (!to) return NextResponse.json({ error: 'Este mensaje ya no tiene un correo al cual responder.' }, { status: 409 });

  const { subject, text } = replyEmail({
    reply: reply.value,
    firstName: firstNameOf((person as { full_name?: string | null }).full_name),
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
  });
  const sent = await sendEmail({ to, subject, text, from: defaultFromAddress(), replyTo: SUPPORT_EMAIL });
  if (!sent.ok) {
    return sent.skipped
      ? NextResponse.json({ error: 'El correo no está configurado (falta RESEND_API_KEY). No se envió.' }, { status: 503 })
      : NextResponse.json({ error: 'No se pudo enviar el correo. Intenta de nuevo.' }, { status: 502 });
  }

  const { error } = await admin.from('feedback').update({ status: 'respondido' }).eq('id', params.id);
  if (error) console.error('[admin] Correo enviado pero no se marcó respondido', error.message);
  return NextResponse.json({ status: 'respondido', to, id: sent.id });
}
