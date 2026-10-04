import { NextResponse } from 'next/server';
import { loadTxs, loadUsers, requireAdmin } from '@/lib/admin/server';
import { buildCtx, computeRetencion } from '@/lib/admin/metrics';

export const dynamic = 'force-dynamic';

/** GET /api/admin/retencion — cohortes semanales, S1, S4 y "Lo que más retiene". Solo admins. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const [users, txs] = await Promise.all([loadUsers(guard.admin), loadTxs(guard.admin)]);
  return NextResponse.json(computeRetencion(buildCtx(users, txs, Date.now())));
}
