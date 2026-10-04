import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';
import { firstNameOf } from '@/lib/admin/metrics';
import { isFeedbackStatus, type AdminFeedbackItem } from '@/lib/admin/feedback';

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
}

/** GET /api/admin/feedback — los últimos mensajes de "Envíanos tu idea". Solo admins. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { data, error } = await admin
    .from('feedback')
    .select('id, user_id, type, message, screen, screenshot_path, status, created_at')
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) {
    console.error('[admin] Error al leer feedback', error.message);
    return NextResponse.json({ items: [], error: 'No se pudo leer el feedback.' });
  }
  const rows = (data ?? []) as FeedbackRow[];
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
    };
  });
  return NextResponse.json({ items });
}
