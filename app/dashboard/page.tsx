'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BudgetChart } from '@/components/charts/budget-chart';
import { ScoreHistoryChart } from '@/components/charts/score-history-chart';
import { formatCurrency } from '@/types';
import {
  TrendingUp,
  Wallet,
  CreditCard,
  PiggyBank,
  Target,
  ArrowRight,
  CheckCircle2,
  Circle,
  BarChart3,
  Clock,
  Settings,
  Menu,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Test data
const MOCK_DATA = {
  userName: 'Carlos',
  householdName: 'Casa García',
  healthScore: 52,
  scoreLabel: 'estable' as const,
  scoreColor: 'yellow' as const,
  income: 12000,
  totalExpenses: 8400,
  totalDebts: 25000,
  totalSavings: 5000,
  budgetNeeds: 6000,
  budgetWants: 3600,
  budgetSavings: 2400,
  spentNeeds: 5800,
  spentWants: 4100,
  spentSavings: 500,
  debts: [
    { name: 'Tarjeta Visa', balance: 15000, minPayment: 750, progress: 25 },
    { name: 'Préstamo auto', balance: 8000, minPayment: 1200, progress: 60 },
    { name: 'Préstamo tío Juan', balance: 2000, minPayment: 500, progress: 80 },
  ],
  actionPlan: [
    { id: '1', title: 'Registra todos tus gastos esta semana', completed: true },
    { id: '2', title: 'Paga el mínimo de todas tus deudas', completed: true },
    { id: '3', title: 'Separa Q 500 para fondo de emergencia', completed: false },
    { id: '4', title: 'Revisa tus suscripciones y cancela las innecesarias', completed: false },
    { id: '5', title: 'Completa tu presupuesto 50/30/20', completed: false },
  ],
  scoreHistory: [
    { month: 'Oct', score: 35 },
    { month: 'Nov', score: 40 },
    { month: 'Dic', score: 44 },
    { month: 'Ene', score: 48 },
    { month: 'Feb', score: 50 },
    { month: 'Mar', score: 52 },
  ],
};

const scoreColorMap = {
  red: { text: 'text-red-500', bg: 'bg-red-100' },
  orange: { text: 'text-orange-500', bg: 'bg-orange-100' },
  yellow: { text: 'text-yellow-500', bg: 'bg-yellow-100' },
  green: { text: 'text-green-500', bg: 'bg-green-100' },
  emerald: { text: 'text-emerald-500', bg: 'bg-emerald-100' },
};

const NAV_ITEMS = [
  { href: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { href: '/presupuesto', icon: Wallet, label: 'Presupuesto' },
  { href: '/deudas', icon: CreditCard, label: 'Deudas' },
  { href: '/plan', icon: Target, label: 'Plan' },
  { href: '/historial', icon: Clock, label: 'Historial' },
  { href: '/cuenta', icon: Settings, label: 'Cuenta' },
];

export default function DashboardPage() {
  const d = MOCK_DATA;
  const colors = scoreColorMap[d.scoreColor];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const completedSteps = d.actionPlan.filter((s) => s.completed).length;
  const planProgress = (completedSteps / d.actionPlan.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 bg-white border-b z-40 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-emerald-900">FinanzasClaras</span>
        </div>
        <div className="w-6" />
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r z-50 transform transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-emerald-900">FinanzasClaras</span>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    item.href === '/dashboard'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="absolute bottom-0 w-full p-4 border-t">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-emerald-700">
                  {d.userName[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.userName}</p>
                <p className="text-xs text-gray-500 truncate">{d.householdName}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8 max-w-6xl">
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Hola, {d.userName}
            </h1>
            <p className="text-gray-500">
              Aquí tienes el resumen de {d.householdName} para este mes.
            </p>
          </div>

          {/* Top cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Health score */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Salud financiera</p>
                  <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                    <span className={`text-lg font-bold ${colors.text}`}>{d.healthScore}</span>
                  </div>
                </div>
                <p className={`text-sm font-semibold capitalize ${colors.text}`}>{d.scoreLabel}</p>
                <Progress value={d.healthScore} className="h-1.5 mt-2" />
              </CardContent>
            </Card>

            {/* Income */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Ingreso del mes</p>
                  <Wallet className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(d.income)}</p>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Gastos del mes</p>
                  <CreditCard className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(d.totalExpenses)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round((d.totalExpenses / d.income) * 100)}% de tu ingreso
                </p>
              </CardContent>
            </Card>

            {/* Savings */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Ahorros</p>
                  <PiggyBank className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(d.totalSavings)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Presupuesto 50/30/20</CardTitle>
                  <Link href="/presupuesto">
                    <Button variant="ghost" size="sm">
                      Ver detalle <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <BudgetChart
                  needs={d.budgetNeeds}
                  wants={d.budgetWants}
                  savings={d.budgetSavings}
                />
                <div className="space-y-3 mt-4">
                  {[
                    {
                      label: 'Necesidades',
                      budgeted: d.budgetNeeds,
                      spent: d.spentNeeds,
                      color: 'bg-emerald-700',
                    },
                    {
                      label: 'Gustos',
                      budgeted: d.budgetWants,
                      spent: d.spentWants,
                      color: 'bg-emerald-500',
                    },
                    {
                      label: 'Ahorro/Deudas',
                      budgeted: d.budgetSavings,
                      spent: d.spentSavings,
                      color: 'bg-emerald-300',
                    },
                  ].map((b) => (
                    <div key={b.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{b.label}</span>
                        <span className={b.spent > b.budgeted ? 'text-red-500 font-medium' : 'text-gray-900'}>
                          {formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            b.spent > b.budgeted ? 'bg-red-400' : b.color
                          }`}
                          style={{ width: `${Math.min((b.spent / b.budgeted) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action plan */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Plan de acción</CardTitle>
                    <CardDescription>
                      {completedSteps} de {d.actionPlan.length} pasos completados
                    </CardDescription>
                  </div>
                  <Link href="/plan">
                    <Button variant="ghost" size="sm">
                      Ver todo <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
                <Progress value={planProgress} className="h-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {d.actionPlan.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        item.completed ? 'bg-emerald-50' : 'bg-gray-50'
                      }`}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${
                          item.completed ? 'text-emerald-700 line-through' : 'text-gray-700'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Debts overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Deudas</CardTitle>
                    <CardDescription>
                      Total: {formatCurrency(d.totalDebts)}
                    </CardDescription>
                  </div>
                  <Link href="/deudas">
                    <Button variant="ghost" size="sm">
                      Ver detalle <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {d.debts.map((debt) => (
                    <div key={debt.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{debt.name}</span>
                        <span className="text-gray-600">
                          {formatCurrency(debt.balance)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${debt.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Pago mínimo: {formatCurrency(debt.minPayment)}/mes
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Score history */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Progreso</CardTitle>
                  <Link href="/historial">
                    <Button variant="ghost" size="sm">
                      Ver historial <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <ScoreHistoryChart data={d.scoreHistory} />
                <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
                  <p className="text-sm text-emerald-800">
                    Tu puntaje subió <strong>+17 puntos</strong> en los últimos 6 meses.
                    ¡Sigue así!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
