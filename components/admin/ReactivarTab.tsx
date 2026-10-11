'use client';

import { INACTIVE_FILTERS, matchesInactiveFilter, type InactiveFilter, type UserRow } from '@/lib/admin/metrics';
import { UserListTab } from './UserListTab';

const matches = (r: UserRow, f: InactiveFilter) => matchesInactiveFilter(r, f);

export function ReactivarTab({ toast }: { toast: (text: string, tone?: 'ok' | 'error') => void }) {
  return (
    <UserListTab
      title="Para reactivar"
      subtitle="Usuarios sin actividad reciente. Solo se ve el conteo de movimientos, nunca montos."
      tableLabel="Usuarios para reactivar"
      emptyText="Nadie por reactivar en este filtro 🎉"
      endpoint="/api/admin/inactivos"
      filters={INACTIVE_FILTERS}
      matches={matches}
      toast={toast}
    />
  );
}
