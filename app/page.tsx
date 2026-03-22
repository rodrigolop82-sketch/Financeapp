'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight,
  BarChart3,
  PiggyBank,
  Shield,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-emerald-900">
              FinanzasClaras
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Iniciar sesión</Button>
            </Link>
            <Link href="/registro">
              <Button>Empezar gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <PiggyBank className="w-4 h-4" />
          14 días de prueba gratis
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Ordena tus finanzas
          <br />
          <span className="text-emerald-600">con claridad</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Crea tu presupuesto, sal de deudas y construye el hábito de revisión
          mensual. Diseñada para Guatemala y Latinoamérica.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/registro">
            <Button size="lg" className="text-lg px-8">
              Diagnostica tus finanzas gratis
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          No necesitas tarjeta de crédito para empezar
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Todo lo que necesitas para tomar el control
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: BarChart3,
              title: 'Diagnóstico financiero',
              description:
                'Conoce tu puntaje de salud financiera en minutos. Identifica dónde estás y hacia dónde ir.',
            },
            {
              icon: Target,
              title: 'Presupuesto 50/30/20',
              description:
                'Organiza tus gastos en necesidades, gustos y ahorro. Categorías adaptadas a tu realidad.',
            },
            {
              icon: Shield,
              title: 'Plan para salir de deudas',
              description:
                'Estrategias bola de nieve y avalancha. Incluye deudas informales (préstamos familiares, tandas).',
            },
            {
              icon: TrendingUp,
              title: 'Plan de acción mensual',
              description:
                'Cada mes recibe pasos claros y alcanzables para mejorar tu situación financiera.',
            },
            {
              icon: PiggyBank,
              title: 'Fondo de emergencia',
              description:
                'Construye tu colchón financiero paso a paso. Te guiamos hasta llegar a 6 meses de gastos.',
            },
            {
              icon: Users,
              title: 'Modo familia',
              description:
                'Administra las finanzas del hogar en equipo. Ideal para parejas y familias.',
            },
          ].map((feature) => (
            <Card
              key={feature.title}
              className="border-0 shadow-md hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
          Simple y accesible
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Empieza gratis. Mejora cuando estés listo.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2">
            <CardContent className="p-8">
              <h3 className="text-lg font-semibold mb-2">Gratis</h3>
              <p className="text-3xl font-bold mb-4">
                Q 0<span className="text-sm font-normal text-gray-500">/mes</span>
              </p>
              <ul className="space-y-2 text-gray-600 mb-6">
                <li>&#10003; Diagnóstico financiero</li>
                <li>&#10003; Presupuesto básico</li>
                <li>&#10003; Hasta 3 deudas</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-2 border-emerald-500 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm px-3 py-1 rounded-full">
              Popular
            </div>
            <CardContent className="p-8">
              <h3 className="text-lg font-semibold mb-2">Premium</h3>
              <p className="text-3xl font-bold mb-1">
                $4.99<span className="text-sm font-normal text-gray-500">/mes</span>
              </p>
              <p className="text-sm text-gray-500 mb-4">
                o $39.99/año (ahorra 33%)
              </p>
              <ul className="space-y-2 text-gray-600 mb-6">
                <li>&#10003; Todo lo del plan gratis</li>
                <li>&#10003; Deudas ilimitadas</li>
                <li>&#10003; Modo familia</li>
                <li>&#10003; Plan de acción con IA</li>
                <li>&#10003; Historial completo</li>
                <li>&#10003; Soporte prioritario</li>
              </ul>
              <Link href="/registro">
                <Button className="w-full">Prueba 14 días gratis</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-500 text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-700">FinanzasClaras</span>
          </div>
          <p>&copy; 2026 FinanzasClaras. Hecho con cariño en Guatemala.</p>
        </div>
      </footer>
    </div>
  );
}
