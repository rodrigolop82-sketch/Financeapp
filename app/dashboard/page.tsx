'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BudgetChart } from '@/components/charts/budget-chart';
import { ScoreHistoryChart } from '@/components/charts/score-history-chart';
import { CapsuleRecommendations } from '@/components/education/CapsuleRecommendations';
import { createClient } from '@/lib/supabase';
import { getUserDashboardData } from '@/lib/queries';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { getRecommendedCapsules } from '@/lib/capsule-recommendations';
import type { CapsuleRecommendation } from '@/types';
import {
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
  LogOut,
  Loader2,
  Receipt,
  Users,
  MessageCircle,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ActionStep } from '@/types';

function getScoreColor(score: number) {
  if (score >= 85) return { text: 'text-emerald-500', bg: 'bg-emerald-100' };
  if (score >= 65) return { text: 'text-green-500', bg: 'bg-green-100' };
  if (score >= 45) return { text: 'text-yellow-500', bg: 'bg-yellow-100' };
  if (score >= 25) return { text: 'text-orange-500', bg: 'bg-orange-100' };
  return { text: 'text-red-500', bg: 'bg-red-100' };
}

function getScoreLabel(score: number) {
  if (score >= 85) return 'excelente';
  if (score >= 65) return 'saludable';
  if (score >= 45) return 'estable';
  if (score >= 25) return 'en riesgo';
  return 'crítico';
}

