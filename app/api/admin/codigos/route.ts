import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';
import { fromRow, parseNewCode, type DiscountCodeRow } from '@/lib/descuentos';

export const dynamic = 'force-dynamic';

/** GET /api/admin/codigos — todos los códigos con sus usos. Solo admins. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const [{ data: codes, error }, { data: uses }] = await Promise.all([
    admin.from('discount_codes').select('*').order('created_at', { ascending: false }),
    admin.from('discount_redemptions').select('code_id'),
  ]);
  if (error) {
    console.error('[admin] Error al leer códigos', error.message);
    return NextResponse.json({ items: [], error: 'No se pudieron leer los códigos. ¿Corriste la migración 20261106?' });
  }
  const count = new Map<string, number>();
  for (const u of (uses ?? []) as { code_id: string }[]) count.set(u.code_id, (count.get(u.code_id) ?? 0) + 1);
  const items = ((codes ?? []) as DiscountCodeRow[]).map((r) => fromRow(r, count.get(r.id) ?? 0));
  return NextResponse.json({ items });
}

/** POST /api/admin/codigos — crea un código. */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin, userId } = guard;

  const parsed = parseNewCode(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;

  const { data, error } = await admin
    .from('discount_codes')
    .insert({
      code: v.code,
      percent_off: v.percentOff,
      duration_months: v.durationMonths,
      tiers: v.tiers,
      cycles: v.cycles,
      max_redemptions: v.maxRedemptions,
      expires_at: v.expiresAt,
      note: v.note,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Ya existe el código ${v.code}` }, { status: 409 });
    console.error('[admin] Error al crear código', error.message);
    return NextResponse.json({ error: 'No se pudo crear el código.' }, { status: 500 });
  }
  return NextResponse.json({ item: fromRow(data as DiscountCodeRow, 0) });
}
