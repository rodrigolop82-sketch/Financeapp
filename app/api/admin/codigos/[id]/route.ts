import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/codigos/:id { active } — activa o pausa un código. No
 * se borran: los planes ya dados con el código siguen igual.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => null)) as { active?: unknown } | null;
  if (typeof body?.active !== 'boolean') return NextResponse.json({ error: 'Falta active' }, { status: 400 });

  const { data, error } = await guard.admin
    .from('discount_codes')
    .update({ active: body.active })
    .eq('id', params.id)
    .select('id, active');
  if (error) {
    console.error('[admin] Error al cambiar código', error.message);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: 'No existe ese código' }, { status: 404 });
  return NextResponse.json({ ok: true, active: body.active });
}
