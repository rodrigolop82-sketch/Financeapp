'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wordmark } from '@/components/brand/Wordmark';
import { AppIcon } from '@/components/brand/AppIcon';
import {
  ArrowRight,
  BarChart3,
  PiggyBank,
  Shield,
  Target,
  Users,
  MessageCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-bg">
      {/* Header */}
      <header className="border-b border-navy/[0.08] bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AppIcon size="sm" variant="electric" />
            <Wordmark size="sm" />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-navy/60 hover:text-navy">Iniciar sesión</Button>
            </Link>
            <Link href="/registro">
              <button className="btn-primary">Empezar gratis</button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-4 py-20 text-center overflow-hidden">
        {/* Decorative rings */}
        <div className="absolute top-10 right-0 w-72 h-72 rounded-full border border-electric/10 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full border border-electric/[0.08] pointer-events-none" />

        <div className="badge-electric mb-6">
          <PiggyBank className="w-3.5 h-3.5" />
          14 DÍAS DE PRUEBA GRATIS
        </div>
        <h1 className="font-serif text-4xl md:text-hero text-navy mb-6 leading-tight">
          Ordená tu dinero.
          <br />
          <span className="text-electric">Construí tu futuro.</span>
        </h1>
        <p className="font-sans text-body-lg text-ink-500 max-w-2xl mx-auto mb-8">
          El planner financiero que el 95% de latinoamericanos nunca pudo pagar.
          Diagnóstico honesto, plan de acción, y acompañamiento mes a mes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/registro">
            <button className="btn-primary btn-lg text-body-lg">
              Diagnostica tus finanzas gratis
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
        <p className="font-sans text-caption text-ink-400 mt-4">
          No necesitas tarjeta de crédito para empezar
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="font-serif text-title text-center text-navy mb-12">
          Todo lo que necesitas para tomar el control
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: BarChart3,
              title: 'Diagnóstico honesto',
              description:
                'Conocé tu puntaje Zafi en minutos. Sin rodeos — te decimos exactamente dónde estás y qué hacer primero.',
            },
            {
              icon: Target,
              title: 'Plan priorizado cada mes',
              description:
                '3-5 acciones ordenadas por impacto real. Cada una con un "por qué" y números concretos de tu situación.',
            },
            {
              icon: Shield,
              title: 'Salí de deudas',
              description:
                'Estrategias bola de nieve y avalancha. Incluye deudas informales (préstamos familiares, tandas).',
            },
            {
              icon: MessageCircle,
              title: 'Zafi AI — tu planner personal',
              description:
                'Preguntale lo que quieras. Zafi ya conoce tus números y responde con consejos específicos, no genéricos.',
            },
            {
              icon: PiggyBank,
              title: 'Fondo de emergencia',
              description:
                'Construí tu colchón financiero paso a paso. Te guiamos hasta llegar a 6 meses de gastos.',
            },
            {
              icon: Users,
              title: 'Modo familia',
              description:
                'Administrá las finanzas del hogar en equipo. Ideal para parejas y familias.',
            },
          ].map((feature) => (
            <Card
              key={feature.title}
              className="border border-navy/[0.08] shadow-[0_2px_16px_rgba(30,58,95,0.06)] hover:shadow-[0_4px_24px_rgba(30,58,95,0.12)] hover:-translate-y-0.5 transition-all duration-200"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-electric-ghost rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-electric" />
                </div>
                <h3 className="font-sans text-subhead font-semibold text-navy mb-2">
                  {feature.title}
                </h3>
                <p className="font-sans text-body text-ink-500">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="font-serif text-title text-center text-navy mb-4">
          Simple y accesible
        </h2>
        <p className="text-center font-sans text-body-lg text-ink-500 mb-12">
          Empezá gratis. Mejorá cuando estés listo.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2 border-navy/[0.08]">
            <CardContent className="p-8">
              <h3 className="font-sans text-subhead font-semibold mb-2">Gratis</h3>
              <p className="font-outfit font-extrabold text-display text-navy mb-4">
                Q 0<span className="font-sans text-body-sm font-normal text-ink-400">/mes</span>
              </p>
              <ul className="space-y-2 font-sans text-body text-ink-500 mb-6">
                <li>&#10003; Diagnóstico financiero</li>
                <li>&#10003; Presupuesto básico</li>
                <li>&#10003; Hasta 3 deudas</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-2 border-electric relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-electric text-white text-caption font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              Popular
            </div>
            <CardContent className="p-8">
              <h3 className="font-sans text-subhead font-semibold mb-2">Premium</h3>
              <p className="font-outfit font-extrabold text-display text-navy mb-1">
                $4.99<span className="font-sans text-body-sm font-normal text-ink-400">/mes</span>
              </p>
              <p className="font-sans text-caption text-ink-400 mb-4">
                o $39.99/año (ahorra 33%)
              </p>
              <ul className="space-y-2 font-sans text-body text-ink-500 mb-6">
                <li>&#10003; Todo lo del plan gratis</li>
                <li>&#10003; Deudas ilimitadas</li>
                <li>&#10003; Modo familia</li>
                <li>&#10003; Zafi AI — planner personal</li>
                <li>&#10003; Historial completo</li>
                <li>&#10003; Soporte prioritario</li>
              </ul>
              <Link href="/registro">
                <button className="btn-primary w-full">Prueba 14 días gratis</button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy/[0.08] bg-surface-tint mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AppIcon size="xs" variant="electric" />
            <Wordmark size="xs" />
          </div>
          <p className="font-sans text-caption text-ink-400">&copy; 2026 Zafi. Hecho con cariño en Guatemala.</p>
        </div>
      </footer>
    </div>
  );
}
