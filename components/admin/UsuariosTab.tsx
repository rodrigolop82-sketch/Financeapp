'use client';

import { USER_FILTERS, matchesUserFilter, type UserFilter, type UserRow } from '@/lib/admin/metrics';
import { UserListTab } from './UserListTab';

const matches = (r: UserRow, f: UserFilter) => matchesUserFilter(r, f);

export function UsuariosTab({ toast }: { toast: (text: string, tone?: 'ok' | 'error') => void }) {
  return (
    <UserListTab
      title="Usuarios"
      subtitle="Todos los usuarios. Inactivo: 7 días o más sin entrar, o nunca capturó tras su primera semana."
      tableLabel="Todos los usuarios"
      emptyText="No hay usuarios en este filtro"
      endpoint="/api/admin/usuarios"
      csvScope="usuarios"
      filters={USER_FILTERS}
      matches={matches}
      searchable
      toast={toast}
    />
  );
}
