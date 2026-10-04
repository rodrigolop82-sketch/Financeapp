import { NextRequest, NextResponse } from 'next/server';
import { loadTxs, loadUsers, requireAdmin } from '@/lib/admin/server';
import { buildCtx, computeInactivos, computeResumen, parsePeriod } from '@/lib/admin/metrics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/resumen?days=7|30|90 — KPIs, embudo, movimientos por día,
 * "Cómo capturan" y los accesos a Para reactivar y Feedback. Solo admins.
 * Solo conteos: nunca se leen montos.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;
  const days = parsePeriod(req.nextUrl.searchParams.get('days'));

  const [users, txs, unread] = await Promise.all([
    loadUsers(admin),
    loadTxs(admin),
    admin.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'nuevo'),
  ]);
  const ctx = buildCtx(users, txs, Date.now());
  const inactivos = computeInactivos(ctx);

  return NextResponse.json({
    ...computeResumen(ctx, days),
    accesos: {
      reactivar: inactivos.length,
      nuncaCapturo: inactivos.filter((r) => r.txCount === 0).length,
      sinLeer: unread.error ? 0 : unread.count ?? 0,
    },
  });
}
