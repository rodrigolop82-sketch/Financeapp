'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="min-h-screen bg-gradient-to-b from-[#F8F9FF] to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2563EB] rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-bold">Z</span>
            </div>
            <span className="text-xl font-bold text-[#1E3A5F]">
              Zafi
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
        <div className="inline-flex items-center gap-2 bg-blue-100 text-[#1E40AF] rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <PiggyBank className="w-4 h-4" />
          14 días de prueba gratis
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Ordená tu dinero.
          <br />
          <span className="text-[#2563EB]">Construí tu futuro.</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          El planner financiero que el 95% de latinoamericanos nunca pudo pagar.
          Diagnóstico honesto, plan de acción, y acompañamiento mes a mes.
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
              className="border-0 shadow-md hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-[#2563EB]" />
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
          Empezá gratis. Mejorá cuando estés listo.
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
          <Card className="border-2 border-[#3B82F6] relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2563EB] text-white text-sm px-3 py-1 rounded-full">
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
                <li>&#10003; Zafi AI — planner personal</li>
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
            <div className="w-6 h-6 bg-[#2563EB] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">Z</span>
            </div>
            <span className="font-semibold text-gray-700">Zafi</span>
          </div>
          <p>&copy; 2026 Zafi. Hecho con cariño en Guatemala.</p>
        </div>
      </footer>
    </div>
  );
}
