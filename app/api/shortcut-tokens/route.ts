import { NextResponse } from 'next/server';
import { generateShortcutToken } from '@/lib/apple-pay-token';
import { PUBLIC_TOKEN_COLUMNS, requireUserForTokens } from '@/lib/apple-pay-session';

export const dynamic = 'force-dynamic';

/** Claves activas como máximo por persona. */
const MAX_ACTIVE = 5;

/** GET: claves activas de la persona (sin el hash). */
export async function GET() {
  const guard = await requireUserForTokens();
  if (!guard.ok) return guard.response;
  const { data, error } = await guard.admin
    .from('shortcut_tokens')
    .select(PUBLIC_TOKEN_COLUMNS)
    .eq('user_id', guard.userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[apple-pay] No se pudo leer shortcut_tokens', error.message);
    return NextResponse.json({ tokens: [], unavailable: true });
  }
  return NextResponse.json({ tokens: data ?? [] });
}

/** POST: crea una clave. El token solo viaja en esta respuesta. */
export async function POST() {
  const guard = await requireUserForTokens();
  if (!guard.ok) return guard.response;
  const { count } = await guard.admin
    .from('shortcut_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', guard.userId)
    .is('revoked_at', null);
  if ((count ?? 0) >= MAX_ACTIVE) {
    return NextResponse.json({ error: `Ya tienes ${MAX_ACTIVE} claves activas. Revoca una para crear otra.` }, { status: 409 });
  }
  const { token, hash } = generateShortcutToken();
  const { data, error } = await guard.admin
    .from('shortcut_tokens')
    .insert({ user_id: guard.userId, token_hash: hash })
    .select(PUBLIC_TOKEN_COLUMNS)
    .single();
  if (error || !data) {
    console.error('[apple-pay] No se pudo crear la clave', error?.message);
    return NextResponse.json({ error: 'No pudimos crear la clave. Intenta de nuevo.' }, { status: 500 });
  }
  return NextResponse.json({ token, ...data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
