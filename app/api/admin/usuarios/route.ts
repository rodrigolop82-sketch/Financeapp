import { NextResponse } from 'next/server';
import { loadTxs, loadUsers, pushConfigured, requireAdmin } from '@/lib/admin/server';
import { buildCtx, computeUsuarios } from '@/lib/admin/metrics';
import { emailConfigured } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/usuarios — todos los usuarios con estado (activo/inactivo),
 * registro, último acceso, # de movimientos (nunca montos), plan y situación.
 * Solo admins.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const [users, txs] = await Promise.all([loadUsers(guard.admin), loadTxs(guard.admin)]);
  const rows = computeUsuarios(buildCtx(users, txs, Date.now()));
  return NextResponse.json({ rows, pushEnabled: pushConfigured(), emailEnabled: emailConfigured() });
}
