'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  Users,
  Receipt,
  Mic,
  MessageSquare,
  TrendingUp,
  ShieldCheck,
  CreditCard,
  Home,
} from 'lucide-react';
import Link from 'next/link';

interface AdminData {
  overview: {
    totalUsers: number;
    totalHouseholds: number;
    totalTransactions: number;
    totalDebts: number;
    totalChatMessages: number;
  };
  activity: {
    transactionsToday: number;
    transactionsWeek: number;
    transactionsMonth: number;
    activeHouseholdsWeek: number;
    activeHouseholdsMonth: number;
    voiceTransactions: number;
  };
  sourceBreakdown: Record<string, number>;
  dailyTransactions: Record<string, number>;
  registrationsByDay: Record<string, number>;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const res = await fetch('/api/admin');
      if (res.status === 403) {
        setError('No tenés acceso al panel de admin.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Error al cargar métricas.');
        setLoading(false);
        return;
      }

      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="font-medium text-gray-700">{error}</p>
            <Link href="/dashboard">
              <Button variant="outline" className="mt-4">Volver al dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { overview, activity, sourceBreakdown, dailyTransactions, registrationsByDay } = data;

  // Sort daily transactions for chart
  const sortedDays = Object.entries(dailyTransactions)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);
  const maxTx = Math.max(...sortedDays.map(([, v]) => v), 1);

  // Sort registrations
  const sortedRegs = Object.entries(registrationsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30);

  const sourceLabels: Record<string, string> = {
    manual: 'Manual',
    voice: 'Voz',
    ocr: 'OCR',
    csv: 'CSV',
  };

  const voicePct = overview.totalTransactions > 0
    ? Math.round((activity.voiceTransactions / overview.totalTransactions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Panel de Admin</h1>
            <p className="text-sm text-gray-500">Métricas agregadas — sin datos individuales</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4" />
            Datos anónimos
          </div>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-[#2563EB]" />
                <p className="text-xs text-gray-500">Usuarios totales</p>
              </div>
              <p className="text-3xl font-bold">{overview.totalUsers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-[#2563EB]" />
                <p className="text-xs text-gray-500">Hogares</p>
              </div>
              <p className="text-3xl font-bold">{overview.totalHouseholds}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="w-4 h-4 text-[#2563EB]" />
                <p className="text-xs text-gray-500">Transacciones</p>
              </div>
              <p className="text-3xl font-bold">{overview.totalTransactions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-[#2563EB]" />
                <p className="text-xs text-gray-500">Mensajes al chat</p>
              </div>
              <p className="text-3xl font-bold">{overview.totalChatMessages}</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                Actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Transacciones hoy</span>
                <span className="text-lg font-bold">{activity.transactionsToday}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Transacciones esta semana</span>
                <span className="text-lg font-bold">{activity.transactionsWeek}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Transacciones este mes</span>
                <span className="text-lg font-bold">{activity.transactionsMonth}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Hogares activos (7 días)</span>
                <span className="text-lg font-bold">{activity.activeHouseholdsWeek}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Hogares activos (30 días)</span>
                <span className="text-lg font-bold">{activity.activeHouseholdsMonth}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="w-4 h-4 text-[#2563EB]" />
                Fuente de transacciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(sourceBreakdown).map(([source, count]) => {
                const pct = overview.totalTransactions > 0
                  ? Math.round((count / overview.totalTransactions) * 100)
                  : 0;
                return (
                  <div key={source}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{sourceLabels[source] || source}</span>
                      <span className="font-medium">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2563EB] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {Object.keys(sourceBreakdown).length === 0 && (
                <p className="text-sm text-gray-400">Sin transacciones aún</p>
              )}
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[#3B82F6]" />
                  <span className="text-sm text-gray-600">Adopción de voz:</span>
                  <span className="text-sm font-bold">{voicePct}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily transactions chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Transacciones por día (últimos 14 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedDays.length > 0 ? (
              <div className="flex items-end gap-1 h-40">
                {sortedDays.map(([date, count]) => {
                  const height = Math.max((count / maxTx) * 100, 4);
                  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-700">{count}</span>
                      <div
                        className="w-full bg-[#2563EB] rounded-t-sm min-h-[4px]"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos aún</p>
            )}
          </CardContent>
        </Card>

        {/* Registrations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Registros de usuarios (últimos 30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedRegs.length > 0 ? (
              <div className="space-y-1">
                {sortedRegs.map(([date, count]) => {
                  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <div key={date} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24">{dayLabel}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-[#3B82F6] rounded-full"
                          style={{ width: `${Math.max(count * 20, 5)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Sin registros recientes</p>
            )}
          </CardContent>
        </Card>

        {/* Other totals */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-[#2563EB]" />
                <p className="text-xs text-gray-500">Deudas registradas</p>
              </div>
              <p className="text-2xl font-bold">{overview.totalDebts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4 text-[#2563EB]" />
                <p className="text-xs text-gray-500">Transacciones por voz</p>
              </div>
              <p className="text-2xl font-bold">{activity.voiceTransactions}</p>
            </CardContent>
          </Card>
        </div>

        {/* Privacy notice */}
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
          <ShieldCheck className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <p className="text-sm text-green-800 font-medium">Este panel solo muestra datos agregados</p>
          <p className="text-xs text-green-600 mt-1">
            No se expone información financiera individual de ningún usuario. Los datos personales están protegidos por Row Level Security.
          </p>
        </div>
      </div>
    </div>
  );
}
