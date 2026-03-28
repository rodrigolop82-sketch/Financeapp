'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScoreHistoryChart } from '@/components/charts/score-history-chart';
import { MonthlySnapshot } from '@/types';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function getScoreColor(score: number) {
  if (score >= 85) return 'text-[#3B82F6]';
  if (score >= 65) return 'text-green-500';
  if (score >= 45) return 'text-yellow-500';
  if (score >= 25) return 'text-orange-500';
  return 'text-red-500';
}

export default function HistorialPage() {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: hh } = await supabase
        .from('households').select('id').eq('owner_id', user.id).limit(1).single();
      if (!hh) { router.push('/onboarding'); return; }

      const { data } = await supabase
        .from('monthly_snapshots')
        .select('*')
        .eq('household_id', hh.id)
        .order('month', { ascending: true });

      setSnapshots((data || []) as MonthlySnapshot[]);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
      </div>
    );
  }

  const chartData = snapshots.map(s => {
    const d = new Date(s.month);
    return { month: MONTH_NAMES[d.getMonth()], score: s.health_score ?? 0 };
  });

  // Calculate trends
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const scoreDiff = previous && latest ? (latest.health_score ?? 0) - (previous.health_score ?? 0) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Historial de progreso</h1>
            <p className="text-sm text-gray-500">{snapshots.length} mes{snapshots.length !== 1 ? 'es' : ''} registrado{snapshots.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Score evolution chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Evolución del puntaje</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <>
                <ScoreHistoryChart data={chartData} />
                {scoreDiff !== 0 && (
                  <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                    scoreDiff > 0 ? 'bg-[#F8F9FF]' : 'bg-red-50'
                  }`}>
                    {scoreDiff > 0 ? (
                      <TrendingUp className="w-5 h-5 text-[#2563EB]" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                    <p className={`text-sm ${scoreDiff > 0 ? 'text-[#1E40AF]' : 'text-red-700'}`}>
                      Tu puntaje {scoreDiff > 0 ? 'subió' : 'bajó'} <strong>{Math.abs(scoreDiff)} puntos</strong> respecto al mes anterior.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-gray-500 py-8">Aún no hay historial. Completa tu primer mes.</p>
            )}
          </CardContent>
        </Card>

        {/* Summary cards */}
        {latest && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500">Puntaje actual</p>
                <p className={`text-2xl font-bold ${getScoreColor(latest.health_score ?? 0)}`}>
                  {latest.health_score ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500">Mejor puntaje</p>
                <p className="text-2xl font-bold text-[#2563EB]">
                  {Math.max(...snapshots.map(s => s.health_score ?? 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500">Promedio</p>
                <p className="text-2xl font-bold text-gray-700">
                  {Math.round(snapshots.reduce((s, snap) => s + (snap.health_score ?? 0), 0) / snapshots.length)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500">Meses registrados</p>
                <p className="text-2xl font-bold text-gray-700">{snapshots.length}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Month-by-month detail */}
        <h2 className="text-lg font-semibold mb-3">Detalle por mes</h2>
        <div className="space-y-3">
          {[...snapshots].reverse().map((snap, idx) => {
            const d = new Date(snap.month);
            const monthLabel = `${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`;
            const prevSnap = idx < snapshots.length - 1 ? [...snapshots].reverse()[idx + 1] : null;
            const diff = prevSnap ? (snap.health_score ?? 0) - (prevSnap.health_score ?? 0) : 0;

            return (
              <Card key={snap.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-semibold">{monthLabel}</p>
                        <div className="flex items-center gap-1">
                          {diff > 0 && <TrendingUp className="w-3 h-3 text-[#3B82F6]" />}
                          {diff < 0 && <TrendingDown className="w-3 h-3 text-red-500" />}
                          {diff === 0 && <Minus className="w-3 h-3 text-gray-400" />}
                          <span className={`text-xs ${diff > 0 ? 'text-[#2563EB]' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : 'Sin cambio'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${getScoreColor(snap.health_score ?? 0)}`}>
                        {snap.health_score ?? 0}
                      </p>
                      <div className="flex items-center gap-1">
                        {snap.plan_completed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-[#3B82F6]" />
                            <span className="text-xs text-[#2563EB]">Plan completado</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-gray-300" />
                            <span className="text-xs text-gray-400">Plan pendiente</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Separator className="mb-3" />
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Ingresos</p>
                      <p className="text-sm font-medium">{fmt(Number(snap.income) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Gastos</p>
                      <p className="text-sm font-medium">{fmt(Number(snap.expenses) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ahorros</p>
                      <p className="text-sm font-medium">{fmt(Number(snap.savings) || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {snapshots.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">Sin historial</p>
              <p className="text-sm text-gray-500 mt-1">
                Tu primer snapshot se creará al completar el onboarding.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
