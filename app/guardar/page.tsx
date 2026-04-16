'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Lock, Shield } from 'lucide-react';
import { Wordmark } from '@/components/brand/Wordmark';
import { sessionAnalisis, AnalisisData } from '@/lib/session-analisis';
import { createClient } from '@/lib/supabase';
import { Separator } from '@/components/ui/separator';

type ScoreColor = 'red' | 'orange' | 'yellow' | 'green' | 'emerald';

function getScoreColor(score: number): ScoreColor {
  if (score >= 85) return 'emerald';
  if (score >= 65) return 'green';
  if (score >= 45) return 'yellow';
  if (score >= 25) return 'orange';
  return 'red';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excelente';
  if (score >= 65) return 'Saludable';
  if (score >= 45) return 'Estable';
  if (score >= 25) return 'En riesgo';
  return 'Crítico';
}

const SCORE_DOT_COLORS: Record<ScoreColor, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
};

export default function GuardarPage() {
  const router = useRouter();
  const [analisis, setAnalisis] = useState<AnalisisData | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const d = sessionAnalisis.leer();
    // If no data, still show the form (user might have come directly)
    setAnalisis(d);
  }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (signUpError) {
      setError(
        signUpError.message === 'User already registered'
          ? 'Ya existe una cuenta con ese correo. ¿Querés iniciar sesión?'
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    if (data.session) {
      // Immediate session — migrate analysis data then go to dashboard
      try {
        await sessionAnalisis.migrarASupabase(data.session.user.id, supabase);
      } catch {
        // Migration failure is non-fatal — user can re-enter data in onboarding
      }
      router.push('/dashboard');
      router.refresh();
    } else {
      // Email confirmation required
      setEmailSent(true);
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
          <Wordmark size="sm" variant="light" />
        </header>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-electric" />
            </div>
            <h2 className="font-serif text-2xl text-navy mb-2">Revisá tu correo</h2>
            <p className="text-gray-500 mb-4">
              Enviamos un enlace de confirmación a{' '}
              <strong className="text-navy">{email}</strong>.
              Hacé clic en el enlace para activar tu cuenta.
            </p>
            <p className="text-sm text-gray-400">
              ¿No lo ves? Revisá tu carpeta de spam.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const scoreColor = analisis?.score ? getScoreColor(analisis.score) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <Wordmark size="sm" variant="light" />
        <Link href="/login" className="text-sm text-gray-500 hover:text-navy transition-colors">
          Ya tengo cuenta
        </Link>
      </header>

      <div className="flex-1 max-w-md mx-auto w-full px-6 py-8">
        {/* Score summary */}
        {analisis?.score && scoreColor && (
          <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm mb-6">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${SCORE_DOT_COLORS[scoreColor]}`} />
            <span className="text-sm text-gray-600">
              Tu score:{' '}
              <strong className="text-navy">{analisis.score}</strong>
              {' · '}
              <span className="text-gray-500">{getScoreLabel(analisis.score)}</span>
            </span>
          </div>
        )}

        {/* Title */}
        <h1 className="font-serif text-2xl text-navy mb-1">
          Guardá tu plan gratis
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          Creá tu cuenta para acceder a tu dashboard completo
        </p>

        {/* Privacy notice */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl text-sm text-blue-700 mb-5">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>No vendemos ni compartimos tu información financiera con nadie, nunca.</span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-navy hover:border-navy/40 transition-colors mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continuar con Google
        </button>

        <div className="relative my-4">
          <Separator />
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-50 px-2 text-xs text-gray-400">
            o con correo
          </span>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-navy mb-1" htmlFor="nombre">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              placeholder="Tu nombre"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="input-base w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-base w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input-base w-full"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 mt-2"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-5">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-electric font-medium hover:underline">
            Entrá aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