const NAV_ITEMS = [
  { href: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { href: '/presupuesto', icon: Wallet, label: 'Presupuesto' },
  { href: '/deudas', icon: CreditCard, label: 'Deudas' },
  { href: '/plan', icon: Target, label: 'Plan' },
  { href: '/transacciones', icon: Receipt, label: 'Transacciones' },
  { href: '/chat', icon: MessageCircle, label: 'Zafi AI' },
  { href: '/aprende', icon: BookOpen, label: 'Aprende' },
  { href: '/historial', icon: Clock, label: 'Historial' },
  { href: '/familia', icon: Users, label: 'Familia' },
  { href: '/cuenta', icon: Settings, label: 'Cuenta' },
];

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof getUserDashboardData>> | null>(null);
  const [capsuleRecs, setCapsuleRecs] = useState<CapsuleRecommendation[]>([]);
  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

  useEffect(() => {
    async function loadData() {
      const result = await getUserDashboardData(supabase);
      if (!result) {
        router.push('/login');
        return;
      }
      if (!result.household) {
        router.push('/onboarding');
        return;
      }
      setData(result);
      setLoading(false);

      // Load capsule recommendations based on score
      if (result.financialProfile && result.user) {
        const { calculateHealthScore } = await import('@/lib/scoring');
        const score = calculateHealthScore({
          total_income: Number(result.financialProfile.total_income),
          total_fixed_expenses: Number(result.financialProfile.total_fixed_expenses),
          total_debt: Number(result.financialProfile.total_debt),
          total_savings: Number(result.financialProfile.total_savings),
          has_emergency_fund: result.financialProfile.has_emergency_fund,
          income_type: result.financialProfile.income_type,
        });
        const recs = await getRecommendedCapsules(result.user.id, score);
        setCapsuleRecs(recs);
      }
    }
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading || !data || !data.household || !data.budgetByBucket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
      </div>
    );
  }

  const fp = data.financialProfile;
  const healthScore = fp?.health_score ?? 0;
  const income = fp ? Number(fp.total_income) : 0;
  const totalExpenses = (data.transactions || []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
  const totalDebtBalance = (data.debts || []).reduce((s: number, d: { balance: number }) => s + Number(d.balance), 0);
  const savings = fp ? Number(fp.total_savings) : 0;
  const savingsCash = fp ? Number(fp.savings_cash ?? 0) : 0;
  const savingsInvestments = fp ? Number(fp.savings_investments ?? 0) : 0;
  const colors = getScoreColor(healthScore);
  const scoreLabel = getScoreLabel(healthScore);

  const userName = data.user?.full_name?.split(' ')[0] || 'Usuario';
  const householdName = data.household.name;

  // Action plan steps
  const planSteps: (ActionStep & { completed: boolean })[] =
    data.actionPlan?.steps
      ? (data.actionPlan.steps as ActionStep[]).map((s) => ({
          ...s,
          completed: data.actionPlan?.completed_steps
            ? (data.actionPlan.completed_steps as ActionStep[]).some((c) => c.id === s.id)
            : false,
        }))
      : [];
  const completedSteps = planSteps.filter((s) => s.completed).length;
  const planProgress = planSteps.length > 0 ? (completedSteps / planSteps.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 bg-white border-b z-40 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#2563EB] rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">Z</span>
          </div>
          <span className="font-semibold text-[#1E3A5F]">Zafi</span>
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
              <div className="w-8 h-8 bg-[#2563EB] rounded-xl flex items-center justify-center">
                <span className="text-white text-sm font-bold">Z</span>
              </div>
              <span className="text-lg font-bold text-[#1E3A5F]">Zafi</span>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    item.href === '/dashboard'
                      ? 'bg-[#F8F9FF] text-[#1D4ED8]'
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
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-[#1D4ED8]">
                  {userName[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{householdName}</p>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600">
                <LogOut className="w-4 h-4" />
              </button>
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
              Hola, {userName}
            </h1>
            <p className="text-gray-500">
              Aquí tienes el resumen de {householdName} para este mes.
            </p>
          </div>

          {/* Top cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Puntaje Zafi</p>
                  <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                    <span className={`text-lg font-bold ${colors.text}`}>{healthScore}</span>
                  </div>
                </div>
                <p className={`text-sm font-semibold capitalize ${colors.text}`}>{scoreLabel}</p>
                <Progress value={healthScore} className="h-1.5 mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Ingreso del mes</p>
                  <Wallet className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <p className="text-2xl font-bold">{fmt(income)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Gastos del mes</p>
                  <CreditCard className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-2xl font-bold">{fmt(totalExpenses)}</p>
                {income > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((totalExpenses / income) * 100)}% de tu ingreso
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Ahorros</p>
                  <PiggyBank className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{fmt(savings)}</p>
                {(savingsCash > 0 || savingsInvestments > 0) && (
                  <div className="mt-2 space-y-1">
                    {savingsCash > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Efectivo</span>
                        <span>{fmt(savingsCash)}</span>
                      </div>
                    )}
                    {savingsInvestments > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Inversiones</span>
                        <span>{fmt(savingsInvestments)}</span>
                      </div>
                    )}
                  </div>
                )}
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
                  needs={data.budgetByBucket.needs}
                  wants={data.budgetByBucket.wants}
                  savings={data.budgetByBucket.savings}
                />
                <div className="space-y-3 mt-4">
                  {[
                    { label: 'Necesidades', budgeted: data.budgetByBucket.needs, spent: data.spentByBucket.needs, color: 'bg-[#1E3A5F]' },
                    { label: 'Gustos', budgeted: data.budgetByBucket.wants, spent: data.spentByBucket.wants, color: 'bg-[#3B82F6]' },
                    { label: 'Ahorro/Deudas', budgeted: data.budgetByBucket.savings, spent: data.spentByBucket.savings, color: 'bg-[#93C5FD]' },
                  ].map((b) => (
                    <div key={b.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{b.label}</span>
                        <span className={b.budgeted > 0 && b.spent > b.budgeted ? 'text-red-500 font-medium' : 'text-gray-900'}>
                          {fmt(b.spent)} / {fmt(b.budgeted)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${b.budgeted > 0 && b.spent > b.budgeted ? 'bg-red-400' : b.color}`}
                          style={{ width: `${b.budgeted > 0 ? Math.min((b.spent / b.budgeted) * 100, 100) : 0}%` }}
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
                      {completedSteps} de {planSteps.length} pasos completados
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
                  {planSteps.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        item.completed ? 'bg-[#F8F9FF]' : 'bg-gray-50'
                      }`}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${
                          item.completed ? 'text-[#1D4ED8] line-through' : 'text-gray-700'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                  ))}
                  {planSteps.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No hay plan de acción para este mes.
                    </p>
                  )}
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
                      Total: {fmt(totalDebtBalance)}
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
                  {data.debts.length > 0 ? data.debts.map((debt) => (
                    <div key={debt.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{debt.name}</span>
                        <span className="text-gray-600">{fmt(Number(debt.balance))}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Pago mínimo: {fmt(Number(debt.min_payment))}/mes
                        {debt.type === 'informal' && ' (informal)'}
                      </p>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No tienes deudas registradas.
                    </p>
                  )}
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
                <ScoreHistoryChart data={data.scoreHistory} />
                {data.scoreHistory.length >= 2 && (
                  <div className="mt-4 p-3 bg-[#F8F9FF] rounded-lg">
                    <p className="text-sm text-[#1E40AF]">
                      {(() => {
                        const first = data.scoreHistory[0].score;
                        const last = data.scoreHistory[data.scoreHistory.length - 1].score;
                        const diff = last - first;
                        if (diff > 0) return <>Tu puntaje subió <strong>+{diff} puntos</strong>. ¡Seguí así!</>;
                        if (diff < 0) return <>Tu puntaje bajó <strong>{diff} puntos</strong>. Revisá tu plan de acción.</>;
                        return <>Tu puntaje se mantiene estable.</>;
                      })()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Capsule recommendations */}
          {capsuleRecs.length > 0 && (
            <div className="mt-6">
              <CapsuleRecommendations recommendations={capsuleRecs} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
