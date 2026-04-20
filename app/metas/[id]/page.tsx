'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react';
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

interface GoalItem {
  id: string;
  name: string;
  amount: number;
}

interface Contribution {
  id: string;
  amount: number;
  note: string;
  points_earned: number;
  created_at: string;
}

function getLevel(pct: number) {
  if (pct >= 100) return { emoji: '🏆', label: '¡Logrado!',  color: '#EAB308' };
  if (pct >= 75)  return { emoji: '🔥', label: '¡Ya casi!',  color: '#F97316' };
  if (pct >= 50)  return { emoji: '⚡', label: 'Avanzando',  color: '#22C55E' };
  if (pct >= 25)  return { emoji: '🌳', label: 'Creciendo',  color: '#14B8A6' };
  if (pct >= 10)  return { emoji: '🌿', label: 'Arrancando', color: '#3B82F6' };
  return              { emoji: '🌱', label: 'Iniciando',  color: '#9CA3AF' };
}

const MILESTONES = [
  { pct: 25, emoji: '🌿', label: '25%' },
  { pct: 50, emoji: '⚡', label: '50%' },
  { pct: 75, emoji: '🔥', label: '75%' },
  { pct: 100, emoji: '🏆', label: '100%' },
];

function CircularProgress({ pct, color }: { pct: number; color: string }) {
  const r = 76;
  const circ = 2 * Math.PI * r;
  const offset = circ - Math.min(pct / 100, 1) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      <svg width="200" height="200" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="#f3f4f6" strokeWidth="14" />
        <circle
          cx="100" cy="100" r={r} fill="none"
          stroke={color} strokeWidth="14"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="text-center z-10 pointer-events-none">
        <div className="text-3xl font-black text-navy">{pct}%</div>
        <div className="text-xs text-gray-400">completado</div>
      </div>
    </div>
  );
}

