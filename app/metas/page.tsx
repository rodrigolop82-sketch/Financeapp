'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { getUserHousehold } from '@/lib/household';
import { AppShell } from '@/components/layout/AppShell';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { Loader2, Plus, Trophy, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface SavingGoal {
  id: string;
  name: string;
  description: string;
  emoji: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  status: 'active' | 'completed' | 'archived';
  total_points: number;
}

function getLevel(pct: number) {
  if (pct >= 100) return { emoji: '🏆', label: '¡Logrado!', color: '#EAB308' };
  if (pct >= 75)  return { emoji: '🔥', label: 'Ya casi',    color: '#F97316' };
  if (pct >= 50)  return { emoji: '⚡', label: 'Avanzando',  color: '#22C55E' };
  if (pct >= 25)  return { emoji: '🌳', label: 'Creciendo',  color: '#14B8A6' };
  if (pct >= 10)  return { emoji: '🌿', label: 'Arrancando', color: '#3B82F6' };
  return              { emoji: '🌱', label: 'Iniciando',  color: '#9CA3AF' };
}

const EMOJI_OPTIONS = ['🎯','✈️','🏖️','🚗','🏠','💻','📱','🎵','⚽','🏔️','🎓','💍','🎁','🌍','🏋️','🎪','🍕','🎭','🏄','🎨'];

export default function MetasPage() {
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎯');
  const [newTarget, setNewTarget] = useState('');
  const [newDate, setNewDate] = useState('');
  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const hh = await getUserHousehold(supabase, user.id);
      if (!hh) { router.push('/onboarding'); return; }
      setHouseholdId(hh.id);
      const res = await fetch(`/api/metas?householdId=${hh.id}`);
      if (res.ok) setGoals((await res.json()).goals);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newTarget) return;
    setCreating(true);
    const res = await fetch('/api/metas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        householdId, name: newName, description: newDesc,
        emoji: newEmoji, targetAmount: Number(newTarget),
        targetDate: newDate || null, items: [],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/metas/${data.goal.id}`);
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    );
  }

  return (
    <AppShell title="Metas de Ahorro" currentPath="/metas">
      <div className="max-w-2xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">Tus metas</h2>
            <p className="text-sm text-gray-500">Ahorra con propósito, gana puntos</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-electric text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:bg-electric/90 transition"
          >
            <Plus className="w-4 h-4" />
            Nueva meta
          </button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-navy mb-4">Crear nueva meta</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Icono</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(em => (
                    <button
                      key={em} type="button" onClick={() => setNewEmoji(em)}
                      className={`text-2xl p-1.5 rounded-lg transition ${newEmoji === em ? 'bg-electric/15 ring-2 ring-electric' : 'hover:bg-gray-100'}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Ej: Vacación a Cancún, Laptop nueva..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <input
                  type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="¿Para qué es esta meta?"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto objetivo *</label>
                  <input
                    type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)}
                    placeholder="0.00" min="1" step="any"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
                  <input
                    type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-400">Podrás detallar los componentes del objetivo después de crearlo.</p>

              <div className="flex gap-3">
                <button
                  type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={creating}
                  className="flex-1 py-2.5 bg-electric text-white rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crear meta'}
                </button>
              </div>
            </form>
          </div>
        )}

        {goals.length === 0 && !showCreate && (
          <div className="text-center py-16">
            <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-500 mb-2">Sin metas aún</h3>
            <p className="text-sm text-gray-400 mb-6">Crea tu primera meta y empieza a ganar puntos conforme ahorras</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-electric text-white px-6 py-3 rounded-xl font-semibold text-sm"
            >
              Crear mi primera meta
            </button>
          </div>
        )}

        {goals.map(goal => {
          const pct = goal.target_amount > 0
            ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
            : 0;
          const level = getLevel(pct);
          const daysLeft = goal.target_date
            ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000)
            : null;

          return (
            <Link key={goal.id} href={`/metas/${goal.id}`}>
              <div className={`bg-white rounded-2xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-shadow ${
                goal.status === 'completed' ? 'border-yellow-300' : 'border-gray-100'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">{goal.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-navy truncate">{goal.name}</h3>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                    {goal.description && (
                      <p className="text-xs text-gray-500 mb-2 truncate">{goal.description}</p>
                    )}

                    <div className="h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: level.color }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: level.color }}>
                        {level.emoji} {pct}% — {level.label}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>⭐ {goal.total_points} pts</span>
                        {daysLeft !== null && daysLeft > 0 && <span>📅 {daysLeft}d</span>}
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-1">
                      {fmt(goal.current_amount)} de {fmt(goal.target_amount)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
