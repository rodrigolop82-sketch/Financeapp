import { NextRequest, NextResponse } from 'next/server';
import { loadTxs, loadUsers, requireAdmin } from '@/lib/admin/server';
import {
  buildCtx,
  computeInactivos,
  computeUsuarios,
  matchesInactiveFilter,
  matchesUserFilter,
  parseInactiveFilter,
  parseUserFilter,
  pickForExport,
} from '@/lib/admin/metrics';
import { buildMailchimpCsv, csvFileName } from '@/lib/admin/csv';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/inactivos/csv { ids?: string[], filter?: string, scope?: 'usuarios' }
 * CSV para Mailchimp de los seleccionados o, si no hay, del filtro actual.
 * Con scope 'usuarios' sale de todos los usuarios (pestaña Usuarios); si no,
 * de Para reactivar. La lista se vuelve a calcular aquí y solo salen quienes
 * tienen users.marketing_opt_in = true. Solo admins.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; filter?: unknown; scope?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : null;

  const [users, txs] = await Promise.all([loadUsers(guard.admin), loadTxs(guard.admin)]);
  const now = new Date();
  const ctx = buildCtx(users, txs, now.getTime());
  let picked;
  let listTag;
  if (body.scope === 'usuarios') {
    const filter = parseUserFilter(body.filter);
    picked = pickForExport(computeUsuarios(ctx), ids, (r) => matchesUserFilter(r, filter));
    listTag = 'usuarios';
  } else {
    const filter = parseInactiveFilter(body.filter);
    picked = pickForExport(computeInactivos(ctx), ids, (r) => matchesInactiveFilter(r, filter));
    listTag = 'reactivar';
  }
  const { csv, exported, skipped } = buildMailchimpCsv(picked, listTag);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFileName(now, listTag)}"`,
      'Cache-Control': 'no-store',
      'X-Export-Count': String(exported),
      'X-Export-Skipped': String(skipped),
    },
  });
}