export default function MetaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [goal, setGoal] = useState<SavingGoal | null>(null);
  const [items, setItems] = useState<GoalItem[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContribute, setShowContribute] = useState(false);
  const [contribAmount, setContribAmount] = useState('');
  const [contribNote, setContribNote] = useState('');
  const [contributing, setContributing] = useState(false);
  const [celebration, setCelebration] = useState<{ milestones: string[]; points: number; completed: boolean } | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

  useEffect(() => { loadGoal(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadGoal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const res = await fetch(`/api/metas/${id}`);
    if (!res.ok) { router.push('/metas'); return; }
    const data = await res.json();
    setGoal(data.goal);
    setItems(data.items);
    setContributions(data.contributions);
    setLoading(false);
  }

  async function handleContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!contribAmount || Number(contribAmount) <= 0) return;
    setContributing(true);
    const res = await fetch(`/api/metas/${id}/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(contribAmount), note: contribNote }),
    });
    if (res.ok) {
      const data = await res.json();
      setContribAmount('');
      setContribNote('');
      setShowContribute(false);
      if (data.milestones.length > 0 || data.completed) {
        setCelebration({ milestones: data.milestones, points: data.pointsEarned, completed: data.completed });
      }
      await loadGoal();
    }
    setContributing(false);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemName.trim() || !newItemAmount) return;
    setAddingItem(true);
    const res = await fetch(`/api/metas/${id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItemName, amount: Number(newItemAmount) }),
    });
    if (res.ok) {
      setNewItemName('');
      setNewItemAmount('');
      setShowAddItem(false);
      await loadGoal();
    }
    setAddingItem(false);
  }

  async function handleDeleteItem(itemId: string) {
    await fetch(`/api/metas/${id}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    });
    await loadGoal();
  }

  if (loading || !goal) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric animate-spin" />
      </div>
    );
  }

  const pct = goal.target_amount > 0
    ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
    : 0;
  const level = getLevel(pct);
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const daysLeft = goal.target_date
    ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <AppShell title={goal.name} currentPath="/metas">

      {/* Celebration overlay */}
      {celebration && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setCelebration(null)}>
          <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-6xl mb-3">{celebration.completed ? '🏆' : '🎉'}</div>
            {celebration.milestones.map((m, i) => (
              <p key={i} className="text-xl font-bold text-navy mb-1">{m}</p>
            ))}
            {!celebration.milestones.length && <p className="text-xl font-bold text-navy mb-1">¡Buen aporte!</p>}
            <div className="mt-5 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <div className="text-4xl font-black text-yellow-600">+{celebration.points}</div>
              <div className="text-sm text-yellow-700 font-medium">puntos ganados ⭐</div>
            </div>
            <button
              onClick={() => setCelebration(null)}
              className="mt-6 w-full py-3 bg-electric text-white rounded-2xl font-semibold text-sm"
            >
              {celebration.completed ? '¡Ver mi logro!' : '¡Seguir aportando!'}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-4">

        {/* Back */}
        <Link href="/metas" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-4 h-4" />
          Todas las metas
        </Link>

        {/* Hero card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <div className="text-5xl mb-2">{goal.emoji}</div>
          <h2 className="text-xl font-bold text-navy">{goal.name}</h2>
          {goal.description && <p className="text-sm text-gray-500 mt-1 mb-4">{goal.description}</p>}

          {/* Circular progress */}
          <div className="flex justify-center my-5">
            <CircularProgress pct={pct} color={level.color} />
          </div>

          {/* Level badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-bold mb-5"
            style={{ backgroundColor: level.color }}
          >
            {level.emoji} {level.label}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-yellow-50 rounded-xl p-3">
              <div className="text-2xl font-black text-yellow-600">{goal.total_points}</div>
              <div className="text-xs text-yellow-700 font-medium">⭐ puntos</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="text-base font-black text-blue-700 leading-tight">{fmt(goal.current_amount)}</div>
              <div className="text-xs text-blue-600 mt-0.5">aportado</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-base font-black text-gray-700 leading-tight">{fmt(remaining)}</div>
              <div className="text-xs text-gray-500 mt-0.5">faltante</div>
            </div>
          </div>

          {daysLeft !== null && (
            <p className="text-xs text-gray-400 mb-4">
              {daysLeft > 0 ? `📅 ${daysLeft} días para la fecha límite` : '⏰ Fecha límite alcanzada'}
            </p>
          )}

          {/* Milestone badges */}
          <div className="flex justify-center gap-2 mb-5">
            {MILESTONES.map(m => (
              <div
                key={m.pct}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  pct >= m.pct
                    ? 'bg-yellow-100 text-yellow-800 scale-105 shadow-sm'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                <span className="text-lg">{pct >= m.pct ? m.emoji : '⬜'}</span>
                <span>{m.label}</span>
              </div>
            ))}
          </div>

          {/* Contribute section */}
          {goal.status === 'completed' ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
              <div className="text-4xl mb-2">🏆</div>
              <p className="font-bold text-yellow-800 text-lg">¡Meta completada!</p>
              <p className="text-sm text-yellow-600 mt-1">Ganaste {goal.total_points} puntos en total</p>
            </div>
          ) : (
            <>
              {!showContribute && (
                <button
                  onClick={() => setShowContribute(true)}
                  className="w-full py-4 bg-electric text-white rounded-2xl font-bold text-base shadow-lg shadow-electric/25 hover:bg-electric/90 active:scale-95 transition-all"
                >
                  💰 Aportar a esta meta
                </button>
              )}

              {showContribute && (
                <form onSubmit={handleContribute} className="text-left mt-2 space-y-3 p-4 bg-gray-50 rounded-2xl">
                  <p className="font-semibold text-navy text-sm">¿Cuánto vas a aportar?</p>
                  <input
                    type="number" value={contribAmount} onChange={e => setContribAmount(e.target.value)}
                    placeholder="Monto" min="0.01" step="any" autoFocus required
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-electric/30"
                  />
                  <input
                    type="text" value={contribNote} onChange={e => setContribNote(e.target.value)}
                    placeholder="Nota (ej: Quincena, Bono...)"
                    className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button" onClick={() => setShowContribute(false)}
                      className="flex-1 py-2.5 border border-gray-200 bg-white rounded-xl text-sm font-medium text-gray-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit" disabled={contributing}
                      className="flex-1 py-2.5 bg-electric text-white rounded-xl text-sm font-bold disabled:opacity-60"
                    >
                      {contributing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '¡Aportar! ⭐'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Items breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-navy">Desglose del objetivo</h3>
            <button
              onClick={() => setShowAddItem(!showAddItem)}
              className="text-sm text-electric font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>

          {items.length === 0 && !showAddItem && (
            <p className="text-sm text-gray-400 text-center py-4">
              Detalla los componentes (hotel, boletos, entradas, etc.)
            </p>
          )}

          <div className="divide-y divide-gray-50">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-700">{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-navy">{fmt(item.amount)}</span>
                  <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="flex justify-between pt-3 border-t border-gray-100 mt-1">
              <span className="text-sm font-bold text-gray-600">Total</span>
              <span className="text-sm font-black text-navy">{fmt(goal.target_amount)}</span>
            </div>
          )}

          {showAddItem && (
            <form onSubmit={handleAddItem} className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
              <input
                type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                placeholder="Componente (ej: Hotel)" required
                className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30"
              />
              <input
                type="number" value={newItemAmount} onChange={e => setNewItemAmount(e.target.value)}
                placeholder="Monto" min="0.01" step="any" required
                className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-electric/30"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddItem(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 bg-white rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={addingItem} className="flex-1 py-2 text-sm font-semibold bg-electric text-white rounded-lg disabled:opacity-60">
                  {addingItem ? '...' : 'Agregar'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Contribution history */}
        {contributions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-navy mb-3">Historial de aportes</h3>
            <div className="divide-y divide-gray-50">
              {contributions.map(c => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-base flex-shrink-0">
                    💰
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{fmt(c.amount)}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {c.note || 'Aporte'} · {new Date(c.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-xs font-bold text-yellow-600 flex-shrink-0">+{c.points_earned} pts</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Points guide */}
        <div className="bg-gradient-to-br from-navy to-navy-deep rounded-2xl p-5 text-white">
          <h3 className="font-bold mb-3 flex items-center gap-2">⭐ Cómo ganar puntos</h3>
          <div className="space-y-2.5 text-sm">
            {[
              ['Por cada Q10 aportados', '+1 punto', 'text-white/80'],
              ['Llegar al 25% 🌿', '+50 puntos bonus', 'text-yellow-300'],
              ['Llegar al 50% ⚡', '+100 puntos bonus', 'text-yellow-300'],
              ['Llegar al 75% 🔥', '+200 puntos bonus', 'text-yellow-300'],
              ['Meta completa 🏆', '+500 puntos bonus', 'text-yellow-300'],
            ].map(([label, pts, cls]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-white/70">{label}</span>
                <span className={`font-semibold ${cls}`}>{pts}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-4" />
      </div>
    </AppShell>
  );
}
