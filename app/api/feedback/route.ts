import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';
import { SUPPORT_EMAIL } from '@/lib/cuenta';
import {
  FEEDBACK_LIMIT_MESSAGE,
  feedbackEmailOutcome,
  feedbackEmailText,
  feedbackSubject,
  firstName,
  isOverDailyLimit,
  startOfFeedbackDay,
  validateFeedbackInput,
  validateScreenshot,
} from '@/lib/feedback';

export const dynamic = 'force-dynamic';

const BUCKET = 'feedback';
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

/**
 * POST /api/feedback (multipart/form-data): type, message, screen y,
 * opcional, screenshot (imagen ≤ 5 MB). Guarda la fila, sube la captura al
 * bucket privado y avisa por correo a hola@zafiapp.com con reply-to del
 * usuario. Límite: 5 por día por usuario.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para escribirnos.' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No pudimos leer tu mensaje.' }, { status: 400 });
  }

  const input = validateFeedbackInput({
    type: form.get('type'),
    message: form.get('message'),
    screen: form.get('screen'),
  });
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const shot = form.get('screenshot');
  const file = shot instanceof Blob && shot.size > 0 ? shot : null;
  let ext: string | null = null;
  if (file) {
    const check = validateScreenshot(file);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    ext = check.value.ext;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('[feedback] Falta SUPABASE_SERVICE_ROLE_KEY');
    return NextResponse.json({ error: 'No pudimos enviar tu mensaje. Intenta más tarde.' }, { status: 503 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Límite diario, contado en el servidor.
  const { count, error: countError } = await admin
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', startOfFeedbackDay());
  if (countError) {
    console.error('[feedback] Error al contar', countError.message);
    return NextResponse.json({ error: 'No pudimos enviar tu mensaje. Intenta más tarde.' }, { status: 500 });
  }
  if (isOverDailyLimit(count ?? 0)) {
    return NextResponse.json({ error: FEEDBACK_LIMIT_MESSAGE }, { status: 429 });
  }

  const id = crypto.randomUUID();

  // Captura: si falla la subida, el mensaje se guarda igual.
  let screenshotPath: string | null = null;
  if (file && ext) {
    const path = `${user.id}/${id}.${ext}`;
    const { error: upError } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (upError) console.warn('[feedback] No se pudo subir la captura', upError.message);
    else screenshotPath = path;
  }

  const { type, message, screen } = input.value;
  const { data: row, error: insertError } = await admin
    .from('feedback')
    .insert({ id, user_id: user.id, type, message, screen, screenshot_path: screenshotPath })
    .select('id, created_at')
    .single();
  if (insertError) {
    console.error('[feedback] Error al guardar', insertError.message);
    return NextResponse.json({ error: 'No pudimos enviar tu mensaje. Intenta más tarde.' }, { status: 500 });
  }

  const { data: profile } = await admin.from('users').select('full_name').eq('id', user.id).maybeSingle();
  const fullName = (profile?.full_name as string | null | undefined)?.trim() || null;

  let screenshotUrl: string | null = null;
  if (screenshotPath) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(screenshotPath, SIGNED_URL_SECONDS);
    screenshotUrl = signed?.signedUrl ?? null;
  }

  // El correo no bloquea: si falla o no hay llave, el mensaje ya quedó guardado.
  // El resultado se guarda en la fila para que Admin › Feedback avise si no salió.
  const emailResult = await sendEmail({
    to: SUPPORT_EMAIL,
    replyTo: user.email ?? null,
    subject: feedbackSubject(type, message),
    text: feedbackEmailText({
      type,
      message,
      screen,
      userEmail: user.email ?? null,
      userName: fullName,
      userId: user.id,
      screenshotUrl,
      createdAt: (row?.created_at as string | undefined) ?? new Date().toISOString(),
    }),
  });

  const { error: outcomeError } = await admin
    .from('feedback')
    .update(feedbackEmailOutcome(emailResult))
    .eq('id', id);
  if (outcomeError) console.warn('[feedback] No se pudo guardar el resultado del correo', outcomeError.message);

  return NextResponse.json({ ok: true, name: firstName(fullName) });
}
