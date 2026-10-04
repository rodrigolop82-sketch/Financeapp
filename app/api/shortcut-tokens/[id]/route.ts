import { NextRequest, NextResponse } from 'next/server';
import { PUBLIC_TOKEN_COLUMNS, requireUserForTokens } from '@/lib/apple-pay-session';

export const dynamic = 'force-dynamic';

/** "Deshacer" una revocación: solo dentro de este margen. */
const RESTORE_WINDOW_MS = 60_000;

/** DELETE: revoca la clave (deja de funcionar al instante: 401 en el atajo). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireUserForTokens();
  if (!guard.ok) return guard.response;
  const { data, error } = await guard.admin
    .from('shortcut_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', guard.userId)
    .is('revoked_at', null)
    .select(PUBLIC_TOKEN_COLUMNS);
  if (error) return NextResponse.json({ error: 'No pudimos revocar la clave.' }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Clave no encontrada.' }, { status: 404 });
  return NextResponse.json({ ok: true, token: data[0] });
}

/** PATCH { restore: true }: "Deshacer" de la revocación (solo el primer minuto). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireUserForTokens();
  if (!guard.ok) return guard.response;
  const body = (await req.json().catch(() => ({}))) as { restore?: unknown };
  if (body.restore !== true) return NextResponse.json({ error: 'Nada que cambiar.' }, { status: 400 });
  const since = new Date(Date.now() - RESTORE_WINDOW_MS).toISOString();
  const { data, error } = await guard.admin
    .from('shortcut_tokens')
    .update({ revoked_at: null })
    .eq('id', params.id)
    .eq('user_id', guard.userId)
    .gte('revoked_at', since)
    .select(PUBLIC_TOKEN_COLUMNS);
  if (error) return NextResponse.json({ error: 'No pudimos restaurar la clave.' }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: 'Ya no se puede deshacer.' }, { status: 409 });
  return NextResponse.json({ ok: true, token: data[0] });
}
