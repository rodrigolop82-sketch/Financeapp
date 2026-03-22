'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ActionStep } from '@/types';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Circle,
  Target,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

export default function PlanPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planId, setPlanId] = useState('');
  const [steps, setSteps] = useState<ActionStep[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState('');
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: hh } = await supabase
        .from('households').select('id').eq('owner_id', user.id).limit(1).single();
      if (!hh) { router.push('/onboarding'); return; }
      setHouseholdId(hh.id);

      const { data: plan } = await supabase
        .from('action_plans')
        .select('*')
        .eq('household_id', hh.id)
        .order('month', { ascending: false })
        .limit(1)
        .single();

      if (plan) {
        setPlanId(plan.id);
        setSteps((plan.steps as ActionStep[]) || []);
        const completed = (plan.completed_steps as ActionStep[]) || [];
        setCompletedIds(new Set(completed.map(s => s.id)));
        const d = new Date(plan.month);
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        setMonth(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
      }
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStep(step: ActionStep) {
    const newCompleted = new Set(completedIds);
    if (newCompleted.has(step.id)) {
      newCompleted.delete(step.id);
    } else {
      newCompleted.add(step.id);
    }
    setCompletedIds(newCompleted);

    const completedSteps = steps.filter(s => newCompleted.has(s.id));
    await supabase
      .from('action_plans')
      .update({ completed_steps: completedSteps })
      .eq('id', planId);
  }

  async function regeneratePlan() {
    setSaving(true);
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    });
    if (res.ok) {
      const data = await res.json();
      setSteps(data.steps);
      setCompletedIds(new Set());
      setPlanId(data.planId);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const completedCount = completedIds.size;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = completedCount === totalCount && totalCount > 0;

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedSteps = [...steps].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Plan de acción</h1>
              {month && <p className="text-sm text-gray-500">{month}</p>}
            </div>
          </div>
          <Button variant="outline" onClick={regeneratePlan} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Regenerar
          </Button>
        </div>

        {/* Progress summary */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${allCompleted ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                  {allCompleted ? (
                    <Sparkles className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Target className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">
                    {allCompleted ? '¡Plan completado!' : `${completedCount} de ${totalCount} pasos`}
                  </p>
                  <p className="text-sm text-gray-500">
                    {allCompleted
                      ? 'Excelente trabajo este mes. Sigue así.'
                      : `Te faltan ${totalCount - completedCount} paso${totalCount - completedCount !== 1 ? 's' : ''} por completar`}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold text-emerald-600">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        {/* Steps grouped by priority */}
        {(['high', 'medium', 'low'] as const).map((priority) => {
          const prioritySteps = sortedSteps.filter(s => s.priority === priority);
          if (prioritySteps.length === 0) return null;

          const labels = { high: 'Prioridad alta', medium: 'Prioridad media', low: 'Prioridad baja' };
          const colors = {
            high: 'border-l-red-400',
            medium: 'border-l-yellow-400',
            low: 'border-l-gray-300',
          };
          const badges = {
            high: 'bg-red-100 text-red-700',
            medium: 'bg-yellow-100 text-yellow-700',
            low: 'bg-gray-100 text-gray-600',
          };

          return (
            <div key={priority} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badges[priority]}`}>
                  {labels[priority]}
                </span>
                <span className="text-xs text-gray-400">
                  {prioritySteps.filter(s => completedIds.has(s.id)).length}/{prioritySteps.length}
                </span>
              </div>
              <div className="space-y-2">
                {prioritySteps.map((step) => {
                  const isCompleted = completedIds.has(step.id);
                  const isExpanded = expandedStep === step.id;
                  return (
                    <Card
                      key={step.id}
                      className={`border-l-4 ${colors[priority]} ${isCompleted ? 'opacity-75' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleStep(step)}
                            className="mt-0.5 flex-shrink-0"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            ) : (
                              <Circle className="w-6 h-6 text-gray-300 hover:text-emerald-400 transition-colors" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                              className="w-full text-left"
                            >
                              <div className="flex items-center justify-between">
                                <p className={`font-medium text-sm ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                                  {step.title}
                                </p>
                                {step.description && (
                                  isExpanded
                                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            </button>
                            {isExpanded && step.description && (
                              <p className="text-sm text-gray-500 mt-2">{step.description}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        {steps.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">No hay plan de acción</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Genera un plan basado en tu perfil financiero actual.
              </p>
              <Button onClick={regeneratePlan} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generar plan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
