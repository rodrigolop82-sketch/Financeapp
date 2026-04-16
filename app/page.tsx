'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckCircle, Sparkles } from 'lucide-react';
import { Wordmark } from '@/components/brand/Wordmark';
import { createClient } from '@/lib/supabase';

const SLIDES = [
  {
    icon: BarChart3,
    headline: 'El planificador financiero que el 95% nunca pudo pagar',
    subtitle: 'Ahora en tu bolsillo. Gratis.',
  },
  {
    icon: CheckCircle,
    headline: 'Tu situación financiera, analizada en 2 minutos',
    subtitle: 'Ingresos, gastos, deudas — sin juicios. Solo soluciones.',
  },
  {
    icon: Sparkles,
    headline: 'Tu plan personalizado, listo al instante',
    subtitle: 'Y si te convence, lo guardamos gratis.',
    isCta: true,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  // Redirect authenticated users to dashboard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
  }, [router]);

  function goToSlide(index: number) {
    if (animating || index === slide) return;
    setDirection(index > slide ? 'forward' : 'back');
    setAnimating(true);
    setTimeout(() => {
      setSlide(index);
      setAnimating(false);
    }, 250);
  }

  function next() {
    if (slide < SLIDES.length - 1) {
      goToSlide(slide + 1);
    }
  }

  const current = SLIDES[slide];
  const Icon = current.icon;

  const slideClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-y-3'
      : 'opacity-0 -translate-y-3'
    : 'opacity-100 translate-y-0';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1E3A5F' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <Wordmark size="sm" variant="dark" />
        <Link
          href="/login"
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Ya tengo cuenta
        </Link>
      </header>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
        <div
          className={`flex flex-col items-center text-center transition-all duration-250 ease-out ${slideClass}`}
          style={{ transitionDuration: '250ms' }}
        >
          {/* Icon */}
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8"
            style={{ backgroundColor: 'rgba(37,99,235,0.2)' }}>
            <Icon className="w-10 h-10" style={{ color: '#60A5FA' }} />
          </div>

          {/* Text */}
          <h1 className="font-serif text-3xl text-white leading-tight mb-4 max-w-xs">
            {current.headline}
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-xs">
            {current.subtitle}
          </p>

          {/* CTA on last slide */}
          {current.isCta && (
            <div className="mt-10 w-full max-w-xs">
              <Link
                href="/analisis"
                className="block w-full py-4 rounded-2xl text-white font-semibold text-base text-center transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#2563EB' }}
              >
                Comenzar mi análisis →
              </Link>
              <Link
                href="/login"
                className="block text-center text-sm text-white/50 hover:text-white/80 mt-4 transition-colors"
              >
                ¿Ya tenés cuenta? Entrar
              </Link>
            </div>
          )}
        </div>

        {/* Next button for non-last slides */}
        {!current.isCta && (
          <button
            onClick={next}
            className="mt-10 py-3.5 px-8 rounded-2xl text-white font-medium text-sm transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            Siguiente →
          </button>
        )}

        {/* Dot navigation */}
        <div className="flex gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === slide ? '24px' : '8px',
                height: '8px',
                backgroundColor: i === slide ? '#2563EB' : 'rgba(255,255,255,0.25)',
              }}
              aria-label={`Ir al slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
