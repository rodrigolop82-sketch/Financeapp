import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';
import { firstNameOf } from '@/lib/admin/metrics';
import { isFeedbackStatus, type AdminFeedbackItem } from '@/lib/admin/feedback';
import { isFeedbackEmailStatus } from '@/lib/feedback';

export const dynamic = 'force-dynamic';

const LIMIT = 300;

interface FeedbackRow {
  id: string;
  user_id: string | null;
  type: string;
  message: string;
  screen: string | null;
  screenshot_path: string | null;
  status: string;
  created_at: string;
  email_status?: string | null;
  email_error?: string | null;
}

/** GET /api/admin/feedback — los últimos mensajes de "Envíanos tu idea". Solo admins. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const BASE_COLUMNS = 'id, user_id, type, message, screen, screenshot_path, status, created_at';
  const first = await admin
    .from('feedback')
    .select(`${BASE_COLUMNS}, email_status, email_error`)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  let rows = (first.data ?? []) as FeedbackRow[];
  let error = first.error;
  if (error) {
    // Si la migración 20261014 aún no se aplicó, las columnas nuevas no existen:
    // se lee sin ellas para que el panel siga funcionando (sin aviso de correo).
    console.warn('[admin] Leyendo feedback sin email_status', error.message);
    const fallback = await admin
      .from('feedback')
      .select(BASE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    rows = (fallback.data ?? []) as FeedbackRow[];
    error = fallback.error;
  }
  if (error) {
    console.error('[admin] Error al leer feedback', error.message);
    return NextResponse.json({ items: [], error: 'No se pudo leer el feedback.' });
  }
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x)));
  const people = new Map<string, { email: string | null; full_name: string | null }>();
  if (userIds.length) {
    const { data: us } = await admin.from('users').select('id, email, full_name').in('id', userIds);
    for (const u of (us ?? []) as { id: string; email: string | null; full_name: string | null }[]) people.set(u.id, u);
  }

  const items: AdminFeedbackItem[] = rows.map((r) => {
    const p = r.user_id ? people.get(r.user_id) : undefined;
    return {
      id: r.id,
      type: r.type,
      message: r.message,
      screen: r.screen,
      status: isFeedbackStatus(r.status) ? r.status : 'nuevo',
      createdAt: r.created_at,
      email: p?.email ?? null,
      firstName: firstNameOf(p?.full_name),
      hasScreenshot: !!r.screenshot_path,
      emailStatus: isFeedbackEmailStatus(r.email_status) ? r.email_status : null,
      emailError: r.email_error ?? null,
    };
  });
  return NextResponse.json({ items });
}
