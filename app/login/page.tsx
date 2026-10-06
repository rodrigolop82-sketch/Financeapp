'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { AUTH_LINK, AuthField, AuthPage, AuthTitle, GoogleButton, OrDivider } from '@/components/auth/AuthUI';
import { ErrorBox, INPUT_48 } from '@/components/layout/Pantalla';
import { PRIMARY_BUTTON, TEXT_MUTED } from '@/components/movimientos/ui';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const next = inviteCode ? `/invite/${inviteCode}` : (searchParams.get('next') ?? '/dashboard');
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <AuthPage>
      <AuthTitle title="Iniciar sesión" sub="Qué bueno verte de nuevo." />
      {error && <ErrorBox>{error}</ErrorBox>}

      <form onSubmit={handleLogin} className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-3.5">
          <AuthField id="email" label="Correo">
            <input id="email" type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={INPUT_48} />
          </AuthField>
          <AuthField id="password" label="Contraseña">
            <input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className={INPUT_48} />
          </AuthField>
        </div>
        <button type="submit" disabled={loading} className={PRIMARY_BUTTON}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
      </form>

      <OrDivider>o continúa con</OrDivider>
      <GoogleButton onClick={handleGoogleLogin} />

      <p className={`text-center text-sm ${TEXT_MUTED}`}>
        ¿No tienes cuenta?{' '}
        <Link href={inviteCode ? `/registro?invite=${inviteCode}` : '/registro'} className={AUTH_LINK}>Regístrate gratis</Link>
      </p>
    </AuthPage>
  );
}
