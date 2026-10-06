'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { AUTH_LINK, AuthField, AuthPage, AuthTitle, GoogleButton, OrDivider } from '@/components/auth/AuthUI';
import { ErrorBox, INPUT_48 } from '@/components/layout/Pantalla';
import { PRIMARY_BUTTON, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroForm />
    </Suspense>
  );
}

function RegistroForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const callbackNext = inviteCode ? `/invite/${inviteCode}` : '/onboarding';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // marketing_opt_in pasa a users.marketing_opt_in con un trigger (migración 20261011).
        data: { full_name: fullName, marketing_opt_in: marketingOptIn },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${callbackNext}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If Supabase has email confirmation disabled, user is logged in immediately
    if (data.session) {
      router.push(callbackNext);
      router.refresh();
    } else {
      setEmailSent(true);
    }
    setLoading(false);
  }

  async function handleGoogleSignUp() {
    const callbackNext = inviteCode ? `/invite/${inviteCode}` : '/onboarding';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${callbackNext}`,
      },
    });
    if (error) setError(error.message);
  }

  if (emailSent) {
    return (
      <AuthPage center>
        <span aria-hidden className="mt-4 flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-electric-ghost text-4xl dark:bg-[#1B2B4D]">📬</span>
        <AuthTitle
          title="Revisa tu correo"
          sub={<>Enviamos un enlace de confirmación a <b className={TEXT_STRONG}>{email}</b>. Tócalo para activar tu cuenta.</>}
        />
        <p className={`text-sm ${TEXT_MUTED}`}>¿No lo ves? Revisa tu carpeta de spam.</p>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthTitle title="Crea tu cuenta" sub="Gratis. Tu dinero en orden en 5 minutos." />
      {error && <ErrorBox>{error}</ErrorBox>}

      <form onSubmit={handleRegister} className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-3.5">
          <AuthField id="name" label="Tu nombre">
            <input id="name" autoComplete="name" placeholder="Ana Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={INPUT_48} />
          </AuthField>
          <AuthField id="email" label="Correo">
            <input id="email" type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={INPUT_48} />
          </AuthField>
          <AuthField id="password" label="Contraseña">
            <input id="password" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className={INPUT_48} />
          </AuthField>
          <label htmlFor="marketing" className={`flex min-h-[44px] cursor-pointer items-start gap-3 text-sm ${TEXT_MUTED}`}>
            <input
              id="marketing"
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-5 w-5 flex-none cursor-pointer rounded accent-electric"
            />
            <span>Recibir consejos y novedades por correo</span>
          </label>
        </div>
        <button type="submit" disabled={loading} className={PRIMARY_BUTTON}>{loading ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>

      <OrDivider>o continúa con</OrDivider>
      <GoogleButton onClick={handleGoogleSignUp} />

      <p className={`text-center text-sm ${TEXT_MUTED}`}>
        ¿Ya tienes cuenta?{' '}
        <Link href={inviteCode ? `/login?invite=${inviteCode}` : '/login'} className={AUTH_LINK}>Inicia sesión</Link>
      </p>
      <p className={`-mt-2.5 text-center text-[12.5px] ${TEXT_FAINT}`}>
        Al crear tu cuenta aceptas los <Link href="/terminos" className="underline">Términos</Link> y la{' '}
        <Link href="/privacidad" className="underline">Política de privacidad</Link>.
      </p>
    </AuthPage>
  );
}
