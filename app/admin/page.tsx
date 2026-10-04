import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin/access';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zafi · Admin' };

/**
 * Admin (fase 12). Se verifica en el servidor antes de pintar nada: sin
 * sesión → /login; sin ser admin → aviso sin datos. Cada ruta /api/admin/*
 * vuelve a verificar por su cuenta.
 */
export default async function AdminPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (!isAdminEmail(user.email)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--zafi-bg)' }}>
        <div className="flex max-w-md flex-col items-center gap-3 rounded-[18px] bg-[var(--zafi-card)] p-8 text-center">
          <ShieldCheck className="h-12 w-12 text-danger" aria-hidden />
          <p className="font-semibold text-ink-900 dark:text-ink-100">No tienes acceso al panel de admin.</p>
          <Link
            href="/dashboard"
            className="mt-1 flex h-11 items-center rounded-full border border-ink-200 px-5 text-sm font-semibold text-ink-900 dark:border-[var(--zafi-border)] dark:text-ink-100"
          >
            Volver a Inicio
          </Link>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}
